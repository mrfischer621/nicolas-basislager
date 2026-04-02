import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './context/AuthProvider'
import { CompanyProvider } from './context/CompanyContext'
import { TimerProvider } from './context/TimerContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <CompanyProvider>
        <TimerProvider>
          <App />
        </TimerProvider>
      </CompanyProvider>
    </AuthProvider>
  </StrictMode>,
)
