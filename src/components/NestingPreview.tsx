import { useRef, useState, useCallback, useEffect } from 'react';
import type { NestingResult, NestedSheetResult } from '../lib/nesting/types';
import type { PlacedPart } from '../lib/geometry/types';
import { downloadSheetPNG } from '../lib/export/png';
import { PanelBar } from './ModelViewer';

interface NestingPreviewProps {
  nestingResult: NestingResult;
  sheetWidth: number;
  sheetHeight: number;
  cornerRadius?: number;
  /** The item the rest of the console is pointed at, dimming everything else */
  selectedItemId?: string;
  onSelectItem?: (id: string) => void;
}

// Color palette for parts
const PART_COLORS = [
  '#93c5fd', // blue-300
  '#86efac', // green-300
  '#fcd34d', // amber-300
  '#f9a8d4', // pink-300
  '#c4b5fd', // violet-300
  '#6ee7b7', // emerald-300
];

// Margin around the whole layout in mm (in viewBox coordinates)
const SHEET_MARGIN = 40;

// Gap between sheets when more than one is laid out, in mm
const SHEET_GAP = 200;

// Headroom above each sheet for its caption, in mm
const LABEL_BAND = 105;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Minimum hole display radius in mm (for visibility at sheet scale)
const MIN_HOLE_DISPLAY_RADIUS = 6;

// Offcuts smaller than this on either edge are too narrow to be worth anything
const MIN_USEFUL_OFFCUT = 100;

// Overlapping alternatives get noisy fast - show the biggest few
const MAX_OFFCUTS_SHOWN = 4;

// How long the "that now fits on fewer sheets" highlight stays up
const SHEET_WIN_MS = 1800;

// Colour follows the part, not its slot in the layout, so a part keeps its
// colour as it slides to a new position - or to another sheet - across a re-nest.
function colorForPart(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return PART_COLORS[hash % PART_COLORS.length];
}

function usableOffcuts(sheet: NestedSheetResult | undefined) {
  // Leftover rectangles big enough to actually cut something else from.
  // These overlap each other - each is a different way to use the same space.
  return (sheet?.freeRects ?? [])
    .filter((r) => r.width >= MIN_USEFUL_OFFCUT && r.height >= MIN_USEFUL_OFFCUT)
    .slice(0, MAX_OFFCUTS_SHOWN);
}

/**
 * Ease a number towards a target over `duration` ms.
 *
 * The viewBox is an attribute, so CSS cannot transition it. Without this the
 * view snaps as a sheet appears or disappears, which is exactly the moment the
 * layout is trying to explain.
 */
function useTweenedNumber(target: number, duration = 620): number {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  const frame = useRef(0);

  useEffect(() => {
    const start = from.current;
    if (start === target) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const span = reduced ? 0 : duration;
    const began = performance.now();

    const step = (now: number) => {
      const t = span === 0 ? 1 : Math.min(1, (now - began) / span);
      // easeOutCubic - fast to settle, no overshoot
      const eased = 1 - Math.pow(1 - t, 3);
      const next = start + (target - start) * eased;
      from.current = next;
      setValue(next);
      if (t < 1) frame.current = requestAnimationFrame(step);
    };

    frame.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame.current);
  }, [target, duration]);

  return value;
}

export function NestingPreview({
  nestingResult,
  sheetWidth,
  sheetHeight,
  cornerRadius = 0,
  selectedItemId,
  onSelectItem,
}: NestingPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const [selectedSheet, setSelectedSheet] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [showOffcuts, setShowOffcuts] = useState(true);
  const lastPanPosition = useRef({ x: 0, y: 0 });
  const draggedWhilePanning = useRef(false);

  const sheets = nestingResult.sheets;

  // Re-nesting can drop sheets out from under the selection - land on the last
  // one rather than reading past the end.
  const sheetIndex = Math.min(selectedSheet, Math.max(0, sheets.length - 1));
  const currentSheet = sheets[sheetIndex];
  const offcuts = usableOffcuts(currentSheet);

  // Fewer sheets is the whole point of the tool, so say so when it happens.
  const [sheetWin, setSheetWin] = useState(false);
  const [lastSheetCount, setLastSheetCount] = useState(sheets.length);

  // Compared during render rather than in an effect, so the highlight is on the
  // same paint as the new layout instead of a frame behind it.
  if (lastSheetCount !== sheets.length) {
    setLastSheetCount(sheets.length);
    setSheetWin(sheets.length < lastSheetCount);
  }

  useEffect(() => {
    if (!sheetWin) return;
    const timer = setTimeout(() => setSheetWin(false), SHEET_WIN_MS);
    return () => clearTimeout(timer);
  }, [sheetWin]);

  // Sheets sit side by side, so a job that needs two of them looks like two of
  // them. Each sheet keeps a fixed origin; only the framing moves.
  const sheetOriginX = (index: number) => index * (sheetWidth + SHEET_GAP);
  const targetLayoutWidth =
    sheets.length * sheetWidth + Math.max(0, sheets.length - 1) * SHEET_GAP;
  const layoutWidth = useTweenedNumber(targetLayoutWidth);
  const layoutHeight = sheetHeight + LABEL_BAND;

  // Calculate viewBox based on zoom and pan
  // At zoom=1, show the whole layout plus margins
  const viewBoxWidth = (layoutWidth + SHEET_MARGIN * 2) / zoom;
  const viewBoxHeight = (layoutHeight + SHEET_MARGIN * 2) / zoom;

  // Center the viewBox when zoomed, adjusted by pan offset
  const viewBoxMinX =
    -SHEET_MARGIN + (layoutWidth + SHEET_MARGIN * 2 - viewBoxWidth) / 2 + panOffset.x;
  const viewBoxMinY =
    -SHEET_MARGIN -
    LABEL_BAND +
    (layoutHeight + SHEET_MARGIN * 2 - viewBoxHeight) / 2 +
    panOffset.y;

  const viewBox = `${viewBoxMinX} ${viewBoxMinY} ${viewBoxWidth} ${viewBoxHeight}`;

  // Render a single part as SVG elements.
  //
  // Position lives on the group's transform and geometry is drawn from a local
  // origin, so React can keep the same nodes across a re-nest and CSS slides
  // them to their new home - including across the gap to another sheet. `key`
  // therefore has to identify the part itself, not its slot in a layout.
  const renderPart = useCallback(
    (placement: PlacedPart, originX: number, key: string, order: number) => {
      const { part, x, y, rotated } = placement;

      // With several things nested together, "which of these rectangles is the
      // cabinet" is the question the layout most needs to answer. Selecting an
      // item anywhere in the console fades the rest of the sheet back.
      const dimmed =
        selectedItemId !== undefined && part.itemId !== selectedItemId;

      const width = rotated ? part.height : part.width;
      const height = rotated ? part.width : part.height;
      const color = colorForPart(part.id);

      // Calculate safe corner radius (can't exceed half the minimum dimension)
      const safeRadius = Math.min(cornerRadius, width / 2, height / 2);

      // SVG origin is top-left, nesting uses bottom-left
      // Transform: svgY = sheetHeight - nestingY - partHeight
      const svgY = sheetHeight - y - height;

      // Calculate font size based on part dimensions
      const fontSize = Math.max(12, Math.min(24, Math.min(width, height) * 0.08));
      const dimFontSize = Math.max(10, fontSize * 0.85);

      // Dimensions label
      const dimText = rotated
        ? `${part.width}×${part.height}mm (R)`
        : `${part.width}×${part.height}mm`;

      return (
        <g
          key={key}
          className="nest-part"
          onClick={() => {
            if (!draggedWhilePanning.current && part.itemId) {
              onSelectItem?.(part.itemId);
            }
          }}
          style={{
            cursor: part.itemId ? 'pointer' : undefined,
            opacity: dimmed ? 0.28 : 1,
            transform: `translate(${originX + x}px, ${svgY}px)`,
            // A short cascade reads as the sheet re-packing rather than every
            // part jumping at once.
            transitionDelay: `${Math.min(order * 22, 260)}ms`,
          }}
        >
          {/* Part rectangle */}
          <rect
            x={0}
            y={0}
            width={width}
            height={height}
            rx={safeRadius}
            ry={safeRadius}
            fill={color}
            stroke="#374151"
            strokeWidth={2}
          />

          {/* Drill holes */}
          {part.holes.map((hole, holeIndex) => {
            // Transform hole position based on rotation
            // Holes are defined relative to the part's local coordinate system
            let holeX: number;
            let holeY: number;

            if (rotated) {
              // When rotated 90° CW: local (hx, hy) -> (hy, partWidth - hx)
              holeX = hole.y;
              holeY = height - hole.x;
            } else {
              holeX = hole.x;
              // Flip Y within the part (hole.y is from bottom of part)
              holeY = height - hole.y;
            }

            // Use minimum display radius for visibility at sheet scale. A
            // 35mm hinge cup is already big enough to read at any zoom, so it
            // shows at true size - the size difference against a 5mm pin hole
            // is the point.
            const isCup = hole.layer === 'DRILL_35MM';
            const displayRadius = isCup
              ? hole.diameter / 2
              : Math.max(hole.diameter / 2, MIN_HOLE_DISPLAY_RADIUS);

            return (
              <circle
                key={`hole-${holeIndex}`}
                cx={holeX}
                cy={holeY}
                r={displayRadius}
                fill={isCup ? '#a855f7' : '#ef4444'}
                stroke={isCup ? '#7e22ce' : '#b91c1c'}
                strokeWidth={isCup ? 2 : 1}
              />
            );
          })}

          {/* Part name label */}
          <text
            x={width / 2}
            y={height / 2 - fontSize * 0.6}
            fontSize={fontSize}
            fill="#1f2937"
            fontFamily="system-ui, sans-serif"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {part.name}
          </text>

          {/* Dimensions label */}
          <text
            x={width / 2}
            y={height / 2 + dimFontSize * 0.6}
            fontSize={dimFontSize}
            fill="#6b7280"
            fontFamily="system-ui, sans-serif"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {dimText}
          </text>
        </g>
      );
    },
    [sheetHeight, cornerRadius, selectedItemId, onSelectItem]
  );

  // Pan event handlers
  const handleMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    setIsPanning(true);
    draggedWhilePanning.current = false;
    lastPanPosition.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!isPanning || !svgRef.current) return;

      const deltaX = e.clientX - lastPanPosition.current.x;
      const deltaY = e.clientY - lastPanPosition.current.y;
      if (Math.abs(deltaX) + Math.abs(deltaY) > 2) draggedWhilePanning.current = true;

      // Convert screen pixels to viewBox units
      const svgRect = svgRef.current.getBoundingClientRect();
      const scaleX = viewBoxWidth / svgRect.width;
      const scaleY = viewBoxHeight / svgRect.height;

      // Pan moves the viewBox origin in the opposite direction of mouse movement
      setPanOffset((prev) => ({
        x: prev.x - deltaX * scaleX,
        y: prev.y - deltaY * scaleY,
      }));

      lastPanPosition.current = { x: e.clientX, y: e.clientY };
    },
    [isPanning, viewBoxWidth, viewBoxHeight]
  );

  const handleMouseUp = useCallback(() => setIsPanning(false), []);
  const handleMouseLeave = useCallback(() => setIsPanning(false), []);

  // Handle zoom
  const handleZoomIn = () => setZoom((z) => Math.min(z * 1.25, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z / 1.25, 0.5));

  const handleExportPNG = async () => {
    if (!svgRef.current) return;
    try {
      await downloadSheetPNG(svgRef.current, {
        sheetWidth,
        sheetHeight,
        // Every sheet lives in one SVG now, so the export crops to the one the
        // user has selected.
        originX: sheetOriginX(sheetIndex),
        caption:
          `Sheet ${sheetIndex + 1} of ${sheets.length}  -  ` +
          `${sheetWidth} x ${sheetHeight}mm  -  ${currentSheet.placements.length} parts`,
        filename:
          sheets.length > 1
            ? `sheet-${sheetIndex + 1}-of-${sheets.length}.png`
            : 'cutting-layout.png',
      });
    } catch (error) {
      alert(error instanceof Error ? error.message : 'PNG export failed');
    }
  };

  // Handle reset view (pan and zoom)
  const handleResetView = () => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  };

  // Selection - which sheet the offcut readout and PNG export are about
  const selectSheet = (index: number) => {
    if (draggedWhilePanning.current) return;
    setSelectedSheet(index);
  };
  const handlePrevSheet = () => setSelectedSheet(Math.max(0, sheetIndex - 1));
  const handleNextSheet = () =>
    setSelectedSheet(Math.min(sheets.length - 1, sheetIndex + 1));

  if (sheets.length === 0) {
    return (
      <section className="flex min-h-0 flex-1 flex-col bg-white">
        <PanelBar title="The ply" />
        <div className="flex min-h-0 flex-1 items-center justify-center bg-console">
          <p className="text-[13px] text-graphite/45">
            Nothing to nest yet. Add a shelf or a panel.
          </p>
        </div>
      </section>
    );
  }

  // One running counter across every sheet, so a part that moves to another
  // sheet keeps its node and slides there instead of blinking out and back.
  const copiesSeen = new Map<string, number>();
  let partOrder = 0;

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-white">
      <PanelBar title="The ply">
        {/* Someone new to cut-to-size has no reason to know why this view
            exists, and the number that decides what they pay is sitting right
            here. So say what it means rather than only what it is. */}
        <p className="hidden text-[11px] text-graphite/40 lg:block">
          Your panels packed onto whole sheets. You buy the sheet, not the parts.
        </p>
        <div className="flex items-center overflow-hidden rounded border border-rule">
          <ToolButton onClick={handleZoomOut} label="Zoom out">
            &minus;
          </ToolButton>
          <ToolButton onClick={handleResetView} label="Reset zoom and pan" wide>
            <span className="tabular-nums">{Math.round(zoom * 100)}%</span>
          </ToolButton>
          <ToolButton onClick={handleZoomIn} label="Zoom in">
            +
          </ToolButton>
        </div>

        <label className="flex cursor-pointer items-center gap-1.5 text-[12px] text-graphite/70">
          <input
            type="checkbox"
            checked={showOffcuts}
            onChange={(e) => setShowOffcuts(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-rule text-signal focus:ring-1
              focus:ring-signal focus:ring-offset-0"
          />
          Offcuts
        </label>

        <button
          type="button"
          onClick={handleExportPNG}
          className="rounded px-1.5 py-0.5 text-[12px] text-signal hover:bg-signal/10
            focus:outline-none focus-visible:ring-1 focus-visible:ring-signal"
        >
          Save PNG
        </button>
      </PanelBar>

      {/* The sheets fill whatever the console gives this panel. A row of them
          is wide and short, so the viewBox letterboxes inside rather than
          forcing the panel to an aspect ratio the screen may not have. */}
      <div ref={containerRef} className="min-h-0 flex-1 overflow-hidden bg-console p-3">
        <svg
          ref={svgRef}
          viewBox={viewBox}
          preserveAspectRatio="xMidYMid meet"
          className="h-full w-full"
          style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        >
          {sheets.map((sheet, index) => {
            const originX = sheetOriginX(index);
            const isSelected = index === sheetIndex && sheets.length > 1;

            return (
              <g
                key={`sheet-${index}`}
                className="nest-sheet"
                onClick={() => selectSheet(index)}
              >
                {/* Sheet background */}
                <rect
                  x={originX}
                  y={0}
                  width={sheetWidth}
                  height={sheetHeight}
                  fill="#ffffff"
                  stroke="#d1d5db"
                  strokeWidth={4}
                />

                {/* Selection ring - screen only, it has no business in a PNG
                    that goes to the shop floor. */}
                {isSelected && (
                  <rect
                    data-export="hide"
                    x={originX - 24}
                    y={-24}
                    width={sheetWidth + 48}
                    height={sheetHeight + 48}
                    rx={14}
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth={10}
                  />
                )}

                {/* Caption above the sheet - the export carries its own */}
                <text
                  data-export="hide"
                  x={originX}
                  y={-42}
                  fontSize={58}
                  fill={isSelected ? '#1d4ed8' : '#374151'}
                  fontFamily="system-ui, sans-serif"
                  fontWeight={600}
                >
                  Sheet {index + 1}
                  <tspan fill="#6b7280" fontWeight={400}>
                    {'  '}
                    {plural(sheet.placements.length, 'part')},{' '}
                    {sheet.wastePercentage.toFixed(1)}% waste
                  </tspan>
                </text>
              </g>
            );
          })}

          {/* Usable offcuts, drawn under the parts. Outlined rather than
              filled because they overlap - cutting one eats the others. */}
          {showOffcuts &&
            sheets.map((sheet, sheetPos) =>
              usableOffcuts(sheet).map((rect, index) => {
                const originX = sheetOriginX(sheetPos);
                const svgY = sheetHeight - rect.y - rect.height;
                const labelSize = 22;
                const isBest = index === 0;

                return (
                  <g
                    key={`offcut-${sheetPos}-${index}`}
                    className="offcut-outline"
                    data-export="hide"
                    style={{ animationDelay: `${index * 90}ms` }}
                  >
                    <rect
                      x={originX + rect.x}
                      y={svgY}
                      width={rect.width}
                      height={rect.height}
                      fill={isBest ? '#ecfeff' : 'none'}
                      stroke={isBest ? '#0891b2' : '#64748b'}
                      strokeWidth={isBest ? 5 : 3}
                      strokeDasharray="18 12"
                      strokeOpacity={0.95 - index * 0.15}
                    />
                    {isBest && (
                      <rect
                        x={originX + rect.x + 10}
                        y={svgY + 10}
                        width={230}
                        height={38}
                        rx={6}
                        fill="#0891b2"
                      />
                    )}
                    <text
                      x={originX + rect.x + (isBest ? 22 : 14)}
                      y={svgY + (isBest ? 29 : 14 + labelSize * (index + 0.8))}
                      fontSize={labelSize}
                      fill={isBest ? '#ffffff' : '#475569'}
                      fontFamily="system-ui, sans-serif"
                      fontWeight={isBest ? 600 : 400}
                      dominantBaseline="middle"
                    >
                      {isBest ? 'Offcut ' : ''}
                      {Math.round(rect.width)} × {Math.round(rect.height)}mm
                    </text>
                  </g>
                );
              })
            )}

          {/* Every placed part, across every sheet */}
          {sheets.map((sheet, sheetPos) =>
            sheet.placements.map((placement) => {
              const copy = copiesSeen.get(placement.part.id) ?? 0;
              copiesSeen.set(placement.part.id, copy + 1);
              return renderPart(
                placement,
                sheetOriginX(sheetPos),
                `${placement.part.id}#${copy}`,
                partOrder++
              );
            })
          )}

          {/* Sheet dimensions label at bottom center.
              Hidden from PNG export - the caption band already carries it,
              and it collides with any part nested along the bottom edge. */}
          {sheets.map((_, index) => (
            <text
              key={`dims-${index}`}
              data-export="hide"
              x={sheetOriginX(index) + sheetWidth / 2}
              y={sheetHeight - 20}
              fontSize={20}
              fill="#6b7280"
              fontFamily="system-ui, sans-serif"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {sheetWidth} × {sheetHeight}mm
            </text>
          ))}
        </svg>
      </div>

      {/* Every sheet is already on screen, so this line says which one the
          offcut figures and the PNG export are about. */}
      <div
        className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-t
          border-rule px-3 py-1.5 text-[12px]"
      >
        {sheets.length > 1 && (
          <div className="flex items-center overflow-hidden rounded border border-rule">
            <ToolButton
              onClick={handlePrevSheet}
              label="Previous sheet"
              disabled={sheetIndex === 0}
            >
              &lsaquo;
            </ToolButton>
            <ToolButton
              onClick={handleNextSheet}
              label="Next sheet"
              disabled={sheetIndex === sheets.length - 1}
            >
              &rsaquo;
            </ToolButton>
          </div>
        )}

        <span
          className={`flex items-baseline gap-1.5 rounded px-1 ${
            sheetWin ? 'sheet-win' : ''
          }`}
        >
          <span className="text-graphite/40">Sheet</span>
          <span className="font-medium tabular-nums text-graphite">
            {sheetIndex + 1} of{' '}
            <span className={sheetWin ? 'count-pop text-emerald-700' : ''}>
              {sheets.length}
            </span>
          </span>
        </span>

        <span className="tabular-nums text-graphite/45">
          {plural(currentSheet.placements.length, 'part')},{' '}
          {currentSheet.wastePercentage.toFixed(1)}% waste
        </span>

        {offcuts.length > 0 && (
          <span
            className="ml-auto flex items-center gap-1.5"
            title={
              `The largest rectangles that will actually cut from what is left ` +
              `on sheet ${sheetIndex + 1}, at least ${MIN_USEFUL_OFFCUT}mm on both ` +
              `edges with cut spacing deducted. They overlap: taking one shrinks ` +
              `the rest. Add parts and they get nested here before a second sheet ` +
              `is started.`
            }
          >
            <span className="text-graphite/40">Offcut</span>
            {offcuts.slice(0, 3).map((rect, index) => (
              <span
                key={`offcut-chip-${index}`}
                className={`rounded border px-1.5 py-px tabular-nums ${
                  index === 0
                    ? 'border-cyan-600/40 bg-cyan-50 text-cyan-900'
                    : 'border-rule bg-console text-graphite/50'
                }`}
              >
                {Math.round(rect.width)} × {Math.round(rect.height)}
              </span>
            ))}
          </span>
        )}
      </div>

      {nestingResult.unplacedParts.length > 0 && (
        <div className="shrink-0 border-t border-amber-200 bg-amber-50 px-3 py-1.5">
          <p className="text-[11px] leading-snug text-amber-800">
            {plural(nestingResult.unplacedParts.length, 'part')} will not fit on a{' '}
            {sheetWidth} × {sheetHeight}mm sheet. Shrink it, or pick a bigger sheet.
          </p>
        </div>
      )}
    </section>
  );
}

function ToolButton({
  onClick,
  label,
  children,
  disabled,
  wide,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  disabled?: boolean;
  wide?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`h-6 text-[12px] text-graphite/70 hover:bg-console
        disabled:cursor-default disabled:text-graphite/20 disabled:hover:bg-transparent
        focus:outline-none focus-visible:ring-1 focus-visible:ring-inset
        focus-visible:ring-signal ${wide ? 'px-2' : 'w-6'}`}
    >
      {children}
    </button>
  );
}
