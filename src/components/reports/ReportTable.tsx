import { formatChfDisplay } from '../../utils/money';

/** Kleine Summentabelle (Kategorie, Firma, Lieferant). Leer: eine Zeile mit Hinweis. */
export function ReportTable({ title, rows, total, emptyText, limit = 8 }: { title: string; rows: { key: string; label: string; amount: number; hint?: string }[]; total?: number; emptyText: string; limit?: number }) {
  const shown = rows.slice(0, limit);
  const rest = rows.slice(limit);
  return (
    <section className="card p-5" aria-label={title}>
      <h2 className="caps-sm mb-2">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-fg-muted">{emptyText}</p>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {shown.map((r) => (
              <tr key={r.key} className="border-b border-line last:border-0">
                <td className="w-full max-w-0 truncate py-1.5 pr-3">
                  {r.label}
                  {r.hint && <span className="ml-1.5 text-xs text-fg-muted">{r.hint}</span>}
                </td>
                <td className="whitespace-nowrap py-1.5 text-right tabular-nums">{formatChfDisplay(r.amount)}</td>
              </tr>
            ))}
            {rest.length > 0 && (
              <tr className="border-b border-line">
                <td className="py-1.5 pr-3 text-fg-muted">{rest.length} weitere</td>
                <td className="py-1.5 text-right tabular-nums text-fg-muted">{formatChfDisplay(rest.reduce((s, r) => s + r.amount, 0))}</td>
              </tr>
            )}
          </tbody>
          {total !== undefined && (
            <tfoot>
              <tr>
                <td className="pt-2 font-semibold">Total</td>
                <td className="whitespace-nowrap pt-2 text-right font-semibold tabular-nums">{formatChfDisplay(total)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      )}
    </section>
  );
}
