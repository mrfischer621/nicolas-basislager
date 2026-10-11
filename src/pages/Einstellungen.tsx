import { NavLink, Navigate, useNavigate, useParams } from 'react-router-dom';
import Settings from './Settings';
import Produkte from './Produkte';
import { GoalsSettings } from '../components/settings/GoalsSettings';
import { BillingDefaults } from '../components/settings/BillingDefaults';
import { BankBalancesSettings } from '../components/settings/BankBalancesSettings';
import { DeadlinesSettings } from '../components/settings/DeadlinesSettings';
import { PipelineStagesSettings } from '../components/settings/PipelineStagesSettings';
import { ThemeSettings } from '../components/settings/ThemeSettings';

// Bereiche mit eigener URL /einstellungen/<bereich> (Konzept 6.11)
const SECTIONS = [
  { id: 'unternehmen', label: 'Unternehmen und Logo' },
  { id: 'ziele', label: 'Ziele und Schätzungen' },
  { id: 'kontostaende', label: 'Kontostände' },
  { id: 'fristen', label: 'Fristen' },
  { id: 'rechnungen-offerten', label: 'Rechnungen und Offerten' },
  { id: 'leistungen', label: 'Leistungen und Produkte' },
  { id: 'kategorien', label: 'Kategorien und Konten' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'darstellung', label: 'Darstellung' },
  { id: 'benutzer', label: 'Benutzer' },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'];

function Content({ section }: { section: SectionId }) {
  switch (section) {
    case 'unternehmen':
      return <Settings section="company" />;
    case 'ziele':
      return <GoalsSettings />;
    case 'kontostaende':
      return <BankBalancesSettings />;
    case 'fristen':
      return <DeadlinesSettings />;
    case 'rechnungen-offerten':
      return (
        <div className="space-y-6">
          <BillingDefaults />
          <Settings section="templates" />
        </div>
      );
    case 'leistungen':
      return (
        <div className="space-y-6">
          <section className="card p-5 md:p-7">
            <Produkte />
          </section>
          <Settings section="product_categories" />
        </div>
      );
    case 'kategorien':
      return <Settings section="categories" />;
    case 'pipeline':
      return <PipelineStagesSettings />;
    case 'darstellung':
      return <ThemeSettings />;
    case 'benutzer':
      return <Settings section="profile" />;
  }
}

/** Einstellungen mit linker Unternavigation; auf dem Handy als Auswahlliste. */
export default function Einstellungen() {
  const { bereich } = useParams();
  const navigate = useNavigate();
  const current = SECTIONS.find((s) => s.id === bereich);
  if (!current) return <Navigate to="/einstellungen/unternehmen" replace />;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="page-title">Einstellungen</h1>
        <p className="mt-2 text-sm text-fg-muted">Gilt für das gewählte Unternehmen, ausser Darstellung und Benutzer.</p>
      </header>
      <div className="grid gap-6 lg:grid-cols-[14rem_1fr]">
        <nav aria-label="Bereiche der Einstellungen" className="lg:sticky lg:top-0 lg:self-start">
          <label className="lg:hidden">
            <span className="sr-only">Bereich</span>
            <select className="input" value={current.id} onChange={(e) => navigate(`/einstellungen/${e.target.value}`)}>
              {SECTIONS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <ul className="hidden space-y-0.5 lg:block">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <NavLink
                  to={`/einstellungen/${s.id}`}
                  className={({ isActive }) =>
                    `block rounded-lg px-3 py-2 text-sm transition-colors ${isActive ? 'bg-accent-subtle font-semibold text-fg shadow-[inset_3px_0_0_rgb(var(--bw-cta))]' : 'text-fg-muted hover:bg-raised hover:text-fg'}`
                  }
                >
                  {s.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0">
          <Content section={current.id} />
        </div>
      </div>
    </div>
  );
}
