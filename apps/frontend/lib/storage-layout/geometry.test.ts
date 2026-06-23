import { describe, expect, it } from "vitest";

import {
  clampShelfToWarehouse,
  getLayoutMismatch,
  getOverlappingShelfIds,
  snapRect,
} from "@/lib/storage-layout/geometry";
import type { StorageLayoutData, StorageLayoutWarehouse } from "@/lib/storage-layout/types";

describe("storage layout geometry", () => {
  it("snaps rectangles to the configured grid", () => {
    expect(snapRect({ x: 13, y: 29, w: 107, h: 42 }, 20)).toEqual({ x: 20, y: 20, w: 100, h: 40 });
  });

  it("keeps shelves inside warehouse bounds", () => {
    const warehouse: StorageLayoutWarehouse = {
      id: "Kho A",
      name: "Kho A",
      x: 100,
      y: 100,
      w: 220,
      h: 180,
      shelves: [],
    };

    expect(clampShelfToWarehouse({ id: "s1", name: "Kệ 1", row: "Dãy 1", x: 0, y: 0, w: 500, h: 500 }, warehouse)).toMatchObject({
      x: 112,
      y: 138,
      w: 196,
      h: 130,
    });
  });

  it("detects overlapping shelves as warnings", () => {
    const warehouse: StorageLayoutWarehouse = {
      id: "Kho A",
      name: "Kho A",
      x: 0,
      y: 0,
      w: 400,
      h: 240,
      shelves: [
        { id: "a", name: "A", row: "R", x: 20, y: 20, w: 120, h: 60 },
        { id: "b", name: "B", row: "R", x: 100, y: 50, w: 120, h: 60 },
        { id: "c", name: "C", row: "R", x: 260, y: 50, w: 80, h: 60 },
      ],
    };

    expect(Array.from(getOverlappingShelfIds(warehouse)).sort()).toEqual(["a", "b"]);
  });

  it("reports physical/layout mismatches", () => {
    const layout: StorageLayoutData = {
      version: 1,
      warehouses: [{
        id: "Kho A",
        name: "Kho A",
        x: 0,
        y: 0,
        w: 400,
        h: 240,
        shelves: [{ id: "Dãy 1::Kệ stale", name: "Kệ stale", row: "Dãy 1", x: 20, y: 20, w: 80, h: 40 }],
      }],
    };

    expect(getLayoutMismatch(layout, [{
      id: "Kho A",
      name: "Kho A",
      shelves: [{ id: "Dãy 1::Kệ mới", name: "Kệ mới", row: "Dãy 1" }],
    }])).toMatchObject({
      missingShelves: [{ warehouseId: "Kho A", shelfId: "Dãy 1::Kệ mới" }],
      staleShelves: [{ warehouseId: "Kho A", shelfId: "Dãy 1::Kệ stale" }],
    });
  });
});
