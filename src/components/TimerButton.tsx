import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, Square, ChevronDown, Timer, X } from 'lucide-react';
import { useTimer } from '../context/TimerContext';
import { useCompany } from '../context/CompanyContext';
import { supabase, type Project } from '../lib/supabase';
import Modal from './Modal';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatSeconds(totalSecs: number): string {
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = Math.floor(totalSecs % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function useLiveSeconds(isRunning: boolean, startTime: number | null, elapsedSeconds: number) {
  const [display, setDisplay] = useState(Math.floor(elapsedSeconds));

  useEffect(() => {
    setDisplay(Math.floor(elapsedSeconds));
    if (!isRunning || startTime === null) return;

    const tick = () =>
      setDisplay(Math.floor(elapsedSeconds + (Date.now() - startTime) / 1000));

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isRunning, startTime, elapsedSeconds]);

  return display;
}

// ─── Stop Modal ───────────────────────────────────────────────────────────────

interface StopModalProps {
  isOpen: boolean;
  totalSeconds: number;
  initialProjectId: string;
  initialDescription: string;
  initialBillable: boolean;
  projects: Project[];
  onSave: (data: {
    projectId: string;
    description: string;
    date: string;
    billable: boolean;
    hours: number;
  }) => Promise<void>;
  onCancel: () => void;
}

function StopModal({
  isOpen,
  totalSeconds,
  initialProjectId,
  initialDescription,
  initialBillable,
  projects,
  onSave,
  onCancel,
}: StopModalProps) {
  const [projectId, setProjectId] = useState(initialProjectId);
  const [description, setDescription] = useState(initialDescription);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [billable, setBillable] = useState(initialBillable);
  const [editHours, setEditHours] = useState(0);
  const [editMinutes, setEditMinutes] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setProjectId(initialProjectId);
      setDescription(initialDescription);
      setDate(new Date().toISOString().split('T')[0]);
      setBillable(initialBillable);
      setEditHours(Math.floor(totalSeconds / 3600));
      setEditMinutes(Math.floor((totalSeconds % 3600) / 60));
      setError('');
    }
  }, [isOpen, initialProjectId, initialDescription, initialBillable, totalSeconds]);

  const handleSave = async () => {
    if (!projectId) {
      setError('Bitte ein Projekt auswählen.');
      return;
    }
    const totalMinutes = editHours * 60 + editMinutes;
    if (totalMinutes <= 0) {
      setError('Die erfasste Zeit muss grösser als 0 Minuten sein.');
      return;
    }
    const hours = Math.round((totalMinutes / 60) * 100) / 100;
    setIsSaving(true);
    setError('');
    try {
      await onSave({ projectId, description, date, billable, hours });
    } catch {
      setError('Fehler beim Speichern. Bitte erneut versuchen.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onCancel} title="Zeiteintrag speichern" size="sm">
      <div className="space-y-4">
        {/* Editable time */}
        <div className="bg-slate-50 rounded-lg px-4 py-3">
          <p className="text-xs text-text-secondary mb-2">Erfasste Zeit (anpassbar)</p>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="block text-xs text-text-secondary mb-1">Stunden</label>
              <input
                type="number"
                min={0}
                max={23}
                value={editHours}
                onChange={(e) => setEditHours(Math.max(0, Math.floor(Number(e.target.value))))}
                className="input w-full text-center text-lg font-mono font-semibold"
              />
            </div>
            <span className="text-2xl font-mono text-text-secondary mt-4">:</span>
            <div className="flex-1">
              <label className="block text-xs text-text-secondary mb-1">Minuten</label>
              <input
                type="number"
                min={0}
                max={59}
                value={editMinutes}
                onChange={(e) => {
                  const val = Math.max(0, Math.min(59, Math.floor(Number(e.target.value))));
                  setEditMinutes(val);
                }}
                className="input w-full text-center text-lg font-mono font-semibold"
              />
            </div>
          </div>
          <p className="text-xs text-text-secondary mt-2 text-right">
            = {(Math.round(((editHours * 60 + editMinutes) / 60) * 100) / 100).toFixed(2)} Std.
          </p>
        </div>

        {/* Project */}
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1">
            Projekt <span className="text-red-500">*</span>
          </label>
          <select
            value={projectId}
            onChange={(e) => { setProjectId(e.target.value); setError(''); }}
            className="input w-full"
          >
            <option value="">Projekt wählen...</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1">
            Tätigkeit
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Beschreibung der Tätigkeit..."
            className="input w-full"
          />
        </div>

        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1">
            Datum
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input w-full"
          />
        </div>

        {/* Billable */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={billable}
            onChange={(e) => setBillable(e.target.checked)}
            className="w-4 h-4 rounded accent-brand"
          />
          <span className="text-sm text-text-primary">Verrechenbar</span>
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="btn-primary flex-1"
          >
            {isSaving ? 'Speichern...' : 'Speichern'}
          </button>
          <button onClick={onCancel} disabled={isSaving} className="btn-secondary flex-1">
            Abbrechen
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Pre-Config Dropdown ──────────────────────────────────────────────────────

interface PreConfigDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLDivElement | null>;
  projects: Project[];
  initialProjectId: string;
  initialDescription: string;
  initialBillable: boolean;
  onStart: (projectId: string, description: string, billable: boolean) => void;
}

function PreConfigDropdown({
  isOpen,
  onClose,
  anchorRef,
  projects,
  initialProjectId,
  initialDescription,
  initialBillable,
  onStart,
}: PreConfigDropdownProps) {
  const [projectId, setProjectId] = useState(initialProjectId);
  const [description, setDescription] = useState(initialDescription);
  const [billable, setBillable] = useState(initialBillable);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setProjectId(initialProjectId);
      setDescription(initialDescription);
      setBillable(initialBillable);
    }
  }, [isOpen, initialProjectId, initialDescription, initialBillable]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current?.contains(e.target as Node) ||
        anchorRef.current?.contains(e.target as Node)
      )
        return;
      onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, onClose, anchorRef]);

  if (!isOpen) return null;

  return (
    <div
      ref={dropdownRef}
      className="
        absolute right-0 top-full mt-2
        w-72 bg-white rounded-xl shadow-floating border border-surface-border
        z-50 animate-fade-in p-4 space-y-3
      "
    >
      <p className="text-sm font-semibold text-text-primary">Timer vorkonfigurieren</p>

      {/* Project */}
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1">Projekt</label>
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="input w-full text-sm"
        >
          <option value="">Kein Projekt</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1">Tätigkeit</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Was machst du gerade?"
          className="input w-full text-sm"
        />
      </div>

      {/* Billable */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={billable}
          onChange={(e) => setBillable(e.target.checked)}
          className="w-4 h-4 rounded accent-brand"
        />
        <span className="text-sm text-text-primary">Verrechenbar</span>
      </label>

      <button
        onClick={() => {
          onStart(projectId, description, billable);
          onClose();
        }}
        className="btn-primary w-full"
      >
        Timer starten
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TimerButton() {
  const timer = useTimer();
  const { selectedCompany } = useCompany();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isStopModalOpen, setIsStopModalOpen] = useState(false);
  const [frozenSeconds, setFrozenSeconds] = useState(0);
  const [projects, setProjects] = useState<Project[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);

  // Live seconds display
  const displaySeconds = useLiveSeconds(timer.isRunning, timer.startTime, timer.elapsedSeconds);

  // Reset projects cache when company changes
  useEffect(() => {
    setProjects([]);
  }, [selectedCompany?.id]);

  // Load active projects (lazy, on dropdown/stop-modal open)
  const loadProjects = useCallback(async () => {
    if (!selectedCompany || projects.length > 0) return;
    const { data } = await supabase
      .from('projects')
      .select('id, name, status, is_active')
      .eq('company_id', selectedCompany.id)
      .eq('is_active', true)
      .order('name');
    if (data) setProjects(data as Project[]);
  }, [selectedCompany, projects.length]);

  const handleChevronClick = () => {
    if (!isDropdownOpen) loadProjects();
    setIsDropdownOpen((v) => !v);
  };

  const handlePlayClick = () => {
    if (timer.isPaused) {
      timer.resumeTimer();
    } else if (!timer.isRunning) {
      timer.startTimer(timer.selectedProjectId, timer.description, timer.billable);
    }
  };

  const handlePauseClick = () => {
    timer.pauseTimer();
  };

  const handleStopClick = () => {
    loadProjects();
    const total = timer.stopTimer();
    setFrozenSeconds(Math.floor(total));
    setIsStopModalOpen(true);
  };

  const handleSave = async (data: {
    projectId: string;
    description: string;
    date: string;
    billable: boolean;
    hours: number;
  }) => {
    if (!selectedCompany) throw new Error('Keine Firma ausgewählt');

    // Resolve rate via RPC
    let rate = 160;
    let snapshotSource: 'project' | 'customer' | 'default' | 'manual' = 'default';

    const { data: rateData } = await supabase.rpc('resolve_hourly_rate', {
      p_project_id: data.projectId,
      p_default_rate: 160,
    });
    if (rateData && rateData.length > 0) {
      rate = rateData[0].rate;
      snapshotSource = rateData[0].source as typeof snapshotSource;
    }

    const hours = data.hours;

    const { error } = await supabase.from('time_entries').insert({
      company_id: selectedCompany.id,
      project_id: data.projectId,
      date: data.date,
      hours,
      rate,
      snapshot_source: snapshotSource,
      description: data.description || null,
      billable: data.billable,
      invoiced: false,
      invoice_id: null,
    });

    if (error) throw error;

    setIsStopModalOpen(false);
    timer.resetTimer();
  };

  const handleCancelStop = () => {
    setIsStopModalOpen(false);
    // Don't resume – user explicitly stopped, timer is at rest
    // They can manually click play to start a new session
  };

  const isActive = timer.isRunning || timer.isPaused;

  return (
    <div className="relative flex items-center gap-1" ref={containerRef}>
      {/* Live time display */}
      {isActive && (
        <span
          className={`
            text-sm font-mono font-semibold tabular-nums px-2 py-1 rounded-md
            ${timer.isRunning ? 'text-emerald-700 bg-emerald-50' : 'text-amber-700 bg-amber-50'}
          `}
        >
          {formatSeconds(displaySeconds)}
        </span>
      )}

      {/* Play/Pause button */}
      <button
        onClick={timer.isRunning ? handlePauseClick : handlePlayClick}
        title={timer.isRunning ? 'Pausieren' : timer.isPaused ? 'Fortsetzen' : 'Timer starten'}
        className={`
          p-2 rounded-lg transition-colors duration-150
          ${
            timer.isRunning
              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
              : timer.isPaused
              ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
              : 'bg-slate-100 text-text-secondary hover:bg-slate-200 hover:text-text-primary'
          }
        `}
      >
        {timer.isRunning ? (
          <Pause size={16} strokeWidth={2} />
        ) : timer.isPaused ? (
          <Play size={16} strokeWidth={2} />
        ) : (
          <Timer size={16} strokeWidth={2} />
        )}
      </button>

      {/* Stop button (only when active) */}
      {isActive && (
        <button
          onClick={handleStopClick}
          title="Timer stoppen & speichern"
          className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors duration-150"
        >
          <Square size={16} strokeWidth={2} fill="currentColor" />
        </button>
      )}

      {/* Chevron dropdown button (only when not active) */}
      {!isActive && (
        <button
          onClick={handleChevronClick}
          title="Timer vorkonfigurieren"
          className="p-2 rounded-lg bg-slate-100 text-text-secondary hover:bg-slate-200 hover:text-text-primary transition-colors duration-150"
        >
          <ChevronDown
            size={14}
            strokeWidth={2}
            className={`transition-transform duration-150 ${isDropdownOpen ? 'rotate-180' : ''}`}
          />
        </button>
      )}

      {/* X button to cancel when not active but was started (paused seconds remain) */}
      {!isActive && (timer.elapsedSeconds > 0) && (
        <button
          onClick={() => timer.resetTimer()}
          title="Timer zurücksetzen"
          className="p-2 rounded-lg bg-slate-100 text-text-secondary hover:bg-red-50 hover:text-red-500 transition-colors duration-150"
        >
          <X size={14} strokeWidth={2} />
        </button>
      )}

      {/* Pre-config dropdown */}
      <PreConfigDropdown
        isOpen={isDropdownOpen}
        onClose={() => setIsDropdownOpen(false)}
        anchorRef={containerRef}
        projects={projects}
        initialProjectId={timer.selectedProjectId}
        initialDescription={timer.description}
        initialBillable={timer.billable}
        onStart={(projectId, description, billable) => {
          timer.startTimer(projectId, description, billable);
        }}
      />

      {/* Stop modal */}
      <StopModal
        isOpen={isStopModalOpen}
        totalSeconds={frozenSeconds}
        initialProjectId={timer.selectedProjectId}
        initialDescription={timer.description}
        initialBillable={timer.billable}
        projects={projects}
        onSave={handleSave}
        onCancel={handleCancelStop}
      />
    </div>
  );
}
