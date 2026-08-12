import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './context/AuthProvider'
import { CompanyProvider } from './context/CompanyContext'
import { TimerProvider } from './context/TimerContext'
import { ConfirmProvider } from './context/ConfirmProvider'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stammdaten aendern sich selten - eine Minute frisch halten, statt sie
      // bei jedem Seitenwechsel neu zu laden
      staleTime: 60_000,
      // Beim Firmenwechsel wird der Cache gezielt geleert (siehe CompanyContext),
      // ein Neuladen bei jedem Fensterfokus ist deshalb unnoetig
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <CompanyProvider>
        <TimerProvider>
          <ConfirmProvider>
            <App />
          </ConfirmProvider>
          {/* Ohne diese Komponente rendert react-hot-toast nichts. Sie fehlte,
              wodurch saemtliche toast()-Aufrufe in 6 Seiten wirkungslos waren. */}
          <Toaster
            position="bottom-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#0f172a',
                color: '#f8fafc',
                fontSize: '14px',
                borderRadius: '8px',
              },
              success: { iconTheme: { primary: '#22c55e', secondary: '#0f172a' } },
              error: { duration: 6000, iconTheme: { primary: '#ef4444', secondary: '#0f172a' } },
            }}
          />
        </TimerProvider>
      </CompanyProvider>
    </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
