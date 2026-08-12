# Network Status Sticky Banner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Triển khai thanh cảnh báo trạng thái kết nối mạng (Sticky Top Network Status Banner) hiển thị cố định ở mép trên màn hình khi rớt mạng hoặc khi kết nối lại, kèm nút "Thử lại" và cơ chế ping hybrid.

**Architecture:** Tạo custom hook `useNetworkStatus` xử lý sự kiện browser + hybrid ping API, bọc trong component giao diện `<NetworkStatusBanner />` đặt tại root layout (`src/app.tsx`).

**Tech Stack:** React 19, TypeScript, TailwindCSS v4, Lucide React, Vitest, Testing Library.

## Global Constraints

- **Language / Style**: React 19, TypeScript strict mode, TailwindCSS utilities.
- **Icon Library**: `lucide-react` (`Wifi`, `WifiOff`, `RefreshCw`).
- **Ping endpoint**: `GET /favicon.ico` với `cache: 'no-store'` và timeout 3000ms.
- **Positioning**: Fixed top banner (`fixed top-0 left-0 right-0 z-[9999]`), không đẩy hay nảy layout (CLS = 0).

---

### Task 1: Triển khai Custom Hook `useNetworkStatus` & Vitest Test

**Files:**
- Create: `src/hooks/use-network-status.ts`
- Test: `src/hooks/__tests__/use-network-status.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type NetworkStatusType = 'online' | 'offline' | 'reconnected';

  export interface UseNetworkStatusReturn {
    status: NetworkStatusType;
    isChecking: boolean;
    checkPing: () => Promise<void>;
  }

  export function useNetworkStatus(): UseNetworkStatusReturn;
  ```

- [ ] **Step 1: Viết test cho hook `useNetworkStatus`**

Tạo tệp `src/hooks/__tests__/use-network-status.test.ts`:
```ts
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useNetworkStatus } from '../use-network-status';

describe('useNetworkStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('bắt đầu với trạng thái online khi window.navigator.onLine là true', () => {
    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.status).toBe('online');
    expect(result.current.isChecking).toBe(false);
  });

  it('chuyển sang offline khi trình duyệt phát sự kiện offline', () => {
    const { result } = renderHook(() => useNetworkStatus());
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current.status).toBe('offline');
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npx vitest run src/hooks/__tests__/use-network-status.test.ts`  
Expected: FAIL (file `use-network-status.ts` chưa tồn tại).

- [ ] **Step 3: Viết mã nguồn cho `useNetworkStatus`**

Tạo tệp `src/hooks/use-network-status.ts`:
```ts
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
```

- [ ] **Step 4: Chạy test để xác nhận thành công**

Run: `npx vitest run src/hooks/__tests__/use-network-status.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/use-network-status.ts src/hooks/__tests__/use-network-status.test.ts
git commit -m "feat: implement useNetworkStatus hook with hybrid ping check"
```

---

### Task 2: Triển khai Component `<NetworkStatusBanner />` & Vitest Test

**Files:**
- Create: `src/components/common/network-status-banner.tsx`
- Test: `src/components/common/__tests__/network-status-banner.test.tsx`

**Interfaces:**
- Consumes: `useNetworkStatus` từ `src/hooks/use-network-status.ts`
- Produces: `<NetworkStatusBanner />` component

- [ ] **Step 1: Viết test cho `NetworkStatusBanner`**

Tạo tệp `src/components/common/__tests__/network-status-banner.test.tsx`:
```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { NetworkStatusBanner } from '../network-status-banner';
import * as useNetworkStatusModule from '@/src/hooks/use-network-status';

vi.mock('@/src/hooks/use-network-status');

describe('NetworkStatusBanner', () => {
  it('không hiển thị nhãn offline khi đang ở trạng thái online', () => {
    vi.spyOn(useNetworkStatusModule, 'useNetworkStatus').mockReturnValue({
      status: 'online',
      isChecking: false,
      checkPing: vi.fn(),
    });

    const { container } = render(<NetworkStatusBanner />);
    const banner = container.querySelector('[role="status"]');
    expect(banner).toHaveClass('-translate-y-full');
  });

  it('hiển thị thông báo ngoại tuyến và nút Thử lại khi trạng thái là offline', () => {
    vi.spyOn(useNetworkStatusModule, 'useNetworkStatus').mockReturnValue({
      status: 'offline',
      isChecking: false,
      checkPing: vi.fn(),
    });

    render(<NetworkStatusBanner />);
    expect(screen.getByText(/bạn đang ở chế độ ngoại tuyến/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /thử lại/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npx vitest run src/components/common/__tests__/network-status-banner.test.tsx`  
Expected: FAIL (file `network-status-banner.tsx` chưa tồn tại).

- [ ] **Step 3: Viết mã nguồn cho `NetworkStatusBanner`**

Tạo tệp `src/components/common/network-status-banner.tsx`:
```tsx
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
```

- [ ] **Step 4: Chạy test để xác nhận thành công**

Run: `npx vitest run src/components/common/__tests__/network-status-banner.test.tsx`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/common/network-status-banner.tsx src/components/common/__tests__/network-status-banner.test.tsx
git commit -m "feat: add NetworkStatusBanner sticky top component"
```

---

### Task 3: Tích hợp Banner vào Root Layout (`src/app.tsx`)

**Files:**
- Modify: `src/app.tsx:84`

- [ ] **Step 1: Đọc và tích hợp `<NetworkStatusBanner />` vào `src/app.tsx`**

Nhập component `NetworkStatusBanner` và thêm vào ngay trên hoặc bên cạnh `<Toaster />` trong `App()`:

```tsx
import { NetworkStatusBanner } from '@/src/components/common/network-status-banner'
```

Và bọc trong JSX:
```tsx
          <RouteErrorBoundary>
            <NetworkStatusBanner />
            <Suspense fallback={<RouteSpinner />}>
```

- [ ] **Step 2: Chạy toàn bộ test frontend để đảm bảo tính sẵn sàng**

Run: `npm run test:frontend`  
Expected: Tất cả test suite (bao gồm hook và component mới) đều PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app.tsx
git commit -m "feat: integrate NetworkStatusBanner into root App layout"
```

---
