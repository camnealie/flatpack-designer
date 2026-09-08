import { useState, useMemo, useCallback, useEffect } from 'react';
import type { PartDefinition } from '../lib/geometry/types';
import type { Project, ProjectItem, ItemKind } from '../lib/project/types';
import { defaultProject, newItem } from '../lib/project/defaults';
import { readProjectFromLocation, writeProjectToLocation } from '../lib/share/url';
import {
  generateProjectParts,
  summariseHardware,
  projectWarnings,
  manualSteps,
  spilloverWarning,
} from '../lib/project/summary';
import type { HardwareItem, Warning } from '../lib/project/summary';
import { expandParts } from '../lib/geometry/parts';
import { buildAssembly } from '../lib/model3d/assembly';
import type { Assembly } from '../lib/model3d/assembly';
import { nestParts } from '../lib/nesting/guillotine';
import { nestPackedTight } from '../lib/nesting/packTight';
import type { NestingResult, NestingConfig } from '../lib/nesting/types';
import { NESTING, ROUTER_BITS } from '../lib/constants';
import type { RouterBitKey } from '../lib/constants';
import {
  getSupplier,
  getMaterial,
  describeCharges,
  materialInThickness,
} from '../lib/pricing/suppliers';
import type { Supplier, SheetMaterial, ChargeSummary } from '../lib/pricing/suppliers';
import { estimateCuts } from '../lib/pricing/cuts';
import type { CutEstimate } from '../lib/pricing/cuts';
import { adviseProject, sagWarnings, shelfCapWarnings } from '../lib/project/advice';
import type { ItemAdvice } from '../lib/project/advice';

export interface ProjectOutput {
  project: Project;
  selected: ProjectItem | undefined;
  supplier: Supplier;
  material: SheetMaterial;
  partDefinitions: PartDefinition[];
  assembly: Assembly;
  nestingResult: NestingResult;
  hardware: HardwareItem[];
  advice: ItemAdvice[];
  selectedAdvice: ItemAdvice | undefined;
  warnings: Warning[];
  manual: string[];
  cuts: CutEstimate;
  charges: ChargeSummary;
  /** The radius every cut corner comes back with, mm */
  cornerRadius: number;
  /** Every hole in the job, for the build guide and the manual-work list */
  holeCount: number;
}

export interface ProjectActions {
  addItem: (kind: ItemKind) => void;
  removeItem: (id: string) => void;
  selectItem: (id: string) => void;
  updateItem: (id: string, patch: Partial<ProjectItem>) => void;
  setSupplier: (id: string) => void;
  setMaterial: (id: string) => void;
  /** Move the whole job to a thicker sheet of the same colour and finish */
  setThickness: (thicknessMm: number) => void;
  setRouterBit: (bit: RouterBitKey) => void;
  setPackTight: (value: boolean) => void;
  setIncludeFreight: (value: boolean) => void;
}

export function useProject(): [ProjectOutput, ProjectActions] {
  // A link is the only place a design can live, so one in the address bar wins
  // over the starting job. Anything unreadable falls back rather than failing.
  const [project, setProject] = useState<Project>(
    () => readProjectFromLocation() ?? defaultProject()
  );

  // Keep the address bar showing the current design, so copying it at any
  // moment shares exactly what is on screen
  useEffect(() => {
    writeProjectToLocation(project);
  }, [project]);

  const supplier = useMemo(
    () => getSupplier(project.supplierId),
    [project.supplierId]
  );

  const material = useMemo(
    () => getMaterial(supplier, project.materialId),
    [supplier, project.materialId]
  );

  // The material carries the thickness - at Plyman a thickness is a different
  // product with its own price, not a dropdown against one product.
  const thickness = material.thickness;

  const partDefinitions = useMemo(
    () => generateProjectParts(project, thickness),
    [project, thickness]
  );

  const assembly = useMemo(
    () => buildAssembly(project, thickness),
    [project, thickness]
  );

  const nestingResult = useMemo(() => {
    const config: NestingConfig = {
      sheetWidth: material.sheetWidth,
      sheetHeight: material.sheetHeight,
      sheetThickness: thickness,
      sheetMargin: NESTING.SHEET_MARGIN,
      // The gap between parts is whatever the machine takes out: a saw blade at
      // Plyman, a router bit at PPR. Any less and every part comes back
      // undersize by the difference.
      partSpacing: supplier.kerf,
      allowRotation: true,
    };

    const parts = expandParts(partDefinitions);
    return project.packTight
      ? nestPackedTight(parts, config)
      : nestParts(parts, config);
  }, [partDefinitions, material, thickness, supplier.kerf, project.packTight]);

  const cuts = useMemo(
    () =>
      estimateCuts(nestingResult.sheets, {
        kerf: supplier.kerf,
        sheetMargin: NESTING.SHEET_MARGIN,
      }),
    [nestingResult, supplier.kerf]
  );

  const charges = useMemo(
    () =>
      describeCharges({
        supplier,
        material,
        sheets: nestingResult.sheets.length,
        cuts: cuts.cuts,
        includeFreight: project.includeFreight,
      }),
    [supplier, material, nestingResult.sheets.length, cuts.cuts, project.includeFreight]
  );

  const hardware = useMemo(() => summariseHardware(project), [project]);

  const advice = useMemo(
    () => adviseProject(project.items, supplier, material),
    [project.items, supplier, material]
  );

  const warnings = useMemo(() => {
    // A whole extra sheet, plus whatever the supplier charges against a sheet
    const spill = spilloverWarning(
      nestingResult.sheets,
      supplier.charges.perSheet
        ? `a whole sheet and another ${supplier.charges.perSheet.label.toLowerCase()}`
        : 'a whole sheet'
    );

    return [
      ...projectWarnings(project, thickness),
      ...sagWarnings(project.items, advice, material),
      ...shelfCapWarnings(project.items, advice),
      ...(spill ? [spill] : []),
    ];
  }, [project, thickness, advice, material, supplier, nestingResult.sheets]);
  const manual = useMemo(
    () => manualSteps(partDefinitions, supplier),
    [partDefinitions, supplier]
  );

  // A CNC leaves the radius of its cutter in every corner whether you ask for
  // it or not, so where the supplier's tooling is known it wins over the bit
  // chosen in the panel.
  const cornerRadius =
    supplier.cutter?.minInternalRadius ?? ROUTER_BITS[project.routerBit] / 2;

  const holeCount = useMemo(
    () =>
      partDefinitions.reduce(
        (sum, { part, quantity }) => sum + part.holes.length * quantity,
        0
      ),
    [partDefinitions]
  );

  const selected = project.items.find((i) => i.id === project.selectedItemId);

  const actions: ProjectActions = {
    addItem: useCallback((kind) => {
      setProject((prev) => {
        const item = newItem(kind, prev.items);
        return {
          ...prev,
          items: [...prev.items, item],
          // Adding something you cannot immediately configure is a dead end,
          // so a new item always takes the selection with it.
          selectedItemId: item.id,
        };
      });
    }, []),

    removeItem: useCallback((id) => {
      setProject((prev) => {
        const items = prev.items.filter((i) => i.id !== id);
        if (items.length === 0) return prev;

        // Land on the neighbour rather than on nothing
        const removedAt = prev.items.findIndex((i) => i.id === id);
        const fallback = items[Math.min(removedAt, items.length - 1)];

        return {
          ...prev,
          items,
          selectedItemId:
            prev.selectedItemId === id ? fallback.id : prev.selectedItemId,
        };
      });
    }, []),

    selectItem: useCallback((id) => {
      setProject((prev) => ({ ...prev, selectedItemId: id }));
    }, []),

    updateItem: useCallback((id, patch) => {
      setProject((prev) => ({
        ...prev,
        items: prev.items.map((item) =>
          item.id === id ? ({ ...item, ...patch } as ProjectItem) : item
        ),
      }));
    }, []),

    setSupplier: useCallback((id) => {
      setProject((prev) => {
        // Materials belong to a supplier, so switching who cuts it has to land
        // on something they actually stock rather than a dangling id.
        const next = getSupplier(id);
        const sameSpec = next.materials.find(
          (m) => m.thickness === getMaterial(getSupplier(prev.supplierId), prev.materialId).thickness
        );

        return {
          ...prev,
          supplierId: id,
          materialId: (sameSpec ?? next.materials[0]).id,
        };
      });
    }, []),

    setMaterial: useCallback((id) => {
      setProject((prev) => ({ ...prev, materialId: id }));
    }, []),

    setThickness: useCallback((thicknessMm) => {
      setProject((prev) => {
        const current = getSupplier(prev.supplierId);
        const swap = materialInThickness(
          current,
          getMaterial(current, prev.materialId),
          thicknessMm
        );
        return swap ? { ...prev, materialId: swap.id } : prev;
      });
    }, []),

    setRouterBit: useCallback((bit) => {
      setProject((prev) => ({ ...prev, routerBit: bit }));
    }, []),

    setPackTight: useCallback((value) => {
      setProject((prev) => ({ ...prev, packTight: value }));
    }, []),

    setIncludeFreight: useCallback((value) => {
      setProject((prev) => ({ ...prev, includeFreight: value }));
    }, []),
  };

  return [
    {
      project,
      selected,
      supplier,
      material,
      partDefinitions,
      assembly,
      nestingResult,
      hardware,
      advice,
      selectedAdvice: advice.find((a) => a.itemId === project.selectedItemId),
      warnings,
      manual,
      cuts,
      charges,
      cornerRadius,
      holeCount,
    },
    actions,
  ];
}
