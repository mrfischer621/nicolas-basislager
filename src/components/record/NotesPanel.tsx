import { useState } from 'react';
import toast from 'react-hot-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Note } from '../../lib/supabase';
import { useCompany } from '../../context/CompanyContext';
import { useConfirm } from '../../context/ConfirmProvider';
import { formatDate } from '../../utils/format';

type Target = { customer_id: string } | { project_id: string } | { opportunity_id: string };

/** Notizen zu einer Firma, einem Projekt oder Deal (Tabelle notes), neueste zuerst. */
export function NotesPanel({ target }: { target: Target }) {
  const { selectedCompany } = useCompany();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const [column, id] = Object.entries(target)[0] as [keyof Note, string];
  const key = ['notes', column, id];
  const { data: notes = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: async (): Promise<Note[]> => {
      const { data, error } = await supabase.from('notes').select('*').eq(column, id).order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  return (
    <div className="space-y-4">
      <form
        className="space-y-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!body.trim() || !selectedCompany) return;
          setSaving(true);
          const { error } = await supabase.from('notes').insert({ company_id: selectedCompany.id, ...target, body: body.trim() });
          setSaving(false);
          if (error) {
            toast.error(`Notiz nicht gespeichert: ${error.message}`);
            return;
          }
          setBody('');
          await qc.invalidateQueries({ queryKey: key });
          await qc.invalidateQueries({ queryKey: ['timeline'] });
        }}
      >
        <label htmlFor={`notiz-${id}`} className="sr-only">
          Neue Notiz
        </label>
        <textarea id={`notiz-${id}`} rows={3} className="input" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Notiz, z. B. Gespräch vom Dienstag, nächste Schritte" />
        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={saving || !body.trim()}>
            {saving ? 'Speichert …' : 'Notiz speichern'}
          </button>
        </div>
      </form>
      {isLoading ? (
        <div className="skeleton h-16" />
      ) : notes.length === 0 ? (
        <p className="text-sm text-fg-muted">Noch keine Notizen.</p>
      ) : (
        <ul className="space-y-3">
          {notes.map((n) => (
            <li key={n.id} className="rounded-tile border border-line p-3">
              <div className="mb-1 flex items-center justify-between gap-2 text-xs text-fg-muted">
                <span className="tabular-nums">{formatDate(n.created_at)}</span>
                <button
                  type="button"
                  aria-label="Notiz löschen"
                  className="rounded p-1 hover:bg-danger-subtle hover:text-danger"
                  onClick={async () => {
                    if (!(await confirm({ title: 'Notiz löschen', message: 'Diese Notiz löschen?', confirmLabel: 'Löschen', destructive: true }))) return;
                    await supabase.from('notes').delete().eq('id', n.id);
                    await qc.invalidateQueries({ queryKey: key });
                  }}
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </div>
              <p className="whitespace-pre-wrap text-sm text-fg">{n.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
