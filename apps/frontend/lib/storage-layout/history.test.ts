import { describe, expect, it } from "vitest";

import {
  createStorageLayoutHistory,
  pushStorageLayoutHistory,
  redoStorageLayoutHistory,
  undoStorageLayoutHistory,
} from "@/lib/storage-layout/history";
import type { StorageLayoutData } from "@/lib/storage-layout/types";

const baseLayout: StorageLayoutData = { version: 1, warehouses: [] };
const nextLayout: StorageLayoutData = {
  version: 1,
  warehouses: [{ id: "Kho A", name: "Kho A", x: 0, y: 0, w: 200, h: 160, shelves: [] }],
};

describe("storage layout history", () => {
  it("pushes undoable layout edits and supports undo/redo", () => {
    const pushed = pushStorageLayoutHistory(createStorageLayoutHistory(baseLayout), nextLayout);

    expect(pushed.present).toEqual(nextLayout);
    expect(pushed.past).toEqual([baseLayout]);

    const undone = undoStorageLayoutHistory(pushed);
    expect(undone.present).toEqual(baseLayout);
    expect(undone.future).toEqual([nextLayout]);

    expect(redoStorageLayoutHistory(undone).present).toEqual(nextLayout);
  });

  it("does not push duplicate layout states", () => {
    const history = createStorageLayoutHistory(baseLayout);
    expect(pushStorageLayoutHistory(history, baseLayout)).toEqual(history);
  });
});
