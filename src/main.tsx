import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { DestinationProvider } from './context/DestinationContext'
import { DayTripperProvider } from './context/DayTripperContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DestinationProvider>
      <DayTripperProvider>
        <App />
      </DayTripperProvider>
    </DestinationProvider>
  </StrictMode>,
)
