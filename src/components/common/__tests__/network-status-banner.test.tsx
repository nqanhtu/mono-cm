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
