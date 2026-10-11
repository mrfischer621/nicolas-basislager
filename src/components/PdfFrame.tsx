import { ExternalLink, Share2 } from 'lucide-react';
import { useIsMobile } from '../hooks/useMediaQuery';

/**
 * PDF-Vorschau. Ab md eingebettet; auf dem Handy «PDF oeffnen» und, wo der
 * Browser es kann, «Teilen» (iOS zeigt PDFs im iframe nur unvollstaendig).
 */
export function PdfFrame({ url, title, filename }: { url: string; title: string; filename: string }) {
  const mobile = useIsMobile();
  if (!mobile) return <iframe title={title} src={url} className="h-[80vh] w-full" />;

  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const share = async () => {
    try {
      const blob = await (await fetch(url)).blob();
      const file = new File([blob], filename, { type: 'application/pdf' });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title });
      else window.open(url, '_blank', 'noopener');
    } catch {
      // Teilen abgebrochen: nichts zu tun
    }
  };
  return (
    <div className="flex flex-col gap-2 p-5 sm:flex-row">
      <a href={url} target="_blank" rel="noreferrer" download={filename} className="btn-secondary flex-1">
        <ExternalLink size={16} strokeWidth={1.5} aria-hidden="true" /> PDF öffnen
      </a>
      {canShare && (
        <button type="button" onClick={share} className="btn-secondary flex-1">
          <Share2 size={16} strokeWidth={1.5} aria-hidden="true" /> Teilen
        </button>
      )}
    </div>
  );
}
