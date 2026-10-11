import { useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../Modal';
import { supabase } from '../../lib/supabase';
import { formatChfDisplay } from '../../utils/money';
import type { SupplierGroup } from '../../utils/bookings';
import { supplierIdFor } from '../../utils/transactionCategories';

/**
 * "Lieferanten nachtragen": Buchungen ohne Lieferant nach Text gruppiert.
 * Pro Gruppe ein Name (mit Vorschlag), ein Speichern fuer alle.
 */
export function SupplierDialog({ open, onClose, groups, known, suppliers = [], onSaved }: { open: boolean; onClose: () => void; groups: SupplierGroup[]; known: string[]; suppliers?: { id: string; name: string }[]; onSaved: () => void }) {
  return (
    <Modal isOpen={open} onClose={onClose} title="Lieferanten nachtragen" size="lg">
      {open && <Form groups={groups} known={known} suppliers={suppliers} onClose={onClose} onSaved={onSaved} />}
    </Modal>
  );
}

function Form({ groups, known, suppliers, onClose, onSaved }: { groups: SupplierGroup[]; known: string[]; suppliers: { id: string; name: string }[]; onClose: () => void; onSaved: () => void }) {
  const [names, setNames] = useState<Record<string, string>>(() => Object.fromEntries(groups.map((g) => [g.key, g.suggestion])));
  const [saving, setSaving] = useState(false);
  const filled = groups.filter((g) => names[g.key]?.trim());

  const save = async () => {
    setSaving(true);
    let saved = 0;
    const failed: string[] = [];
    for (const g of filled) {
      const { error } = await supabase.from('transactions').update({ counterparty: names[g.key].trim() }).in('id', g.ids);
      // Verknuepfung mit dem Lieferanten nur bei Ausgaben (Einnahmen haben einen Zahler)
      if (!error) await supabase.from('transactions').update({ supplier_id: supplierIdFor('ausgabe', names[g.key], suppliers) }).in('id', g.ids).eq('type', 'ausgabe');
      if (error) failed.push(`${g.label}: ${error.message}`);
      else saved += g.ids.length;
    }
    setSaving(false);
    onSaved();
    if (failed.length) toast.error(`${saved} gespeichert, ${failed.length} Gruppen nicht: ${failed[0]}`);
    else {
      toast.success(`Lieferant bei ${saved} Buchungen nachgetragen.`);
      onClose();
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-fg-muted">Buchungen mit gleichem Text sind zusammengefasst. Trag den Lieferanten ein; leer gelassene Gruppen bleiben unverändert.</p>
      <datalist id="lieferanten-bekannt">
        {known.map((k) => (
          <option key={k} value={k} />
        ))}
      </datalist>
      <ul className="divide-y divide-line rounded-tile border border-line">
        {groups.map((g) => (
          <li key={g.key} className="grid gap-2 px-3 py-2.5 sm:grid-cols-[1fr_14rem] sm:items-center">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-fg">{g.label}</p>
              <p className="text-xs text-fg-muted">
                {g.ids.length} {g.ids.length === 1 ? 'Buchung' : 'Buchungen'}, {formatChfDisplay(g.total)}
              </p>
            </div>
            <input aria-label={`Lieferant für ${g.label}`} list="lieferanten-bekannt" className="input py-1.5" value={names[g.key] ?? ''} onChange={(e) => setNames((n) => ({ ...n, [g.key]: e.target.value }))} placeholder="Lieferant" />
          </li>
        ))}
      </ul>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={onClose}>
          Abbrechen
        </button>
        <button type="button" className="btn-primary" disabled={saving || filled.length === 0} onClick={save}>
          {saving ? 'Speichert …' : `${filled.reduce((s, g) => s + g.ids.length, 0)} Buchungen speichern`}
        </button>
      </div>
    </div>
  );
}
