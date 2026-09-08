import { useEffect } from 'react';
import { Button } from './ui/Button';

interface ExportSuccessModalProps {
  open: boolean;
  filename: string;
  sheetCount: number;
  partCount: number;
  onClose: () => void;
}

/**
 * Confirmation lightbox for a finished DXF export.
 *
 * The download itself is silent - the browser drops a zip in the tray and the
 * page looks unchanged - so this is the receipt: what was written, and how many
 * sheets it covers.
 */
export function ExportSuccessModal({
  open,
  filename,
  sheetCount,
  partCount,
  onClose,
}: ExportSuccessModalProps) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="lightbox-backdrop fixed inset-0 z-50 flex items-center justify-center
        bg-graphite/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-success-title"
      onClick={onClose}
    >
      <div
        className="lightbox-card w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-5 h-24 w-24">
          <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
            <circle className="tick-halo" cx="32" cy="32" r="26" fill="#34d399" />
            <g className="tick-ring">
              <circle cx="32" cy="32" r="26" fill="#ecfdf5" />
              <circle
                className="tick-circle"
                cx="32"
                cy="32"
                r="26"
                fill="none"
                stroke="#10b981"
                strokeWidth="4"
                transform="rotate(-90 32 32)"
              />
              <path
                className="tick-check"
                d="M20 33.5 L28.5 42 L44.5 24"
                fill="none"
                stroke="#059669"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          </svg>
        </div>

        <h2 id="export-success-title" className="text-lg font-semibold text-graphite">
          DXF saved
        </h2>

        <p className="mt-2 text-[13px] text-graphite/60">
          <span className="font-medium text-graphite">{filename}</span>
          <br />
          {partCount} parts across{' '}
          {sheetCount === 1 ? 'one sheet' : `${sheetCount} sheets`}, ready to cut
        </p>

        <Button className="mt-6 w-full" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  );
}
