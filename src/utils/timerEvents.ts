/** Ereignis: laufenden Timer stoppen und den Speichern-Dialog oeffnen
 * (Timer-Leiste auf dem Handy; der Dialog lebt im TimerButton). */
export const STOP_TIMER_EVENT = 'bw:timer-stoppen';

export function requestTimerStop(): void {
  window.dispatchEvent(new Event(STOP_TIMER_EVENT));
}
