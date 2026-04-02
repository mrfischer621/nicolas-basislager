import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

const STORAGE_KEY = 'basislager_timer';

interface PersistedState {
  isRunning: boolean;
  isPaused: boolean;
  startTime: number | null;
  elapsedSeconds: number;
  selectedProjectId: string;
  description: string;
  billable: boolean;
}

const DEFAULT_STATE: PersistedState = {
  isRunning: false,
  isPaused: false,
  startTime: null,
  elapsedSeconds: 0,
  selectedProjectId: '',
  description: '',
  billable: true,
};

function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed: PersistedState = { ...DEFAULT_STATE, ...JSON.parse(raw) };

    // If the timer was running when the page was closed, recalculate elapsed time
    if (parsed.isRunning && parsed.startTime !== null) {
      const missedSeconds = (Date.now() - parsed.startTime) / 1000;
      parsed.elapsedSeconds += missedSeconds;
      parsed.startTime = Date.now(); // reset startTime to now so the interval is correct
    }

    return parsed;
  } catch {
    return DEFAULT_STATE;
  }
}

interface TimerContextValue {
  isRunning: boolean;
  isPaused: boolean;
  startTime: number | null;
  elapsedSeconds: number;
  selectedProjectId: string;
  description: string;
  billable: boolean;
  startTimer: (projectId?: string, description?: string, billable?: boolean) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  /** Freezes elapsed time and returns total seconds. Call resetTimer() after saving. */
  stopTimer: () => number;
  resetTimer: () => void;
  updateConfig: (projectId: string, description: string, billable: boolean) => void;
}

const TimerContext = createContext<TimerContextValue | null>(null);

export function TimerProvider({ children }: { children: ReactNode }) {
  const initial = loadState();
  const [isRunning, setIsRunning] = useState(initial.isRunning);
  const [isPaused, setIsPaused] = useState(initial.isPaused);
  const [startTime, setStartTime] = useState<number | null>(initial.startTime);
  const [elapsedSeconds, setElapsedSeconds] = useState(initial.elapsedSeconds);
  const [selectedProjectId, setSelectedProjectId] = useState(initial.selectedProjectId);
  const [description, setDescription] = useState(initial.description);
  const [billable, setBillable] = useState(initial.billable);

  // Persist state to localStorage on every change
  useEffect(() => {
    const state: PersistedState = {
      isRunning,
      isPaused,
      startTime,
      elapsedSeconds,
      selectedProjectId,
      description,
      billable,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [isRunning, isPaused, startTime, elapsedSeconds, selectedProjectId, description, billable]);

  const getCurrentTotal = (st = startTime, elapsed = elapsedSeconds): number => {
    if (st !== null) return elapsed + (Date.now() - st) / 1000;
    return elapsed;
  };

  const startTimer = (projectId = '', desc = '', bill = true) => {
    setSelectedProjectId(projectId);
    setDescription(desc);
    setBillable(bill);
    setElapsedSeconds(0);
    setStartTime(Date.now());
    setIsRunning(true);
    setIsPaused(false);
  };

  const pauseTimer = () => {
    if (!isRunning || startTime === null) return;
    setElapsedSeconds(getCurrentTotal());
    setStartTime(null);
    setIsRunning(false);
    setIsPaused(true);
  };

  const resumeTimer = () => {
    if (!isPaused) return;
    setStartTime(Date.now());
    setIsRunning(true);
    setIsPaused(false);
  };

  const stopTimer = (): number => {
    const total = getCurrentTotal();
    setElapsedSeconds(total);
    setStartTime(null);
    setIsRunning(false);
    setIsPaused(false);
    return total;
  };

  const resetTimer = () => {
    setIsRunning(false);
    setIsPaused(false);
    setElapsedSeconds(0);
    setStartTime(null);
    setSelectedProjectId('');
    setDescription('');
    setBillable(true);
    localStorage.removeItem(STORAGE_KEY);
  };

  const updateConfig = (projectId: string, desc: string, bill: boolean) => {
    setSelectedProjectId(projectId);
    setDescription(desc);
    setBillable(bill);
  };

  return (
    <TimerContext.Provider
      value={{
        isRunning,
        isPaused,
        startTime,
        elapsedSeconds,
        selectedProjectId,
        description,
        billable,
        startTimer,
        pauseTimer,
        resumeTimer,
        stopTimer,
        resetTimer,
        updateConfig,
      }}
    >
      {children}
    </TimerContext.Provider>
  );
}

export function useTimer() {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error('useTimer must be used within TimerProvider');
  return ctx;
}
