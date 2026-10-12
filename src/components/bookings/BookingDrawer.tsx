import { FileText } from 'lucide-react';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Drawer } from '../list';
import { supabase } from '../../lib/supabase';
import type { FinanceEntry } from '../../utils/financeAggregation';
import { formatChfDisplay } from '../../utils/money';
import { formatDate } from '../../utils/format';
import { missingParts } from '../../utils/bookings';

/** Buchung mit Belegvorschau im Seitenpanel. Bearbeiten oeffnet die Maske. */
export function BookingDrawer({ entry, onClose, onEdit, onDelete, locked }: { entry: FinanceEntry | null; onClose: () => void; onEdit: (e: FinanceEntry) => void; onDelete: (e: FinanceEntry) => void; locked: boolean }) {
  const receipt = useQuery({
    queryKey: ['receipt-url', entry?.receiptUrl],
    enabled: !!entry?.receiptUrl,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from('receipts').createSignedUrl(entry!.receiptUrl!, 600);
      if (error) throw error;
      return data.signedUrl;
    },
  });
  const mobile = useIsMobile();
  const isPdf = entry?.receiptUrl?.toLowerCase().endsWith('.pdf');
  const missing = entry ? missingParts(entry) : [];

  return (
    <Drawer
      open={!!entry}
      onClose={onClose}
      width="lg"
      title={entry ? `${entry.type === 'einnahme' ? '+' : '−'} ${formatChfDisplay(entry.amount)}` : ''}
      subtitle={entry ? `${formatDate(entry.date)} · ${entry.counterparty ?? 'ohne Lieferant'}` : undefined}
      footer={
        entry &&
        entry.source === 'transaction' && (
          <>
            <button type="button" className="btn-ghost text-danger" disabled={locked} onClick={() => onDelete(entry)}>
              Löschen
            </button>
            <button type="button" className="btn-primary" disabled={locked} onClick={() => onEdit(entry)} data-autofocus>
              Bearbeiten
            </button>
          </>
        )
      }
    >
      {entry && (
        <div className="space-y-5">
          {locked && <p className="rounded-lg bg-info-subtle px-3 py-2 text-sm text-fg-on-light">Das Jahr {entry.date.slice(0, 4)} ist abgeschlossen. Die Buchung lässt sich nicht mehr ändern.</p>}
          {entry.source === 'invoice' && (
            <p className="rounded-lg bg-info-subtle px-3 py-2 text-sm text-fg-on-light">
              Einnahme aus{' '}
              <Link className="font-semibold underline" to={`/rechnungen/${entry.sourceId}`}>
                Rechnung {entry.number}
              </Link>
              . Ändern lässt sie sich dort.
            </p>
          )}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt className="caps-sm">Nr</dt>
              <dd>{entry.number ?? '–'}</dd>
            </div>
            <div>
              <dt className="caps-sm">Kategorie</dt>
              <dd>{entry.category ?? <span className="text-warning">fehlt</span>}</dd>
            </div>
            <div className="col-span-2">
              <dt className="caps-sm">Text</dt>
              <dd>{entry.description ?? '–'}</dd>
            </div>
            {entry.recurrence && (
              <div className="col-span-2">
                <dt className="caps-sm">Wiederkehrend</dt>
                <dd>{entry.recurrence}</dd>
              </div>
            )}
          </dl>
          {missing.length > 0 && entry.source === 'transaction' && entry.type === 'ausgabe' && <p className="text-sm text-warning">Es fehlt: {missing.join(', ')}.</p>}
          {entry.receiptUrl ? (
            receipt.data ? (
              isPdf && mobile ? (
                // iOS zeigt PDFs im iframe nur unvollstaendig: am Handy oeffnen statt einbetten
                <a href={receipt.data} target="_blank" rel="noreferrer" className="btn-secondary w-full">
                  <FileText size={16} strokeWidth={1.5} aria-hidden="true" /> Beleg öffnen (PDF)
                </a>
              ) : isPdf ? (
                <iframe title="Beleg" src={receipt.data} className="h-[60vh] w-full rounded-tile border border-line" />
              ) : (
                <a href={receipt.data} target="_blank" rel="noreferrer">
                  <img src={receipt.data} alt={`Beleg ${entry.number ?? ''}`} className="max-h-[60vh] w-full rounded-tile border border-line object-contain" />
                </a>
              )
            ) : receipt.isError ? (
              <p className="text-sm text-danger">Beleg konnte nicht geladen werden.</p>
            ) : (
              <div role="status" className="skeleton h-64" aria-label="Beleg wird geladen" />
            )
          ) : (
            entry.source === 'transaction' && <p className="text-sm text-fg-muted">Kein Beleg hinterlegt.</p>
          )}
        </div>
      )}
    </Drawer>
  );
}
