import { useState, useEffect, useCallback } from 'react';

export type NetworkStatusType = 'online' | 'offline' | 'reconnected';

export interface UseNetworkStatusReturn {
  status: NetworkStatusType;
  isChecking: boolean;
  checkPing: () => Promise<void>;
}

export function useNetworkStatus(): UseNetworkStatusReturn {
  const [status, setStatus] = useState<NetworkStatusType>(() =>
    typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'online'
  );
  const [isChecking, setIsChecking] = useState<boolean>(false);

  const checkPing = useCallback(async () => {
    setIsChecking(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    try {
      const response = await fetch('/favicon.ico', {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok || response.status === 304 || response.status === 404) {
        setStatus((prev) => {
          if (prev === 'offline') {
            setTimeout(() => {
              setStatus('online');
            }, 2500);
            return 'reconnected';
          }
          return 'online';
        });
      } else {
        setStatus('offline');
      }
    } catch {
      setStatus('offline');
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      checkPing();
    };

    const handleOffline = () => {
      setStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [checkPing]);

  // Heartbeat ping 10s khi offline
  useEffect(() => {
    if (status !== 'offline') return;

    const interval = setInterval(() => {
      if (!document.hidden) {
        checkPing();
      }
    }, 10000);

    const handleVisibilityChange = () => {
      if (!document.hidden && status === 'offline') {
        checkPing();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [status, checkPing]);

  return { status, isChecking, checkPing };
}
