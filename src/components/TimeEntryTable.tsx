import { useEffect, useRef, useState } from 'react';
import { Pencil, Trash2, Check, ChevronDown, Wand2 } from 'lucide-react';
import type { TimeEntry, TimeEntryWithStatus, ManualTimeEntryStatus, Project } from '../lib/supabase';
import { getWeek, parseISO, format } from 'date-fns';

// Extended TimeEntry with customer name from project and dynamic status
interface TimeEntryWithCustomer extends TimeEntryWithStatus {
  customerName?: string;
  projectName?: string;
}

// Status display configuration
const statusConfig: Record<string, { label: string; className: string }> = {
  offen: { label: 'Offen', className: 'bg-yellow-100 text-yellow-800' },
  entwurf: { label: 'Entwurf', className: 'bg-gray-100 text-gray-600' },
  versendet: { label: 'Versendet', className: 'bg-blue-100 text-blue-800' },
  bezahlt: { label: 'Bezahlt', className: 'bg-green-100 text-green-800' },
  überfällig: { label: 'Überfällig', className: 'bg-red-100 text-red-800' },
  // Fallback for legacy 'verrechnet' status
  verrechnet: { label: 'Verrechnet', className: 'bg-blue-100 text-blue-800' },
};

type GroupingMode = 'date' | 'week';

type TimeEntryTableProps = {
  entries: TimeEntryWithCustomer[];
  projects: Project[];
  onEdit: (entry: TimeEntry) => void;
  onDelete: (id: string) => Promise<void>;
  onStatusChange?: (id: string, manualStatus: ManualTimeEntryStatus | null) => Promise<void>;
  groupingMode?: GroupingMode;
  groupedEntries?: Record<string, TimeEntryWithCustomer[]> | null;
};

// Offener Status-Umschalter: Zeile + Bildschirmposition des Buttons
type StatusMenuState = { entryId: string; top: number; left: number };

export default function TimeEntryTable({
  entries,
  projects,
  onEdit,
  onDelete,
  onStatusChange,
  groupingMode = 'date',
  groupedEntries,
}: TimeEntryTableProps) {
  const [statusMenu, setStatusMenu] = useState<StatusMenuState | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Menü schliessen bei Klick daneben, Escape oder Scrollen
  // (das Menü ist fixed positioniert und würde sonst wegwandern)
  useEffect(() => {
    if (!statusMenu) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setStatusMenu(null);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setStatusMenu(null);
    };
    const handleScroll = () => setStatusMenu(null);

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [statusMenu]);

  const openStatusMenu = (entryId: string, target: HTMLElement) => {
    if (statusMenu?.entryId === entryId) {
      setStatusMenu(null);
      return;
    }
    const rect = target.getBoundingClientRect();
    setStatusMenu({ entryId, top: rect.bottom + 4, left: rect.left });
  };

  const applyStatus = async (entryId: string, manualStatus: ManualTimeEntryStatus | null) => {
    setStatusMenu(null);
    await onStatusChange?.(entryId, manualStatus);
  };

  const getProjectName = (projectId: string, entry: TimeEntryWithCustomer) => {
    if (entry.projectName) return entry.projectName;
    const project = projects.find((p) => p.id === projectId);
    return project?.name || 'Unbekannt';
  };

  const getCustomerName = (entry: TimeEntryWithCustomer) => {
    if (entry.customerName) return entry.customerName;
    const project = projects.find((p) => p.id === entry.project_id) as any;
    return project?.customers?.name || '-';
  };

  const getWeekNumber = (dateStr: string) => {
    const date = parseISO(dateStr);
    return getWeek(date, { weekStartsOn: 1 });
  };

  const handleDelete = async (id: string, projectName: string) => {
    if (window.confirm(`Möchten Sie den Zeiteintrag für "${projectName}" wirklich löschen?`)) {
      await onDelete(id);
    }
  };

  const calculateTotals = (entriesToSum: TimeEntryWithCustomer[] = entries) => {
    const totalHours = entriesToSum.reduce((sum, entry) => sum + entry.hours, 0);
    const totalAmount = entriesToSum.reduce((sum, entry) => sum + (entry.hours * entry.rate), 0);
    const billableHours = entriesToSum.filter(e => e.billable).reduce((sum, entry) => sum + entry.hours, 0);
    return { totalHours, totalAmount, billableHours };
  };

  if (entries.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <p className="text-gray-500 text-center">Keine Zeiteinträge vorhanden. Erstellen Sie den ersten Eintrag.</p>
      </div>
    );
  }

  const { totalHours, totalAmount, billableHours } = calculateTotals();

  const renderTableRow = (entry: TimeEntryWithCustomer) => {
    const amount = entry.hours * entry.rate;
    const projectName = getProjectName(entry.project_id, entry);

    return (
      <tr key={entry.id} className="hover:bg-gray-50 transition">
        <td className="px-4 py-3 whitespace-nowrap">
          <div className="text-sm text-gray-600">
            {format(parseISO(entry.date), 'dd.MM.yyyy')}
          </div>
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          <div className="text-sm text-gray-500">
            KW {getWeekNumber(entry.date)}
          </div>
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          <div className="text-sm text-gray-600">
            {getCustomerName(entry)}
          </div>
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          <div className="text-sm font-medium text-gray-900">
            {projectName}
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="text-sm text-gray-600 max-w-xs truncate">
            {entry.description || '-'}
          </div>
        </td>
        <td className="px-4 py-3 whitespace-nowrap text-right">
          <div className="text-sm text-gray-900">
            {entry.hours.toFixed(2)}
          </div>
        </td>
        <td className="px-4 py-3 whitespace-nowrap text-right">
          <div className="text-sm text-gray-600">
            CHF {entry.rate.toFixed(0)}
          </div>
        </td>
        <td className="px-4 py-3 whitespace-nowrap text-right">
          <div className="text-sm font-medium text-gray-900">
            CHF {amount.toFixed(2)}
          </div>
        </td>
        <td className="px-4 py-3 whitespace-nowrap text-center">
          <span
            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
              entry.billable
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {entry.billable ? 'Ja' : 'Nein'}
          </span>
        </td>
        <td className="px-4 py-3 whitespace-nowrap text-center">
          {/* Status aus der View: manueller Override, sonst aus der Rechnung abgeleitet */}
          {(() => {
            const status = entry.derived_status || (entry.invoice_id ? 'verrechnet' : 'offen');
            const config = statusConfig[status] || statusConfig.offen;
            const isManual = entry.is_manual_status ?? entry.manual_status != null;

            const titleParts = [
              entry.invoice_number ? `Rechnung: ${entry.invoice_number}` : null,
              isManual ? 'Manuell gesetzt' : null,
              onStatusChange ? 'Klicken zum Ändern' : null,
            ].filter(Boolean);

            const badgeClasses = `inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className}`;

            if (!onStatusChange) {
              return (
                <span className={badgeClasses} title={titleParts.join(' · ') || undefined}>
                  {config.label}
                </span>
              );
            }

            return (
              <button
                type="button"
                onClick={(e) => openStatusMenu(entry.id, e.currentTarget)}
                className={`${badgeClasses} cursor-pointer transition hover:brightness-95 hover:ring-2 hover:ring-brand/30`}
                title={titleParts.join(' · ')}
                aria-haspopup="menu"
                aria-expanded={statusMenu?.entryId === entry.id}
              >
                {isManual && <Wand2 size={11} className="opacity-70" />}
                {config.label}
                <ChevronDown size={12} className="opacity-60" />
              </button>
            );
          })()}
        </td>
        <td className="px-4 py-3 whitespace-nowrap text-right">
          <div className="flex justify-end gap-1">
            <button
              onClick={() => onEdit(entry)}
              className="p-1.5 text-brand hover:bg-sage-50 rounded transition"
              title="Bearbeiten"
            >
              <Pencil size={16} />
            </button>
            <button
              onClick={() => handleDelete(entry.id, projectName)}
              className="p-1.5 text-red-600 hover:bg-red-50 rounded transition"
              title="Löschen"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </td>
      </tr>
    );
  };

  const renderGroupHeader = (weekKey: string, weekEntries: TimeEntryWithCustomer[]) => {
    const { totalHours: weekHours, totalAmount: weekAmount, billableHours: weekBillable } = calculateTotals(weekEntries);
    const [year, kw] = weekKey.split('-');

    return (
      <tr key={`header-${weekKey}`} className="bg-gray-100 border-t-2 border-gray-300">
        <td colSpan={5} className="px-4 py-2">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-gray-900">{kw} / {year}</span>
            <span className="text-sm text-gray-500">
              {weekEntries.length} {weekEntries.length === 1 ? 'Eintrag' : 'Einträge'}
            </span>
          </div>
        </td>
        <td className="px-4 py-2 text-right">
          <span className="font-semibold text-gray-900">{weekHours.toFixed(2)} h</span>
        </td>
        <td className="px-4 py-2"></td>
        <td className="px-4 py-2 text-right">
          <span className="font-semibold text-gray-900">CHF {weekAmount.toFixed(2)}</span>
        </td>
        <td className="px-4 py-2 text-center">
          <span className="text-xs text-gray-500">{weekBillable.toFixed(1)}h verr.</span>
        </td>
        <td colSpan={2}></td>
      </tr>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Datum
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                KW
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Kunde
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Projekt
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Beschreibung
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Stunden
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Satz
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Betrag
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Verr.
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Aktionen
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {groupingMode === 'week' && groupedEntries ? (
              // Grouped by week
              Object.entries(groupedEntries).map(([weekKey, weekEntries]) => (
                <>
                  {renderGroupHeader(weekKey, weekEntries)}
                  {weekEntries.map(entry => renderTableRow(entry))}
                </>
              ))
            ) : (
              // Flat list by date
              entries.map(entry => renderTableRow(entry))
            )}
          </tbody>
          <tfoot className="bg-gray-50 border-t-2 border-gray-300">
            <tr>
              <td colSpan={5} className="px-4 py-3">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-bold text-brand uppercase">Total</span>
                  <span className="text-xs text-gray-500">
                    davon {billableHours.toFixed(1)}h verrechenbar
                  </span>
                </div>
              </td>
              <td className="px-4 py-3 text-right">
                <div className="text-sm font-bold text-brand">
                  {totalHours.toFixed(2)} h
                </div>
              </td>
              <td className="px-4 py-3"></td>
              <td className="px-4 py-3 text-right">
                <div className="text-sm font-bold text-brand">
                  CHF {totalAmount.toFixed(2)}
                </div>
              </td>
              <td colSpan={3}></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Status-Umschalter. Fixed positioniert, damit ihn der horizontale
          Scroll-Container der Tabelle nicht abschneidet. */}
      {statusMenu && (() => {
        const entry = entries.find(e => e.id === statusMenu.entryId);
        if (!entry) return null;

        const manual = entry.manual_status ?? null;
        const autoStatus = entry.invoice_id
          ? entry.invoice_status ?? 'verrechnet'
          : 'offen';

        const options: Array<{
          value: ManualTimeEntryStatus | null;
          label: string;
          hint: string;
          active: boolean;
        }> = [
          {
            value: 'offen',
            label: 'Offen',
            hint: 'Als noch nicht verrechnet markieren',
            active: manual === 'offen',
          },
          {
            value: 'verrechnet',
            label: 'Verrechnet',
            hint: 'Als abgerechnet markieren',
            active: manual === 'verrechnet',
          },
          {
            value: 'bezahlt',
            label: 'Bezahlt',
            hint: 'Zahlung ist eingegangen',
            active: manual === 'bezahlt',
          },
          {
            value: null,
            label: 'Automatisch',
            hint: `Aus der Rechnung ableiten (${statusConfig[autoStatus]?.label ?? 'Offen'})`,
            active: manual === null,
          },
        ];

        return (
          <div
            ref={menuRef}
            role="menu"
            style={{ top: statusMenu.top, left: statusMenu.left }}
            className="fixed z-50 w-60 rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
          >
            <div className="px-3 py-1.5 text-xs font-medium text-gray-400 uppercase tracking-wider">
              Status setzen
            </div>
            {options.map(option => (
              <button
                key={option.label}
                type="button"
                role="menuitem"
                onClick={() => applyStatus(entry.id, option.value)}
                className={`flex w-full items-start gap-2 px-3 py-2 text-left transition hover:bg-gray-50 ${
                  option.active ? 'text-brand' : 'text-gray-700'
                }`}
              >
                <span className="mt-0.5 w-3.5 shrink-0">
                  {option.active && <Check size={14} />}
                </span>
                <span>
                  <span className="block text-sm font-medium">{option.label}</span>
                  <span className="block text-xs text-gray-500">{option.hint}</span>
                </span>
              </button>
            ))}
            {entry.invoice_number && (
              <div className="mt-1 border-t border-gray-100 px-3 py-2 text-xs text-gray-500">
                Verknüpft mit Rechnung {entry.invoice_number}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
