import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { NestedSheetResult } from '../nesting/types';
import type { PartDefinition } from '../geometry/types';
import { generateSheetDXF } from './writer';

/**
 * Export a single sheet as DXF file.
 */
export function downloadSheetDXF(
  sheetResult: NestedSheetResult,
  filename?: string
): void {
  const dxfContent = generateSheetDXF(
    sheetResult.placements,
    sheetResult.sheet.width,
    sheetResult.sheet.height,
    sheetResult.index
  );

  const blob = new Blob([dxfContent], { type: 'application/dxf' });
  const name = filename || `sheet-${sheetResult.index + 1}.dxf`;
  saveAs(blob, name);
}

/**
 * Export all sheets as a ZIP file containing multiple DXF files.
 */
export async function downloadAllSheetsZip(
  sheets: NestedSheetResult[],
  projectName: string = 'shelving'
): Promise<void> {
  const zip = new JSZip();

  // Add each sheet as a DXF file
  sheets.forEach((sheetResult, index) => {
    const dxfContent = generateSheetDXF(
      sheetResult.placements,
      sheetResult.sheet.width,
      sheetResult.sheet.height,
      index
    );

    zip.file(`sheet-${index + 1}.dxf`, dxfContent);
  });

  // Generate and download the ZIP
  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, `${projectName}-dxf-files.zip`);
}

/**
 * Generate a CSV cut list.
 */
export function generateCutListCSV(partDefs: PartDefinition[]): string {
  const headers = ['Part Name', 'Quantity', 'Width (mm)', 'Height (mm)', 'Thickness (mm)', 'Holes'];
  const rows = partDefs.map(({ part, quantity }) => [
    part.name,
    quantity.toString(),
    part.width.toString(),
    part.height.toString(),
    part.thickness.toString(),
    part.holes.length.toString(),
  ]);

  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${cell}"`).join(','))
    .join('\n');

  return csvContent;
}

/**
 * Download cut list as CSV.
 */
export function downloadCutList(
  partDefs: PartDefinition[],
  filename: string = 'cut-list.csv'
): void {
  const csvContent = generateCutListCSV(partDefs);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  saveAs(blob, filename);
}

/**
 * Generate a summary report.
 */
export function generateSummaryReport(
  partDefs: PartDefinition[],
  sheets: NestedSheetResult[]
): string {
  const totalParts = partDefs.reduce((sum, def) => sum + def.quantity, 0);
  const totalSheets = sheets.length;
  const avgWaste = sheets.length > 0
    ? sheets.reduce((sum, s) => sum + s.wastePercentage, 0) / sheets.length
    : 0;

  let report = `CNC Shelving Configurator - Summary Report
==========================================

Parts Summary:
`;

  partDefs.forEach(({ part, quantity }) => {
    report += `  ${part.name}: ${quantity}x (${part.width} × ${part.height} × ${part.thickness}mm)\n`;
    if (part.holes.length > 0) {
      report += `    - ${part.holes.length} shelf pin holes per piece\n`;
    }
  });

  report += `
Total Parts: ${totalParts}
Sheets Required: ${totalSheets}
Average Waste: ${avgWaste.toFixed(1)}%

Sheet Breakdown:
`;

  sheets.forEach((sheet, index) => {
    report += `  Sheet ${index + 1}:\n`;
    report += `    - Parts: ${sheet.placements.length}\n`;
    report += `    - Used: ${(sheet.usedArea / 1000000).toFixed(3)} m²\n`;
    report += `    - Waste: ${sheet.wastePercentage.toFixed(1)}%\n`;
  });

  return report;
}

/**
 * Download summary report as text file.
 */
export function downloadSummaryReport(
  partDefs: PartDefinition[],
  sheets: NestedSheetResult[],
  filename: string = 'summary-report.txt'
): void {
  const report = generateSummaryReport(partDefs, sheets);
  const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
  saveAs(blob, filename);
}
