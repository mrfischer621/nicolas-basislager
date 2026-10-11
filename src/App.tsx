import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import BentoLayout from './components/BentoLayout';
import Cockpit from './pages/Cockpit';
import Pipeline from './pages/Pipeline';
import Leads from './pages/Leads';
import KundenDetail from './pages/KundenDetail';
import Kontakte from './pages/Kontakte';
import Projekte from './pages/Projekte';
import Zeiterfassung from './pages/Zeiterfassung';
import Angebote from './pages/Angebote';
import Rechnungen from './pages/Rechnungen';
import RechnungDetail from './pages/RechnungDetail';
import Buchungen from './pages/Buchungen';
import Berichte from './pages/Berichte';
import Einstellungen from './pages/Einstellungen';
import Login from './pages/Login';
import Register from './pages/Register';
import ProtectedRoute from './components/ProtectedRoute';
import { legacyTarget } from './routes/legacy';

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
        <Route path="/register" element={<Register />} />

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
          <Route path="kontakte/firmen/:id" element={<KundenDetail />} />
          <Route path="leads" element={<Leads />} />
          <Route path="pipeline" element={<Pipeline />} />
          <Route path="offerten" element={<Angebote />} />
          <Route path="projekte" element={<Projekte />} />
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
