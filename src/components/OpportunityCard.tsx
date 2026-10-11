import { useState, useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { AlertCircle, Calendar, GripVertical, FileSpreadsheet, MoreVertical, Trash2, XCircle, RotateCcw } from 'lucide-react';
import type { Opportunity, Customer } from '../lib/supabase';

// ============================================================================
// OPPORTUNITY CARD - SPATIAL UI 2026
// ============================================================================

export interface OpportunityCardProps {
  opportunity: Opportunity;
  customer?: Customer;
  onEdit: (opp: Opportunity) => void;
  onConvert: (opp: Opportunity) => void;
  onCreateQuote?: (opp: Opportunity) => void;
  onDelete?: (opp: Opportunity) => void;
  onToggleLost?: (opp: Opportunity) => void;
  isDragging?: boolean;
}

export function OpportunityCard({
  opportunity,
  customer,
  onEdit,
  onConvert,
  onCreateQuote,
  onDelete,
  onToggleLost,
  isDragging = false,
}: OpportunityCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: String(opportunity.id) });

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  // Calculate rotation based on drag direction for tilt effect
  const rotation = transform ? Math.atan2(transform.y, transform.x) * (180 / Math.PI) * 0.05 : 0;

  const style = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${isSortableDragging ? 1.02 : 1}) rotate(${rotation}deg)`
      : undefined,
    transition: isSortableDragging ? 'none' : transition,
    opacity: isSortableDragging ? 0.4 : 1,
  };

  // Check if last contact was more than 14 days ago
  const lastContactDate = new Date(opportunity.last_contact_at);
  const daysSinceContact = Math.floor(
    (Date.now() - lastContactDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  const isStale = daysSinceContact > 14;

  // Get display name
  const displayName = customer
    ? customer.name
    : opportunity.prospect_info?.company ||
      opportunity.prospect_info?.name ||
      'Unbekannt';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        group relative rounded-2xl p-4 mb-3
        border transition-all duration-200 ease-out
        ${opportunity.is_lost
          ? 'bg-canvas border-line opacity-70'
          : 'bg-surface border-line'
        }
        ${isSortableDragging
          ? 'shadow-2xl ring-2 ring-focus ring-offset-2'
          : 'shadow-sm hover:shadow-xl'
        }
        ${isDragging ? 'opacity-50' : ''}
      `}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute -left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
      >
        <div className="bg-sunken rounded-lg p-1.5 shadow-sm hover:bg-sunken transition-colors">
          <GripVertical size={16} className="text-fg-muted" />
        </div>
      </div>

      {/* Menu Button */}
      {(onDelete || onToggleLost) && (
        <div ref={menuRef} className="absolute right-2 top-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-1.5 rounded-lg text-fg-subtle hover:text-fg-muted hover:bg-raised transition-colors opacity-0 group-hover:opacity-100"
          >
            <MoreVertical size={16} />
          </button>

          {/* Dropdown Menu */}
          {showMenu && (
            <div className="absolute right-0 top-8 bg-surface rounded-xl shadow-lg border border-line py-1 min-w-[160px] z-50">
              {onToggleLost && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleLost(opportunity);
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-fg hover:bg-canvas transition-colors"
                >
                  {opportunity.is_lost ? (
                    <>
                      <RotateCcw size={14} />
                      <span>Reaktivieren</span>
                    </>
                  ) : (
                    <>
                      <XCircle size={14} />
                      <span>Als verloren markieren</span>
                    </>
                  )}
                </button>
              )}
              {onDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(opportunity);
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-danger hover:bg-danger-subtle transition-colors"
                >
                  <Trash2 size={14} />
                  <span>Löschen</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Lost Indicator */}
      {opportunity.is_lost && (
        <div className="flex items-center gap-1.5 text-xs font-medium text-fg-muted mb-3 px-2 py-1 bg-raised rounded-lg border border-line">
          <XCircle size={14} />
          <span>Verloren</span>
        </div>
      )}

      {/* Stale Indicator - Electric Red Accent */}
      {isStale && !opportunity.is_lost && (
        <div className="flex items-center gap-1.5 text-xs font-medium text-danger mb-3 px-2 py-1 bg-danger-subtle rounded-lg border border-danger-subtle">
          <AlertCircle size={14} />
          <span>Letzter Kontakt vor {daysSinceContact} Tagen</span>
        </div>
      )}

      {/* Title - Neo-Grotesk Typography */}
      <h3 className="font-bold text-fg mb-2 tracking-tight leading-tight text-base">
        {opportunity.title}
      </h3>

      {/* Customer/Prospect Name */}
      <p className="text-sm text-fg-muted mb-3 font-medium">
        {displayName}
      </p>

      {/* Expected Value - Bold & Clean */}
      {opportunity.expected_value && (
        <div className="inline-block px-3 py-1.5 bg-gradient-to-br from-canvas to-raised rounded-xl mb-3 border border-line">
          <p className="text-sm font-bold text-fg tracking-tight">
            CHF {opportunity.expected_value.toLocaleString('de-CH', { minimumFractionDigits: 2 })}
          </p>
        </div>
      )}

      {/* Next Action Date */}
      {opportunity.next_action_date && (
        <div className="flex items-center gap-1.5 text-xs text-fg-muted mb-4 font-medium">
          <Calendar size={12} />
          <span>{new Date(opportunity.next_action_date).toLocaleDateString('de-CH')}</span>
        </div>
      )}

      {/* Actions - Spatial Buttons */}
      <div className="flex flex-wrap gap-2 pt-3 border-t border-line">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(opportunity);
          }}
          className="
            flex-1 text-xs font-semibold px-3 py-2
            bg-raised text-fg rounded-xl
            hover:bg-sunken active:translate-y-[1px]
            transition-all duration-150 tracking-tight
          "
        >
          Bearbeiten
        </button>
        {opportunity.prospect_info && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onConvert(opportunity);
            }}
            className="
              flex-1 text-xs font-semibold px-3 py-2
              bg-gradient-to-br from-fg-muted to-fg-muted text-white rounded-xl
              hover:from-fg-muted hover:to-ink
              active:translate-y-[1px]
              transition-all duration-150 tracking-tight
              shadow-sm hover:shadow-md
            "
          >
            Als Kunde anlegen
          </button>
        )}
        {/* Create Quote - only for existing customers */}
        {opportunity.existing_customer_id && onCreateQuote && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCreateQuote(opportunity);
            }}
            className="
              flex-1 text-xs font-semibold px-3 py-2
              bg-gradient-to-br from-success to-success text-white rounded-xl
              hover:from-success hover:to-success
              active:translate-y-[1px]
              transition-all duration-150 tracking-tight
              shadow-sm hover:shadow-md
              flex items-center justify-center gap-1
            "
          >
            <FileSpreadsheet size={12} />
            Angebot
          </button>
        )}
      </div>
    </div>
  );
}
