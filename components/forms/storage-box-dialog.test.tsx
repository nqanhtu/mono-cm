import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { StorageBoxDialog } from './storage-box-dialog';

vi.mock('@/lib/hooks/use-storage-boxes', () => ({
  useAgencies: () => ({ agencies: [] }),
  useCreateStorageBox: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ id: 'box-1' }),
    isPending: false,
  }),
  useUpdateStorageBox: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ id: 'box-1' }),
    isPending: false,
  }),
}));

vi.mock('@/lib/hooks/use-autocomplete-suggestions', () => ({
  useAutocompleteSuggestions: () => ({
    suggestions: {
      types: ['Hình sự sơ thẩm', 'Loại án mới từ DB'],
      retentions: [],
      titles: [],
      documentTitles: [],
    },
    isLoading: false,
  }),
}));

describe('StorageBoxDialog', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
  };

  it('renders AutocompleteInput for caseType field with merged suggestions', async () => {
    render(<StorageBoxDialog {...defaultProps} />);

    const caseTypeInput = screen.getByPlaceholderText('Chọn hoặc nhập loại hồ sơ...');
    expect(caseTypeInput).toBeInTheDocument();

    // Focus input to open suggestions
    fireEvent.focus(caseTypeInput);

    // Check that both default items and DB items are rendered in suggestions
    expect(await screen.findByText('Dân sự sơ thẩm')).toBeInTheDocument();
    expect(await screen.findByText('Loại án mới từ DB')).toBeInTheDocument();
  });
});
