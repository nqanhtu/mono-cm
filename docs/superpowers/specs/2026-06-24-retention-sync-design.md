# Design Spec: Case File Retention Period Sync and Lock

This specification outlines the requirements and design for automatically synchronizing and locking the case file's retention period (`retention`) when a Storage Box is selected.

---

## 1. Requirements

### Context
Currently, when a user creates or edits a case file (parent file), they select a Storage Box (`boxId`) and manually select/type a retention period (`retention`). If the selected Storage Box already has a designated retention period, the case files inside that box must strictly share the same retention period.

### Functional Behavior
1. **Selection Sync:** When a user selects a Storage Box in the case file forms:
   - Look up the selected box's details in the fetched `boxes` list.
   - If the selected box has a non-empty `retention` value, automatically update the file's `retention` field in the form state.
2. **Locking Input:** If a Storage Box is selected and it has a retention period, lock (disable) the `retention` input field in the UI.
3. **Fallback/Unlock:** If the Storage Box selection is cleared or the selected box has no retention period defined, unlock (enable) the `retention` field, letting the user type or select suggestion entries manually. The default remains `"10 năm"` on a fresh form.
4. **Scope:** Apply this behavior consistently across all three case file creation/editing forms:
   - [CaseFileForm](file:///Users/anhtu/Projects/mono-cm/components/forms/case-file-form.tsx) (creating new case file)
   - [ManualFileForm](file:///Users/anhtu/Projects/mono-cm/components/forms/manual-file-form.tsx) (creating manual file)
   - [EditFileDialog](file:///Users/anhtu/Projects/mono-cm/components/forms/edit-file-dialog.tsx) (editing existing case file)

---

## 2. Technical Design

### A. Core Lock State Logic
In each form component, the locking condition is derived reactively from `formData.boxId` and the `boxes` array:

```typescript
const selectedBox = boxes.find(b => b.id === formData.boxId);
const isRetentionLocked = !!formData.boxId && !!selectedBox?.retention;
```

Pass `disabled={isRetentionLocked}` to the `AutocompleteInput` field for `retention`.

### B. Event Handler Updates

#### 1. [CaseFileForm](file:///Users/anhtu/Projects/mono-cm/components/forms/case-file-form.tsx)
Update the `onValueChange` handler of the `boxId` selection field:
```typescript
onValueChange={(val) => {
  handleFieldChange('boxId', val);
  const selectedBox = boxes.find(b => b.id === val);
  if (selectedBox && selectedBox.retention) {
    handleFieldChange('retention', selectedBox.retention);
  }
}}
```

#### 2. [ManualFileForm](file:///Users/anhtu/Projects/mono-cm/components/forms/manual-file-form.tsx)
Update the `onValueChange` handler of the `boxId` selection field:
```typescript
onValueChange={(val) => {
  const selectedBox = boxes.find(b => b.id === val);
  const updatedRetention = selectedBox && selectedBox.retention ? selectedBox.retention : formData.retention;
  setFormData(prev => ({ 
    ...prev, 
    boxId: val, 
    retention: updatedRetention 
  }));
}}
```

#### 3. [EditFileDialog](file:///Users/anhtu/Projects/mono-cm/components/forms/edit-file-dialog.tsx)
Update the `onValueChange` handler of the `boxId` selection field:
```typescript
onValueChange={(val) => {
  const selectedBox = boxes.find(b => b.id === val);
  const updatedRetention = selectedBox && selectedBox.retention ? selectedBox.retention : formData.retention;
  setFormData(prev => ({ 
    ...prev, 
    boxId: val, 
    retention: updatedRetention 
  }));
}}
```

---

## 3. Spec Self-Review

* **Placeholder Scan:** Passed. No TODOs or TBDs.
* **Internal Consistency:** Passed. The reactive locking logic works identically during initialization and runtime edits.
* **Scope Check:** Focuses strictly on `boxId` and `retention` synchronization across three files. Highly cohesive and isolated.
* **Ambiguity Check:** Explicitly defines the fallback behavior when the box is empty or has no retention.
