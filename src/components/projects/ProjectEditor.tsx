import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import Modal from '../Modal';
import ProjectForm from '../ProjectForm';
import { supabase } from '../../lib/supabase';
import type { Project } from '../../lib/supabase';
import { useCompany } from '../../context/CompanyContext';
import { useCustomers } from '../../hooks/queries';

/** Projekt anlegen oder bearbeiten (Dialog). */
export function ProjectEditor({ project, open, onClose, presetCustomerId }: { project: Project | null; open: boolean; onClose: () => void; presetCustomerId?: string }) {
  const { selectedCompany } = useCompany();
  const { data: customers = [] } = useCustomers();
  const qc = useQueryClient();
  if (!open || !selectedCompany) return null;
  const keep = project?.customer_id ?? presetCustomerId;
  return (
    <Modal isOpen onClose={onClose} title={project ? `Projekt ${project.name} bearbeiten` : 'Neues Projekt'} size="md">
      <ProjectForm
        customers={customers.filter((c) => (c.is_active !== false && !c.is_supplier) || c.id === keep)}
        editingProject={project ?? (presetCustomerId ? ({ name: '', customer_id: presetCustomerId, description: null, status: 'offen', budget: null, hourly_rate: null, is_active: true } as unknown as Project) : null)}
        onCancelEdit={onClose}
        onSubmit={async (data) => {
          await supabase.rpc('set_active_company', { company_id: selectedCompany.id });
          const { error } = project?.id
            ? await supabase.from('projects').update(data).eq('id', project.id)
            : await supabase.from('projects').insert([{ ...data, company_id: selectedCompany.id }]);
          if (error) {
            toast.error(`Projekt nicht gespeichert: ${error.message}`);
            throw error;
          }
          await qc.invalidateQueries({ queryKey: ['projects'] });
          toast.success(`Projekt ${data.name} gespeichert.`);
          onClose();
        }}
      />
    </Modal>
  );
}
