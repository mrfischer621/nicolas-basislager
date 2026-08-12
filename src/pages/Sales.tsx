import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Opportunity, PipelineStage, Customer } from '../lib/supabase';
import { useCompany } from '../context/CompanyContext';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  pointerWithin,
  rectIntersection,
  closestCenter,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent, CollisionDetection, UniqueIdentifier } from '@dnd-kit/core';
import { Plus, Eye, EyeOff } from 'lucide-react';
import OpportunityForm from '../components/OpportunityForm';
import { OpportunityCard } from '../components/OpportunityCard';
import { KanbanColumn } from '../components/KanbanColumn';
import { PageHeader, Button } from '../components/ui';

// ============================================================================
// MAIN SALES PAGE COMPONENT - REFACTORED 2026
// ============================================================================

export default function Sales() {
  const { selectedCompany } = useCompany();
  const navigate = useNavigate();
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [editingOpportunity, setEditingOpportunity] = useState<Opportunity | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedStageId, setSelectedStageId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showLost, setShowLost] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  // Custom collision detection: prioritize stage columns over opportunity cards
  // This fixes the issue where dragging to adjacent columns fails because
  // the collision algorithm picks up cards instead of the column container
  const customCollisionDetection: CollisionDetection = (args) => {
    const isStageId = (id: UniqueIdentifier) => String(id).startsWith('stage-');

    // 1. Try pointerWithin first - most accurate when directly over a target
    const pointerCollisions = pointerWithin(args);
    const stagePointerCollisions = pointerCollisions.filter((c) => isStageId(c.id));
    if (stagePointerCollisions.length > 0) return stagePointerCollisions;

    // 2. Try rectIntersection - detects overlapping rectangles
    const rectCollisions = rectIntersection(args);
    const stageRectCollisions = rectCollisions.filter((c) => isStageId(c.id));
    if (stageRectCollisions.length > 0) return stageRectCollisions;

    // 3. Try closestCenter - finds nearest center point (good fallback)
    const centerCollisions = closestCenter(args);
    const stageCenterCollisions = centerCollisions.filter((c) => isStageId(c.id));
    if (stageCenterCollisions.length > 0) return stageCenterCollisions;

    // 4. Last resort: return any card collision for within-column sorting
    return pointerCollisions;
  };

  useEffect(() => {
    if (selectedCompany) {
      fetchData();
    }
  }, [selectedCompany]);

  if (!selectedCompany) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-text-secondary font-medium">Firma wird geladen...</p>
      </div>
    );
  }

  const fetchData = async () => {
    if (!selectedCompany) return;

    try {
      setIsLoading(true);
      setError(null);

      // Clear existing data to force React re-render
      setStages([]);
      setOpportunities([]);
      setCustomers([]);

      // Fetch stages
      const { data: stagesData, error: stagesError } = await supabase
        .from('pipeline_stages')
        .select('*')
        .eq('company_id', selectedCompany.id)
        .order('position', { ascending: true });

      if (stagesError) throw stagesError;

      // Fetch opportunities
      const { data: oppsData, error: oppsError } = await supabase
        .from('opportunities')
        .select('*')
        .eq('company_id', selectedCompany.id)
        .order('created_at', { ascending: false });

      if (oppsError) throw oppsError;

      // Fetch customers
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('*')
        .eq('company_id', selectedCompany.id)
        .order('name', { ascending: true });

      if (customersError) throw customersError;

      setStages(stagesData || []);
      setOpportunities(oppsData || []);
      setCustomers(customersData || []);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Fehler beim Laden der Pipeline-Daten.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (opportunityData: Omit<Opportunity, 'id' | 'created_at' | 'updated_at'>) => {
    if (!selectedCompany) return;

    try {
      if (editingOpportunity) {
        const { error } = await supabase
          .from('opportunities')
          .update(opportunityData)
          .eq('id', editingOpportunity.id);

        if (error) throw error;
        setEditingOpportunity(null);
      } else {
        const { error } = await supabase
          .from('opportunities')
          .insert([{ ...opportunityData, company_id: selectedCompany.id }] as any);

        if (error) throw error;
      }

      setShowForm(false);
      await fetchData();
    } catch (err) {
      console.error('Error saving opportunity:', err);
      throw err;
    }
  };

  const handleEdit = (opportunity: Opportunity) => {
    setEditingOpportunity(opportunity);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleConvert = async (opportunity: Opportunity) => {
    if (!confirm('Möchten Sie diesen Interessenten als Kunde anlegen?')) return;

    try {
      const { error } = await supabase.rpc('convert_prospect_to_customer', {
        opportunity_id_param: opportunity.id,
      });

      if (error) throw error;

      toast.error('Interessent wurde erfolgreich als Kunde angelegt!');
      await fetchData();
    } catch (err) {
      console.error('Error converting prospect:', err);
      toast.error('Fehler beim Anlegen des Kunden. Bitte versuchen Sie es erneut.');
    }
  };

  const handleAddNew = (stageId: string) => {
    setSelectedStageId(stageId);
    setEditingOpportunity(null);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingOpportunity(null);
    setShowForm(false);
  };

  // Navigate to Angebote page to create a quote for this opportunity
  const handleCreateQuote = (opportunity: Opportunity) => {
    if (opportunity.existing_customer_id) {
      navigate(`/angebote?customerId=${opportunity.existing_customer_id}&opportunityId=${opportunity.id}`);
    }
  };

  // Delete opportunity permanently
  const handleDelete = async (opportunity: Opportunity) => {
    if (!confirm(`Möchten Sie den Deal "${opportunity.title}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('opportunities')
        .delete()
        .eq('id', opportunity.id);

      if (error) throw error;
      await fetchData();
    } catch (err) {
      console.error('Error deleting opportunity:', err);
      toast.error('Fehler beim Löschen des Deals.');
    }
  };

  // Toggle is_lost status
  const handleToggleLost = async (opportunity: Opportunity) => {
    const newIsLost = !opportunity.is_lost;

    // Optimistic update
    setOpportunities((prev) =>
      prev.map((opp) =>
        opp.id === opportunity.id ? { ...opp, is_lost: newIsLost } : opp
      )
    );

    try {
      const { error } = await supabase
        .from('opportunities')
        .update({ is_lost: newIsLost })
        .eq('id', opportunity.id);

      if (error) throw error;
    } catch (err) {
      console.error('Error toggling lost status:', err);
      toast.error('Fehler beim Aktualisieren des Status.');
      await fetchData();
    }
  };

  // BUGFIX: Strict string comparison and immutable update with proper typing
  const handleStageRename = async (stageId: string, newName: string) => {
    if (!selectedCompany) return;

    try {
      const { error } = await supabase
        .from('pipeline_stages')
        .update({ name: newName, updated_at: new Date().toISOString() })
        .eq('id', stageId)
        .eq('company_id', selectedCompany.id);

      if (error) throw error;

      // Immutable update using map
      setStages((prevStages) =>
        prevStages.map((stage) =>
          stage.id === stageId ? { ...stage, name: newName } : stage
        )
      );
    } catch (err) {
      console.error('Error renaming stage:', err);
      toast.error('Fehler beim Umbenennen der Spalte.');
      await fetchData();
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  // BUGFIX: Strict string comparison and immutable array updates
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);

      if (!over || !selectedCompany) return;

      // Ensure IDs are strings for strict comparison
      const opportunityId = String(active.id);
      const opportunity = opportunities.find((opp) => String(opp.id) === opportunityId);

      if (!opportunity) return;

      // Determine target stage
      let targetStageId: string | null = null;
      const overIdString = String(over.id);

      if (overIdString.startsWith('stage-')) {
        targetStageId = overIdString.replace('stage-', '');
      } else {
        // Dropped over another opportunity
        const overOpportunity = opportunities.find((opp) => String(opp.id) === overIdString);
        if (overOpportunity) {
          targetStageId = overOpportunity.stage_id;
        }
      }

      // Strict comparison - if no stage or same stage, do nothing
      if (!targetStageId || String(targetStageId) === String(opportunity.stage_id)) {
        return;
      }

      // Optimistic update with immutable pattern
      const updatedOpportunity: Opportunity = {
        ...opportunity,
        stage_id: targetStageId,
        last_contact_at: new Date().toISOString(),
      };

      setOpportunities((prevOpportunities) =>
        prevOpportunities.map((opp) =>
          String(opp.id) === opportunityId ? updatedOpportunity : opp
        )
      );

      // Update database
      try {
        const { error } = await supabase
          .from('opportunities')
          .update({
            stage_id: targetStageId,
            last_contact_at: new Date().toISOString(),
          })
          .eq('id', opportunityId);

        if (error) throw error;
      } catch (err) {
        console.error('Error moving opportunity:', err);
        toast.error('Fehler beim Verschieben des Deals.');
        // Revert on error
        await fetchData();
      }
    },
    [opportunities, selectedCompany]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-text-secondary font-medium">Lädt...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-danger-light border border-danger/20 rounded-xl p-6">
        <p className="text-danger font-medium">{error}</p>
      </div>
    );
  }

  const activeOpportunity = activeId ? opportunities.find((opp) => String(opp.id) === activeId) : null;
  const activeCustomer = activeOpportunity?.existing_customer_id
    ? customers.find((c) => c.id === activeOpportunity.existing_customer_id)
    : undefined;

  return (
    <div className="h-full flex flex-col">
      {/* Page Header - Swiss Modern */}
      <div className="flex-shrink-0 mb-4">
        <PageHeader
          title="Sales Pipeline"
          description="Verwalten Sie Ihre Akquise-Prozesse im Kanban-Board"
          actions={
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowLost(!showLost)}
                className={`
                  flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
                  transition-colors border
                  ${showLost
                    ? 'bg-sage-100 text-content-body border-sage-300'
                    : 'bg-white text-content-secondary border-surface-border hover:bg-sage-50'
                  }
                `}
                title={showLost ? 'Verlorene Deals ausblenden' : 'Verlorene Deals anzeigen'}
              >
                {showLost ? <Eye size={16} /> : <EyeOff size={16} />}
                <span>{showLost ? 'Verlorene sichtbar' : 'Verlorene ausgeblendet'}</span>
              </button>
              <Button
                variant="primary"
                icon={<Plus size={18} />}
                onClick={() => handleAddNew(stages[0]?.id || '')}
              >
                Neuer Deal
              </Button>
            </div>
          }
        />
      </div>

      {/* Form */}
      {showForm && (
        <div className="flex-shrink-0 mb-4">
          <OpportunityForm
            onSubmit={handleSubmit}
            editingOpportunity={editingOpportunity}
            onCancelEdit={handleCancelEdit}
            customers={customers}
            stageId={selectedStageId}
          />
        </div>
      )}

      {/* Kanban Board - Full Height, Responsive Layout */}
      <DndContext
        sensors={sensors}
        collisionDetection={customCollisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden scrollbar-thin">
          <div className="h-full flex gap-4 pb-2">
            {stages.map((stage) => {
              const stageOpportunities = opportunities.filter(
                (opp) =>
                  String(opp.stage_id) === String(stage.id) &&
                  (showLost || !opp.is_lost)
              );
              return (
                <KanbanColumn
                  key={stage.id}
                  stage={stage}
                  opportunities={stageOpportunities}
                  customers={customers}
                  onEdit={handleEdit}
                  onConvert={handleConvert}
                  onAddNew={handleAddNew}
                  onStageRename={handleStageRename}
                  onCreateQuote={handleCreateQuote}
                  onDelete={handleDelete}
                  onToggleLost={handleToggleLost}
                />
              );
            })}
          </div>
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeOpportunity ? (
            <div className="rotate-2 scale-105">
              <OpportunityCard
                opportunity={activeOpportunity}
                customer={activeCustomer}
                onEdit={() => {}}
                onConvert={() => {}}
                isDragging
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
