import { X, Download } from 'lucide-react';

interface PdfPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfBlobUrl: string | null;
  onDownload: () => void;
  title: string;
  fileName: string;
}

/**
 * Modal zur Vorschau von PDF-Dokumenten
 * Zeigt das PDF in einem iframe an und bietet Download-Option
 */
export default function PdfPreviewModal({
  isOpen,
  onClose,
  pdfBlobUrl,
  onDownload,
  title,
  fileName,
}: PdfPreviewModalProps) {
  if (!isOpen || !pdfBlobUrl) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-ink/50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-5xl bg-surface rounded-xl shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-line">
            <div>
              <h2 className="text-lg font-semibold text-fg">{title}</h2>
              <p className="text-sm text-fg-muted">{fileName}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-fg-subtle hover:text-fg-muted hover:bg-raised rounded-lg transition"
            >
              <X size={20} />
            </button>
          </div>

          {/* PDF Viewer */}
          <div className="p-4 bg-raised">
            <iframe
              src={pdfBlobUrl}
              className="w-full h-[70vh] rounded-lg border border-line bg-surface"
              title={`PDF Vorschau: ${fileName}`}
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-line">
            <button
              onClick={onClose}
              className="px-4 py-2 text-fg bg-raised hover:bg-sunken rounded-lg transition"
            >
              Schliessen
            </button>
            <button
              onClick={onDownload}
              className="flex items-center gap-2 px-4 py-2 bg-brand text-accent-fg rounded-lg hover:bg-brand-dark transition"
            >
              <Download size={18} />
              Herunterladen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
