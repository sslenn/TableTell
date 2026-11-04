import { useSyncExternalStore } from 'react';
import { WifiOff } from 'lucide-react';

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

const getSnapshot = () => navigator.onLine;
const getServerSnapshot = () => true;

function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Announces loss of connection to everyone, including screen reader users. */
export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div
      role="alert"
      className="shrink-0 flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border-b border-amber-500/30"
    >
      <WifiOff className="w-3.5 h-3.5" aria-hidden="true" />
      <span>You are offline. Changes and new analyses will not run until you reconnect.</span>
    </div>
  );
}
