import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { Plus } from 'lucide-react';
import type { Opportunity, PipelineStage, Customer } from '../lib/supabase';
import { OpportunityCard } from './OpportunityCard';

// ============================================================================
// KANBAN COLUMN - SWISS MODERN 2026
// Full height, flexible width grid column
// ============================================================================

export interface KanbanColumnProps {
  stage: PipelineStage;
  opportunities: Opportunity[];
  customers: Customer[];
  onEdit: (opp: Opportunity) => void;
  onConvert: (opp: Opportunity) => void;
  onAddNew: (stageId: string) => void;
  onStageRename: (stageId: string, newName: string) => void;
  onCreateQuote?: (opp: Opportunity) => void;
  onDelete?: (opp: Opportunity) => void;
  onToggleLost?: (opp: Opportunity) => void;
}

export function KanbanColumn({
  stage,
  opportunities,
  customers,
  onEdit,
  onConvert,
  onAddNew,
  onStageRename,
  onCreateQuote,
  onDelete,
  onToggleLost,
}: KanbanColumnProps) {
  const opportunityIds = opportunities.map((opp) => String(opp.id));
  const { setNodeRef, isOver } = useDroppable({
    id: `stage-${stage.id}`,
    data: {
      type: 'stage',
      stageId: stage.id,
    },
  });

  const handleStageRename = (newName: string) => {
    if (newName && newName !== stage.name) {
      onStageRename(stage.id, newName);
    }
  };

  return (
    <div
      ref={setNodeRef}
      className={`
        h-full min-h-0
        w-72 flex-shrink-0
        bg-surface-inset
        rounded-xl
        p-4
        border-2
        flex flex-col
        transition-colors duration-150
        ${isOver
          ? 'border-brand bg-brand/5'
          : 'border-surface-border'
        }
      `}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between mb-3 gap-2 flex-shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Color Indicator */}
          <div
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: stage.color }}
          />

          {/* Editable Title */}
          <h2
            className="
              font-semibold text-text-primary tracking-tight text-sm
              cursor-pointer hover:text-brand
              transition-colors truncate flex-1
            "
            onClick={() => {
              const newName = prompt('Neuer Name für die Spalte:', stage.name);
              if (newName && newName.trim() && newName !== stage.name) {
                handleStageRename(newName.trim());
              }
            }}
            title="Klicken zum Bearbeiten"
          >
            {stage.name}
          </h2>

          {/* Count Badge */}
          <span className="text-xs font-medium text-text-secondary bg-surface px-2 py-0.5 rounded-md border border-surface-border flex-shrink-0">
            {opportunities.length}
          </span>
        </div>

        {/* Add Button */}
        <button
          onClick={() => onAddNew(stage.id)}
          className="
            p-1.5
            rounded-lg
            text-text-secondary
            hover:text-brand
            hover:bg-surface
            transition-all duration-150
          "
          title="Neuer Deal"
          aria-label="Neuer Deal"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Cards Container - Scrollable, fills remaining height */}
      <SortableContext items={opportunityIds} strategy={verticalListSortingStrategy}>
        <div className="flex-1 overflow-y-auto space-y-2 min-h-[200px] scrollbar-thin">
          {opportunities.length === 0 ? (
            <div className="flex items-center justify-center h-32 border-2 border-dashed border-surface-border rounded-xl">
              <p className="text-sm text-text-tertiary">Keine Deals</p>
            </div>
          ) : (
            opportunities.map((opp) => {
              const customer = customers.find((c) => c.id === opp.existing_customer_id);
              return (
                <OpportunityCard
                  key={opp.id}
                  opportunity={opp}
                  customer={customer}
                  onEdit={onEdit}
                  onConvert={onConvert}
                  onCreateQuote={onCreateQuote}
                  onDelete={onDelete}
                  onToggleLost={onToggleLost}
                />
              );
            })
          )}
        </div>
      </SortableContext>
    </div>
  );
}
