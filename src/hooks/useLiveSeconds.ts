import { useEffect, useState } from 'react';

/** Sekunden als HH:MM:SS */
export function formatSeconds(totalSecs: number): string {
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = Math.floor(totalSecs % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function useLiveSeconds(isRunning: boolean, startTime: number | null, elapsedSeconds: number) {
  // Aktuelle Zeit als State, vom Intervall fortgeschrieben (kein setState
  // synchron im Effekt, kein Date.now() waehrend des Renderns)
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isRunning || startTime === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    const first = setTimeout(() => setNow(Date.now()), 0);
    return () => {
      clearInterval(id);
      clearTimeout(first);
    };
  }, [isRunning, startTime]);

  if (!isRunning || startTime === null) return Math.floor(elapsedSeconds);
  return Math.max(Math.floor(elapsedSeconds), Math.floor(elapsedSeconds + (now - startTime) / 1000));
}
