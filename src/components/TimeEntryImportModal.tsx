import { useState, useEffect, useMemo } from 'react';
import { Clock, Check, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { TimeEntry, Project } from '../lib/supabase';
import { useCompany } from '../context/CompanyContext';
import Modal from './Modal';

// ISO 8601 week number calculation (week starts on Monday - Swiss standard)
function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function formatMonthYear(date: Date): string {
  const months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

/** Format a date string "YYYY-MM-DD" → "DD.MM." without timezone shifting. */
function formatDateShort(dateStr: string): string {
  const [, month, day] = dateStr.split('-').map(Number);
  return `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.`;
}

/** Format hours: whole numbers get ".0", fractional show only needed decimals. */
function formatHours(h: number): string {
  if (h === Math.floor(h)) return `${h}.0h`;
  // Strip trailing zero from 2-decimal representation (e.g. 1.50 → "1.5h")
  return `${h.toFixed(2).replace(/0+$/, '')}h`;
}

type TimeEntryWithProject = TimeEntry & {
  projects?: Project;
};

type GroupedEntry = {
  key: string;
  weekNumber: number;
  monthYear: string;
  projectName: string;
  projectId: string;
  description: string;
  totalHours: number;
  rate: number;
  entries: TimeEntryWithProject[];
};

type TimeEntryImportModalProps = {
  isOpen: boolean;
  onClose: () => void;
  customerId: string;
  projectId?: string;
  onImport: (items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    timeEntryIds: string[];
  }>) => void;
};

export default function TimeEntryImportModal({
  isOpen,
  onClose,
  customerId,
  projectId,
  onImport,
}: TimeEntryImportModalProps) {
  const { selectedCompany } = useCompany();
  const [entries, setEntries] = useState<TimeEntryWithProject[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && selectedCompany && customerId) {
      fetchOpenTimeEntries();
    }
  }, [isOpen, selectedCompany, customerId, projectId]);

  const fetchOpenTimeEntries = async () => {
    if (!selectedCompany) return;

    try {
      setIsLoading(true);
      setError(null);
      setSelectedGroups(new Set());

      // Build query for billable entries without invoice
      let query = supabase
        .from('time_entries')
        .select('*, projects(*)')
        .eq('company_id', selectedCompany.id)
        .eq('billable', true)
        .is('invoice_id', null)
        .order('date', { ascending: true });

      // Filter by project's customer
      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      // Filter entries by customer (via project)
      const filteredEntries = (data || []).filter((entry: TimeEntryWithProject) => {
        return entry.projects?.customer_id === customerId;
      });

      setEntries(filteredEntries);
    } catch (err) {
      console.error('Error fetching time entries:', err);
      setError('Fehler beim Laden der Zeiteinträge.');
    } finally {
      setIsLoading(false);
    }
  };

  // Group entries by week and project
  const groupedEntries = useMemo(() => {
    const groups: Map<string, GroupedEntry> = new Map();

    entries.forEach(entry => {
      // Skip entries with no billable time
      if (entry.hours <= 0) return;

      const date = new Date(entry.date);
      const weekNumber = getISOWeekNumber(date);
      const monthYear = formatMonthYear(date);
      const projectName = entry.projects?.name || 'Unbekanntes Projekt';
      const projectId = entry.project_id;

      // Group by: Week + Project (rate comes from project/company, not per-entry snapshot)
      const key = `KW${weekNumber}_${monthYear}_${projectId}`;

      // Rate hierarchy: project.hourly_rate → entry snapshot (snapshot already includes customer/company defaults)
      const rate = entry.projects?.hourly_rate ?? entry.rate;

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          weekNumber,
          monthYear,
          projectName,
          projectId,
          description: projectName,
          totalHours: 0,
          rate,
          entries: [],
        });
      }

      const group = groups.get(key)!;
      group.totalHours += entry.hours;
      group.entries.push(entry);
    });

    // Sort groups chronologically by first entry date
    return Array.from(groups.values()).sort((a, b) => {
      const dateA = new Date(a.entries[0].date);
      const dateB = new Date(b.entries[0].date);
      return dateA.getTime() - dateB.getTime();
    });
  }, [entries, selectedCompany]);

  const handleToggleGroup = (key: string) => {
    const newSelected = new Set(selectedGroups);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    setSelectedGroups(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedGroups.size === groupedEntries.length) {
      setSelectedGroups(new Set());
    } else {
      setSelectedGroups(new Set(groupedEntries.map(g => g.key)));
    }
  };

  const handleImport = () => {
    const selectedItems = groupedEntries
      .filter(group => selectedGroups.has(group.key))
      .map(group => {
        const heading = `<strong>KW ${group.weekNumber} (${group.monthYear})</strong>`;

        // Entries are already sorted chronologically (query: order('date', ascending))
        const lines = group.entries
          .filter(e => e.hours > 0)
          .map(e => {
            const date = formatDateShort(e.date);
            const hours = formatHours(e.hours);
            const desc = e.description?.trim();
            return desc ? `${date} — ${desc} (${hours})` : `${date} (${hours})`;
          });

        const description = lines.length > 0
          ? `${heading}<br>${lines.join('<br>')}`
          : heading;

        return {
          description,
          quantity: group.totalHours,
          unit_price: group.rate,
          timeEntryIds: group.entries.map(e => e.id),
        };
      });

    onImport(selectedItems);
    onClose();
  };

  const totalSelectedHours = groupedEntries
    .filter(g => selectedGroups.has(g.key))
    .reduce((sum, g) => sum + g.totalHours, 0);

  const totalSelectedAmount = groupedEntries
    .filter(g => selectedGroups.has(g.key))
    .reduce((sum, g) => sum + (g.totalHours * g.rate), 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Offene Zeiten importieren"
      size="lg"
    >
      <div className="space-y-4">
        {/* Info Text */}
        <p className="text-sm text-gray-600">
          Wählen Sie die Zeiteinträge aus, die Sie in diese Rechnung importieren möchten.
          Nur verrechenbare Einträge ohne zugeordnete Rechnung werden angezeigt.
        </p>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3 text-gray-500">
              <Clock className="animate-pulse" size={20} />
              <span>Lade Zeiteinträge...</span>
            </div>
          </div>
        ) : groupedEntries.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Clock size={48} className="mx-auto mb-4 opacity-50" />
            <p>Keine offenen Zeiteinträge für diesen Kunden gefunden.</p>
            <p className="text-sm mt-2">
              Alle verrechenbaren Zeiten wurden bereits einer Rechnung zugeordnet.
            </p>
          </div>
        ) : (
          <>
            {/* Select All */}
            <div className="flex items-center justify-between pb-2 border-b">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-sm text-brand hover:underline"
              >
                {selectedGroups.size === groupedEntries.length ? 'Alle abwählen' : 'Alle auswählen'}
              </button>
              <span className="text-sm text-gray-500">
                {selectedGroups.size} von {groupedEntries.length} Gruppen ausgewählt
              </span>
            </div>

            {/* Entry Groups */}
            <div className="max-h-80 overflow-y-auto space-y-2">
              {groupedEntries.map(group => (
                <div
                  key={group.key}
                  onClick={() => handleToggleGroup(group.key)}
                  className={`
                    p-4 rounded-lg border cursor-pointer transition-all
                    ${selectedGroups.has(group.key)
                      ? 'border-brand bg-brand/5 ring-1 ring-brand'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }
                  `}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className={`
                          w-5 h-5 rounded flex items-center justify-center flex-shrink-0
                          ${selectedGroups.has(group.key)
                            ? 'bg-brand text-white'
                            : 'border-2 border-gray-300'
                          }
                        `}>
                          {selectedGroups.has(group.key) && <Check size={14} />}
                        </div>
                        <span className="font-medium text-gray-900">
                          KW {group.weekNumber} ({group.monthYear})
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1 ml-7">
                        {group.projectName}
                      </p>
                      <p className="text-xs text-gray-500 mt-1 ml-7">
                        {group.entries.length} Einträge
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-gray-900">
                        {group.totalHours.toFixed(1)} h
                      </div>
                      <div className="text-sm text-gray-500">
                        à CHF {group.rate.toFixed(0)}.-
                      </div>
                      <div className="text-sm font-medium text-brand mt-1">
                        CHF {(group.totalHours * group.rate).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            {selectedGroups.size > 0 && (
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-gray-600">Ausgewählt:</span>
                    <span className="ml-2 font-semibold text-gray-900">
                      {totalSelectedHours.toFixed(1)} Stunden
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm text-gray-600">Total:</span>
                    <span className="ml-2 font-bold text-brand text-lg">
                      CHF {totalSelectedAmount.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition flex items-center gap-2"
          >
            <X size={16} />
            Abbrechen
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={selectedGroups.size === 0}
            className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-dark transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Clock size={16} />
            {selectedGroups.size > 0
              ? `${selectedGroups.size} ${selectedGroups.size === 1 ? 'Gruppe' : 'Gruppen'} importieren`
              : 'Importieren'
            }
          </button>
        </div>
      </div>
    </Modal>
  );
}
