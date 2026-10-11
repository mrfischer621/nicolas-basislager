import { SegmentedControl } from '../components/ui';
import { useListState } from '../components/list';
import Kunden from './Kunden';
import AlleKontakte from './AlleKontakte';

/** Kontakte: Firmen und Personen auf einer Seite mit Umschalter. */
export default function Kontakte() {
  const { state, set } = useListState({ ansicht: 'firmen' });
  const view = state.ansicht === 'personen' ? 'personen' : 'firmen';
  return (
    <div className="space-y-5">
      <SegmentedControl
        label="Ansicht"
        value={view}
        onChange={(v) => set({ ansicht: v }, { push: true })}
        options={[
          { value: 'firmen', label: 'Firmen' },
          { value: 'personen', label: 'Personen' },
        ]}
      />
      {view === 'personen' ? <AlleKontakte /> : <Kunden />}
    </div>
  );
}
