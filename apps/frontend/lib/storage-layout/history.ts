import type { StorageLayoutData } from "@/lib/storage-layout/types";
import { getStorageLayoutSignature } from "@/lib/storage-layout/layout-mapper";

export type StorageLayoutHistory = {
  past: StorageLayoutData[];
  present: StorageLayoutData;
  future: StorageLayoutData[];
};

export function createStorageLayoutHistory(initialLayout: StorageLayoutData): StorageLayoutHistory {
  return { past: [], present: initialLayout, future: [] };
}

export function pushStorageLayoutHistory(history: StorageLayoutHistory, nextLayout: StorageLayoutData): StorageLayoutHistory {
  if (getStorageLayoutSignature(history.present) === getStorageLayoutSignature(nextLayout)) return history;
  return {
    past: [...history.past, history.present].slice(-80),
    present: nextLayout,
    future: [],
  };
}

export function replaceStorageLayoutHistory(history: StorageLayoutHistory, nextLayout: StorageLayoutData): StorageLayoutHistory {
  return {
    ...history,
    present: nextLayout,
  };
}

export function resetStorageLayoutHistory(nextLayout: StorageLayoutData): StorageLayoutHistory {
  return createStorageLayoutHistory(nextLayout);
}

export function undoStorageLayoutHistory(history: StorageLayoutHistory): StorageLayoutHistory {
  const previous = history.past.at(-1);
  if (!previous) return history;
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future].slice(0, 80),
  };
}

export function redoStorageLayoutHistory(history: StorageLayoutHistory): StorageLayoutHistory {
  const next = history.future[0];
  if (!next) return history;
  return {
    past: [...history.past, history.present].slice(-80),
    present: next,
    future: history.future.slice(1),
  };
}
