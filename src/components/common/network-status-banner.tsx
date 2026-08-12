import React from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { useNetworkStatus } from '@/src/hooks/use-network-status';

export function NetworkStatusBanner() {
  const { status, isChecking, checkPing } = useNetworkStatus();

  const isVisible = status === 'offline' || status === 'reconnected';
  const isOffline = status === 'offline';

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-0 left-0 right-0 z-[9999] px-4 py-2 text-sm font-medium text-white shadow-md transition-all duration-300 ease-in-out flex items-center justify-between ${
        isVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0 pointer-events-none'
      } ${isOffline ? 'bg-amber-600' : 'bg-emerald-600'}`}
    >
      <div className="flex items-center gap-2">
        {isOffline ? (
          <>
            <WifiOff className="h-4 w-4 shrink-0" />
            <span>Mất kết nối mạng. Bạn đang ở chế độ ngoại tuyến.</span>
          </>
        ) : (
          <>
            <Wifi className="h-4 w-4 shrink-0" />
            <span>Đã khôi phục kết nối internet!</span>
          </>
        )}
      </div>

      {isOffline && (
        <button
          type="button"
          onClick={() => checkPing()}
          disabled={isChecking}
          className="inline-flex items-center gap-1.5 rounded bg-amber-700/80 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-800 disabled:opacity-50 transition-colors cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isChecking ? 'animate-spin' : ''}`} />
          Thử lại
        </button>
      )}
    </div>
  );
}
