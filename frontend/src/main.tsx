import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ClerkAuthProvider } from './components/auth/ClerkAuthProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkAuthProvider>
      <App />
    </ClerkAuthProvider>
  </StrictMode>,
)
