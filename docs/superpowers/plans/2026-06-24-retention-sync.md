# Case File Retention Period Sync and Lock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically synchronize and lock the case file's retention period (`retention`) when a Storage Box (`boxId`) with a designated retention period is selected, and revert/unlock it if the box is cleared or has no retention.

**Architecture:** 
- The locking state `isRetentionLocked` is computed reactively during render based on the current `formData.boxId` and the list of fetched `boxes`.
- Selection sync is driven purely by the `onValueChange` handler of the `boxId` autocomplete input to avoid stale-state updates or render loops.
- Fallback/unlock reverts to `'10 năm'` when a previously locked field is cleared.

**Tech Stack:** React, Next.js (Pages/App router client components), TypeScript, Tailwind CSS.

## Global Constraints
- Target workspace path is `/Users/anhtu/Projects/mono-cm`.
- Maintain standard React state handling.
- Do not introduce any unrelated refactoring or configuration changes.

---

## Proposed Changes

### Components

#### [MODIFY] [case-file-form.tsx](file:///Users/anhtu/Projects/mono-cm/components/forms/case-file-form.tsx)
- Compute `isRetentionLocked` based on `formData.boxId` and `boxes`.
- Update `boxId` `onValueChange` to sync `retention` and fallback to `'10 năm'` when unlocked.
- Pass `disabled={isRetentionLocked}` to the `retention` `AutocompleteInput`.

#### [MODIFY] [manual-file-form.tsx](file:///Users/anhtu/Projects/mono-cm/components/forms/manual-file-form.tsx)
- Compute `isRetentionLocked` based on `formData.boxId` and `boxes`.
- Update `boxId` `onValueChange` to sync `retention` and fallback to `'10 năm'` when unlocked.
- Pass `disabled={isRetentionLocked}` to the `retention` `AutocompleteInput`.

#### [MODIFY] [edit-file-dialog.tsx](file:///Users/anhtu/Projects/mono-cm/components/forms/edit-file-dialog.tsx)
- Compute `isRetentionLocked` based on `formData.boxId` and `boxes`.
- Update `boxId` `onValueChange` to sync `retention` and fallback to `'10 năm'` when unlocked.
- Pass `disabled={isRetentionLocked}` to the `retention` `AutocompleteInput`.

---

## Detailed Tasks

### Task 1: Update CaseFileForm
**Files:**
- Modify: `/Users/anhtu/Projects/mono-cm/components/forms/case-file-form.tsx`

- [ ] **Step 1: Add reactivity and update handler**
  Compute the lock condition, update the `onValueChange` handler for the `boxId` field, and pass `disabled={isRetentionLocked}` to `retention`.
  
  Code change around line 340 (after `boxOptions` definition):
  ```typescript
  const selectedBox = boxes.find(b => b.id === formData.boxId);
  const isRetentionLocked = !!formData.boxId && !!selectedBox?.retention;
  ```

  Update the `boxId` field's `onValueChange` handler (around line 496):
  ```typescript
  onValueChange={(val) => {
    handleFieldChange('boxId', val);
    const selectedBox = boxes.find(b => b.id === val);
    if (selectedBox && selectedBox.retention) {
      handleFieldChange('retention', selectedBox.retention);
    } else if (isRetentionLocked) {
      handleFieldChange('retention', '10 năm');
    }
  }}
  ```

  Update the `retention` field (around line 465):
  ```typescript
  <AutocompleteInput
    id="retention"
    placeholder="10 năm"
    value={formData.retention}
    suggestions={suggestions.retentions}
    onValueChange={(val) => handleFieldChange('retention', val)}
    className="h-9 text-xs rounded-md"
    disabled={isRetentionLocked}
  />
  ```

---

### Task 2: Update ManualFileForm
**Files:**
- Modify: `/Users/anhtu/Projects/mono-cm/components/forms/manual-file-form.tsx`

- [ ] **Step 1: Compute lock condition and update handlers**
  Code change around line 196 (after `boxOptions` definition):
  ```typescript
  const selectedBox = boxes.find(b => b.id === formData.boxId);
  const isRetentionLocked = !!formData.boxId && !!selectedBox?.retention;
  ```

  Update the `boxId` field's `onValueChange` handler (around line 322):
  ```typescript
  onValueChange={(val) => {
      const selectedBox = boxes.find(b => b.id === val);
      setFormData(prev => {
          const nextRetention = selectedBox && selectedBox.retention 
              ? selectedBox.retention 
              : (isRetentionLocked ? '10 năm' : prev.retention);
          return {
              ...prev,
              boxId: val,
              retention: nextRetention
          };
      });
  }}
  ```

  Update the `retention` field (around line 296):
  ```typescript
  <AutocompleteInput
      id="retention"
      placeholder="10 năm"
      value={formData.retention}
      suggestions={suggestions.retentions}
      onValueChange={(val) => setFormData({ ...formData, retention: val })}
      disabled={isRetentionLocked}
  />
  ```

---

### Task 3: Update EditFileDialog
**Files:**
- Modify: `/Users/anhtu/Projects/mono-cm/components/forms/edit-file-dialog.tsx`

- [ ] **Step 1: Compute lock condition and update handlers**
  Code change around line 237 (after `boxOptions` definition):
  ```typescript
  const selectedBox = boxes.find(b => b.id === formData.boxId);
  const isRetentionLocked = !!formData.boxId && formData.boxId !== 'none_clear' && !!selectedBox?.retention;
  ```

  Update the `boxId` field's `onValueChange` handler (around line 376):
  ```typescript
  onValueChange={(val) => {
      const selectedBox = boxes.find(b => b.id === val);
      setFormData(prev => {
          const nextRetention = selectedBox && selectedBox.retention 
              ? selectedBox.retention 
              : (isRetentionLocked ? '10 năm' : prev.retention);
          return {
              ...prev,
              boxId: val,
              retention: nextRetention
          };
      });
  }}
  ```

  Update the `retention` field (around line 350):
  ```typescript
  <AutocompleteInput
      id="retention"
      placeholder="10 năm"
      value={formData.retention}
      suggestions={suggestions.retentions}
      onValueChange={(val) => setFormData({ ...formData, retention: val })}
      disabled={isRetentionLocked}
  />
  ```

---

### Task 4: Lint & Test Verification
**Files:**
- None

- [ ] **Step 1: Run linter**
  Run: `bun run lint`
  Expected: Success, no lint errors.

- [ ] **Step 2: Run frontend tests**
  Run: `bun run test:frontend`
  Expected: PASS

- [ ] **Step 3: Run server tests**
  Run: `bun run test:server`
  Expected: PASS

---

## Verification Plan

### Automated Tests
- `bun run lint`
- `bun run test:frontend`
- `bun run test:server`

### Manual Verification
- In the frontend application:
  1. Open the case file creation form.
  2. Select a Storage Box that has a designated retention period (e.g. `'Vĩnh viễn'`).
  3. Verify that the "Bảo quản" (retention) field automatically populates to `'Vĩnh viễn'` and becomes disabled/locked.
  4. Clear the Storage Box selection or select a box with no retention.
  5. Verify that the "Bảo quản" field becomes editable again and defaults back to `'10 năm'`.
  6. Repeat for manual file creation and case file editing (EditFileDialog).
