import { saveAs } from 'file-saver';

/**
 * Rasterise a sheet-preview SVG to PNG.
 *
 * Clones the live preview rather than re-rendering the layout, so the image
 * always matches what is on screen. Zoom and pan are reset for the export and
 * anything marked data-export="hide" is dropped, so the recipient gets the
 * whole sheet and only the parts.
 */

const NS = 'http://www.w3.org/2000/svg';

export interface SheetPngOptions {
  sheetWidth: number;
  sheetHeight: number;
  /** X of the sheet's left edge in the live SVG - every sheet shares one canvas. */
  originX?: number;
  caption?: string;
  filename?: string;
  /** Longest edge of the output image in pixels. */
  pixelWidth?: number;
}

export async function downloadSheetPNG(
  source: SVGSVGElement,
  options: SheetPngOptions
): Promise<void> {
  const {
    sheetWidth,
    sheetHeight,
    originX = 0,
    caption,
    filename = 'sheet.png',
    pixelWidth = 2400,
  } = options;

  const pad = 40;
  const captionBand = caption ? 90 : 0;
  const viewWidth = sheetWidth + pad * 2;
  const viewHeight = sheetHeight + pad * 2 + captionBand;

  const svg = source.cloneNode(true) as SVGSVGElement;

  // Screen-only concerns: layout classes, the grab cursor, the zoomed viewBox.
  svg.removeAttribute('class');
  svg.removeAttribute('style');
  svg.setAttribute('xmlns', NS);
  svg.setAttribute('viewBox', `${originX - pad} ${-pad} ${viewWidth} ${viewHeight}`);
  svg.setAttribute('width', String(pixelWidth));
  svg.setAttribute('height', String(Math.round((pixelWidth * viewHeight) / viewWidth)));

  svg.querySelectorAll('[data-export="hide"]').forEach((el) => el.remove());

  // Opaque ground - the sheet rect only covers its own footprint.
  const bg = document.createElementNS(NS, 'rect');
  bg.setAttribute('x', String(originX - pad));
  bg.setAttribute('y', String(-pad));
  bg.setAttribute('width', String(viewWidth));
  bg.setAttribute('height', String(viewHeight));
  bg.setAttribute('fill', '#ffffff');
  svg.insertBefore(bg, svg.firstChild);

  if (caption) {
    const text = document.createElementNS(NS, 'text');
    text.setAttribute('x', String(originX + sheetWidth / 2));
    text.setAttribute('y', String(sheetHeight + pad + 30));
    text.setAttribute('font-size', '34');
    text.setAttribute('fill', '#1f2937');
    text.setAttribute('font-family', 'system-ui, sans-serif');
    text.setAttribute('text-anchor', 'middle');
    text.textContent = caption;
    svg.appendChild(text);
  }

  const markup = new XMLSerializer().serializeToString(svg);
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;

  const image = await loadImage(url);

  const canvas = document.createElement('canvas');
  canvas.width = Number(svg.getAttribute('width'));
  canvas.height = Number(svg.getAttribute('height'));

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get a 2D canvas context for PNG export');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  const blob = await toBlob(canvas);
  saveAs(blob, filename);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not rasterise the sheet preview'));
    img.src = src;
  });
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Could not encode the PNG'));
    }, 'image/png');
  });
}
