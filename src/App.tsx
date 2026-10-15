import { lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import BentoLayout from './components/BentoLayout';
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';
import { legacyTarget } from './routes/legacy';

// Seiten werden erst beim Aufruf geladen
const Cockpit = lazy(() => import('./pages/Cockpit'));
const Pipeline = lazy(() => import('./pages/Pipeline'));
const Leads = lazy(() => import('./pages/Leads'));
const FirmaDetail = lazy(() => import('./pages/FirmaDetail'));
const Kontakte = lazy(() => import('./pages/Kontakte'));
const Projekte = lazy(() => import('./pages/Projekte'));
const ProjektDetail = lazy(() => import('./pages/ProjektDetail'));
const Zeiterfassung = lazy(() => import('./pages/Zeiterfassung'));
const Offerten = lazy(() => import('./pages/Offerten'));
const OfferteDetail = lazy(() => import('./pages/OfferteDetail'));
const Rechnungen = lazy(() => import('./pages/Rechnungen'));
const RechnungDetail = lazy(() => import('./pages/RechnungDetail'));
const Buchungen = lazy(() => import('./pages/Buchungen'));
const Berichte = lazy(() => import('./pages/Berichte'));
const Einstellungen = lazy(() => import('./pages/Einstellungen'));

/** Alte URL auf die neue Struktur umleiten (Lesezeichen), Parameter bleiben. */
function Legacy({ fallback }: { fallback: string }) {
  const location = useLocation();
  return <Navigate to={legacyTarget(location.pathname, location.search) ?? fallback} replace />;
}

/** Rechnungen: alter Filter-Link ?filter=ohne-zahlungsdatum wird umgeschrieben. */
function RechnungenRoute() {
  const location = useLocation();
  const target = legacyTarget(location.pathname, location.search);
  return target ? <Navigate to={target} replace /> : <Rechnungen />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        {/* /register gibt es seit dem 15. Oktober 2026 nicht mehr: Konten legt
            der Administrator in Supabase an, Sign-ups sind dort abgeschaltet. */}
        <Route path="/register" element={<Navigate to="/login" replace />} />

        {/* Protected routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <BentoLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Cockpit />} />
          <Route path="kontakte" element={<Kontakte />} />
          <Route path="kontakte/firmen/:id" element={<FirmaDetail />} />
          <Route path="leads" element={<Leads />} />
          <Route path="pipeline" element={<Pipeline />} />
          <Route path="offerten" element={<Offerten />} />
          <Route path="offerten/:id" element={<OfferteDetail />} />
          <Route path="projekte" element={<Projekte />} />
          <Route path="projekte/:id" element={<ProjektDetail />} />
          <Route path="zeiterfassung" element={<Zeiterfassung />} />
          <Route path="rechnungen" element={<RechnungenRoute />} />
          <Route path="rechnungen/:id" element={<RechnungDetail />} />
          <Route path="buchungen" element={<Buchungen />} />
          <Route path="berichte" element={<Berichte />} />
          <Route path="einstellungen" element={<Navigate to="/einstellungen/unternehmen" replace />} />
          <Route path="einstellungen/:bereich" element={<Einstellungen />} />

          {/* Alte Adressen (vor Oktober 2026) */}
          <Route path="sales" element={<Legacy fallback="/pipeline" />} />
          <Route path="angebote" element={<Legacy fallback="/offerten" />} />
          <Route path="kunden" element={<Legacy fallback="/kontakte" />} />
          <Route path="kunden/:id" element={<Legacy fallback="/kontakte" />} />
          <Route path="kunden/:id/kontakte" element={<Legacy fallback="/kontakte" />} />
          <Route path="produkte" element={<Legacy fallback="/einstellungen/leistungen" />} />
          <Route path="auswertungen" element={<Legacy fallback="/berichte" />} />
          <Route path="jahresabschluss" element={<Legacy fallback="/berichte" />} />
          <Route path="settings" element={<Legacy fallback="/einstellungen" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
