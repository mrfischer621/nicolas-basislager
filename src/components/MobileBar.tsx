import { NavLink } from 'react-router-dom';
import { Camera, Clock, LayoutDashboard, Pause, Play, Search, Square } from 'lucide-react';
import { openCommandPalette } from '../utils/palette';
import { requestTimerStop } from '../utils/timerEvents';
import { useTimer } from '../context/TimerContext';
import { formatSeconds, useLiveSeconds } from '../hooks/useLiveSeconds';

/**
 * Leiste unten auf dem Handy: die Ablaeufe unterwegs (Cockpit, Zeit
 * erfassen, Beleg fotografieren) und die Suche. Laeuft ein Timer, steht
 * darueber eine schmale Timer-Leiste mit Pause und Stopp.
 */
export function MobileBar() {
  const cls = ({ isActive }: { isActive: boolean }) =>
    `flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-[12px] font-semibold ${isActive ? 'text-fg' : 'text-fg-muted'}`;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 md:hidden">
      <TimerStrip />
      <nav aria-label="Schnellzugriff" className="flex border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
        <NavLink to="/" end className={cls}>
          <LayoutDashboard size={22} strokeWidth={1.5} aria-hidden="true" />
          Cockpit
        </NavLink>
        <NavLink to="/zeiterfassung?neu=1" className={cls}>
          <Clock size={22} strokeWidth={1.5} aria-hidden="true" />
          Zeit erfassen
        </NavLink>
        <NavLink to="/buchungen?neu=1" className={cls}>
          <Camera size={22} strokeWidth={1.5} aria-hidden="true" />
          Beleg
        </NavLink>
        <button type="button" onClick={openCommandPalette} className={cls({ isActive: false })}>
          <Search size={22} strokeWidth={1.5} aria-hidden="true" />
          Suche
        </button>
      </nav>
    </div>
  );
}

/** Laufender oder pausierter Timer, sichtbar auf jeder Seite. */
function TimerStrip() {
  const timer = useTimer();
  const seconds = useLiveSeconds(timer.isRunning, timer.startTime, timer.elapsedSeconds);
  if (!timer.isRunning && !timer.isPaused) return null;
  const btn = 'tap rounded-lg border border-line-strong bg-surface text-fg hover:bg-raised';
  return (
    <div role="region" aria-label="Timer" className="flex items-center gap-3 border-t border-line bg-raised px-4 py-1.5">
      <span className={timer.isRunning ? 'badge-positive' : 'badge-warning'}>{timer.isRunning ? 'Läuft' : 'Pausiert'}</span>
      <span className="font-display text-lg font-black tabular-nums text-fg" aria-live="off">
        {formatSeconds(seconds)}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm text-fg-muted">{timer.description}</span>
      {timer.isRunning ? (
        <button type="button" className={btn} onClick={timer.pauseTimer} aria-label="Timer pausieren">
          <Pause size={18} strokeWidth={1.5} aria-hidden="true" />
        </button>
      ) : (
        <button type="button" className={btn} onClick={timer.resumeTimer} aria-label="Timer fortsetzen">
          <Play size={18} strokeWidth={1.5} aria-hidden="true" />
        </button>
      )}
      <button type="button" className={btn} onClick={requestTimerStop} aria-label="Timer stoppen und speichern">
        <Square size={18} strokeWidth={1.5} aria-hidden="true" />
      </button>
    </div>
  );
}
