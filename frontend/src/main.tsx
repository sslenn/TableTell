import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ClerkAuthProvider } from './components/auth/ClerkAuthProvider'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import { logger } from './lib/logger'
import { ApiError } from './lib/api'
import { toast } from './store/useToastStore'

// Last-resort handlers for errors that React cannot catch (async code, event handlers).
window.addEventListener('unhandledrejection', (event) => {
  // Cancelled requests are expected when a user navigates or stops a stream.
  if (event.reason instanceof ApiError && event.reason.kind === 'aborted') return;
  if (event.reason instanceof DOMException && event.reason.name === 'AbortError') return;

  logger.error('Unhandled promise rejection', event.reason);
  toast.error('Something went wrong', 'An action did not finish. Try again, and reload the page if it keeps happening.');
});

window.addEventListener('error', (event) => {
  // Ignore benign browser noise that carries no error object.
  if (!event.error) return;
  logger.error('Uncaught error', event.error);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary
      fallbackTitle="TableTell could not start"
      fallbackMessage="The app hit an unexpected error. Reload the page. If the problem continues, check your connection or contact your administrator."
    >
      <ClerkAuthProvider>
        <App />
      </ClerkAuthProvider>
    </ErrorBoundary>
  </StrictMode>,
)
