import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useNetworkStatus } from '../use-network-status';

describe('useNetworkStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('bắt đầu với trạng thái online khi window.navigator.onLine là true', () => {
    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.status).toBe('online');
    expect(result.current.isChecking).toBe(false);
  });

  it('bắt đầu với trạng thái offline khi window.navigator.onLine là false', () => {
    const originalOnLine = navigator.onLine;
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.status).toBe('offline');

    Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true });
  });

  it('chuyển sang offline khi trình duyệt phát sự kiện offline', () => {
    const { result } = renderHook(() => useNetworkStatus());
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current.status).toBe('offline');
  });

  it('chuyển sang reconnected rồi sang online sau 2.5s khi online event phát và checkPing thành công từ offline', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(new Response(null, { status: 200 }));

    const { result } = renderHook(() => useNetworkStatus());

    // Trigger offline
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current.status).toBe('offline');

    // Trigger online
    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });

    expect(result.current.status).toBe('reconnected');

    // Fast-forward 2.5s timer
    act(() => {
      vi.advanceTimersByTime(2500);
    });

    expect(result.current.status).toBe('online');
  });

  it('coi status 304 hoặc 404 là thành công trong checkPing', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(new Response(null, { status: 404 }));

    const { result } = renderHook(() => useNetworkStatus());

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });

    expect(result.current.status).toBe('reconnected');
  });

  it('giữ offline nếu checkPing thất bại khi nhận được sự kiện online', async () => {
    vi.mocked(globalThis.fetch).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useNetworkStatus());

    // Trigger offline
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    // Trigger online, checkPing fails
    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });

    expect(result.current.status).toBe('offline');
  });

  it('chuyển sang offline nếu server trả về status không hợp lệ (e.g. 500)', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(new Response(null, { status: 500 }));

    const { result } = renderHook(() => useNetworkStatus());

    await act(async () => {
      await result.current.checkPing();
    });

    expect(result.current.status).toBe('offline');
  });

  it('thực hiện periodic ping 10s khi đang ở trạng thái offline', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response(null, { status: 200 }));

    renderHook(() => useNetworkStatus());

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(globalThis.fetch).not.toHaveBeenCalled();

    // Advance 10s interval
    await act(async () => {
      vi.advanceTimersByTime(10000);
    });

    expect(globalThis.fetch).toHaveBeenCalledWith('/favicon.ico', expect.objectContaining({
      method: 'HEAD',
      cache: 'no-store',
    }));
  });

  it('gọi checkPing khi visibilitychange kích hoạt và tab không bị ẩn trong trạng thái offline', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response(null, { status: 200 }));

    renderHook(() => useNetworkStatus());

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});
