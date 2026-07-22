# Box CaseType Autocomplete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the "Loại hồ sơ" (`caseType`) input field in `StorageBoxDialog` at `/admin/boxes` from a static `<Select>` dropdown to `<AutocompleteInput>` with merged API and default suggestions.

**Architecture:** Integrate `AutocompleteInput` and `useAutocompleteSuggestions` into `StorageBoxDialog`. Merge default case type options with DB suggestions fetched via `useAutocompleteSuggestions().suggestions.types`, avoiding duplicate entries.

**Tech Stack:** React 19, TypeScript, React Hook Form, Zod, Vitest, `@testing-library/react`.

## Global Constraints

- Preserve all existing form fields, validation schema, and auto-code generation in `StorageBoxDialog`.
- Empty strings or `"none"` in `caseType` must be mapped to `null` before sending payloads to the API.

---

### Task 1: Add Unit Tests for StorageBoxDialog with AutocompleteInput

**Files:**
- Create: `components/forms/storage-box-dialog.test.tsx`

**Interfaces:**
- Consumes: `StorageBoxDialog` from `components/forms/storage-box-dialog.tsx`
- Produces: Test suite verifying `caseType` autocomplete field rendering, suggestion merging, and submission.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test components/forms/storage-box-dialog.test.tsx`
Expected: FAIL (placeholder `Chọn hoặc nhập loại hồ sơ...` not found)

- [ ] **Step 3: Commit initial test setup**

```bash
git add components/forms/storage-box-dialog.test.tsx
git commit -m "test: add failing test for StorageBoxDialog caseType autocomplete"
```

---

### Task 2: Implement AutocompleteInput in StorageBoxDialog

**Files:**
- Modify: `components/forms/storage-box-dialog.tsx`

**Interfaces:**
- Consumes: `AutocompleteInput` from `@/components/ui/autocomplete-input`, `useAutocompleteSuggestions` from `@/lib/hooks/use-autocomplete-suggestions`
- Produces: Updated `StorageBoxDialog` component supporting autocomplete and free text entry for `caseType`.

- [ ] **Step 1: Update `storage-box-dialog.tsx` implementation**

Replace the `<Select>` control for `caseType` with `AutocompleteInput` and merge default case types with `suggestions.types`.

```tsx
// 1. Add imports:
import { useMemo, useEffect } from "react";
import { AutocompleteInput } from "@/components/ui/autocomplete-input";
import { useAutocompleteSuggestions } from "@/lib/hooks/use-autocomplete-suggestions";

// 2. Inside StorageBoxDialog component:
const { suggestions } = useAutocompleteSuggestions();

const mergedCaseTypes = useMemo(() => {
  const defaults = [
    "Hình sự sơ thẩm",
    "Dân sự sơ thẩm",
    "Hình sự phúc thẩm",
    "Dân sự phúc thẩm",
    "Hôn nhân phúc thẩm",
    "Hành chính",
    "Kinh doanh thương mại",
    "Lao động",
    "Gia đình và người chưa thành niên",
  ];
  const dbTypes = suggestions?.types || [];
  const set = new Set([...defaults, ...dbTypes]);
  return Array.from(set);
}, [suggestions?.types]);

// 3. Replace FormField for caseType:
<FormField
  control={form.control}
  name="caseType"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Loại hồ sơ</FormLabel>
      <FormControl>
        <AutocompleteInput
          placeholder="Chọn hoặc nhập loại hồ sơ..."
          value={field.value || ""}
          suggestions={mergedCaseTypes}
          onValueChange={(val) => field.onChange(val ? val.trim() : null)}
          className="h-9 text-xs rounded-md"
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

- [ ] **Step 2: Run test to verify it passes**

Run: `bun test components/forms/storage-box-dialog.test.tsx`
Expected: PASS

- [ ] **Step 3: Run all frontend tests to ensure no regressions**

Run: `bun run test:frontend`
Expected: PASS

- [ ] **Step 4: Commit changes**

```bash
git add components/forms/storage-box-dialog.tsx components/forms/storage-box-dialog.test.tsx
git commit -m "feat: use AutocompleteInput for caseType in StorageBoxDialog"
```
