import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './context/AuthProvider'
import { CompanyProvider } from './context/CompanyContext'
import { TimerProvider } from './context/TimerContext'
import { ConfirmProvider } from './context/ConfirmProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
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
  </StrictMode>,
)
