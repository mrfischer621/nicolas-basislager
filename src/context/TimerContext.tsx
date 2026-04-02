import { createContext, useContext, useState, type ReactNode } from 'react';

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
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [description, setDescription] = useState('');
  const [billable, setBillable] = useState(true);

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
