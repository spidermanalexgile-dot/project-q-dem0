import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { DestinationProvider } from './context/DestinationContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DestinationProvider>
      <App />
    </DestinationProvider>
  </StrictMode>,
)
