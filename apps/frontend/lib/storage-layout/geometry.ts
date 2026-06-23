import type {
  StorageLayoutData,
  StorageLayoutSelection,
  StorageLayoutShelf,
  StorageLayoutWarehouse,
} from "@/lib/storage-layout/types";

export const STORAGE_LAYOUT_GRID_SIZE = 20;
export const STORAGE_LAYOUT_LOGICAL_SIZE = { width: 1000, height: 640 };
export const STORAGE_LAYOUT_MIN_WAREHOUSE_SIZE = { w: 180, h: 130 };
export const STORAGE_LAYOUT_MIN_SHELF_SIZE = { w: 56, h: 28 };

export function snapToGrid(value: number, gridSize = STORAGE_LAYOUT_GRID_SIZE) {
  return Math.round(value / gridSize) * gridSize;
}

export function snapRect<T extends { x: number; y: number; w: number; h: number }>(rect: T, gridSize = STORAGE_LAYOUT_GRID_SIZE): T {
  return {
    ...rect,
    x: snapToGrid(rect.x, gridSize),
    y: snapToGrid(rect.y, gridSize),
    w: Math.max(gridSize, snapToGrid(rect.w, gridSize)),
    h: Math.max(gridSize, snapToGrid(rect.h, gridSize)),
  };
}

export function clampShelfToWarehouse(shelf: StorageLayoutShelf, warehouse: StorageLayoutWarehouse): StorageLayoutShelf {
  const w = Math.max(STORAGE_LAYOUT_MIN_SHELF_SIZE.w, Math.min(shelf.w, warehouse.w - 24));
  const h = Math.max(STORAGE_LAYOUT_MIN_SHELF_SIZE.h, Math.min(shelf.h, warehouse.h - 50));
  return {
    ...shelf,
    w,
    h,
    x: Math.round(Math.max(warehouse.x + 12, Math.min(shelf.x, warehouse.x + warehouse.w - w - 12))),
    y: Math.round(Math.max(warehouse.y + 38, Math.min(shelf.y, warehouse.y + warehouse.h - h - 12))),
  };
}

export function getWarehouseMinimumBounds(warehouse: StorageLayoutWarehouse) {
  if (warehouse.shelves.length === 0) return STORAGE_LAYOUT_MIN_WAREHOUSE_SIZE;
  const maxRight = Math.max(...warehouse.shelves.map((shelf) => shelf.x + shelf.w));
  const maxBottom = Math.max(...warehouse.shelves.map((shelf) => shelf.y + shelf.h));
  return {
    w: Math.max(STORAGE_LAYOUT_MIN_WAREHOUSE_SIZE.w, maxRight - warehouse.x + 12),
    h: Math.max(STORAGE_LAYOUT_MIN_WAREHOUSE_SIZE.h, maxBottom - warehouse.y + 12),
  };
}

export function clampWarehouse(warehouse: StorageLayoutWarehouse): StorageLayoutWarehouse {
  const minimum = getWarehouseMinimumBounds(warehouse);
  return {
    ...warehouse,
    x: Math.round(Math.max(0, Math.min(warehouse.x, STORAGE_LAYOUT_LOGICAL_SIZE.width - minimum.w))),
    y: Math.round(Math.max(0, warehouse.y)),
    w: Math.max(minimum.w, warehouse.w),
    h: Math.max(minimum.h, warehouse.h),
  };
}

export function updateWarehouse(layout: StorageLayoutData, warehouseId: string, nextWarehouse: StorageLayoutWarehouse): StorageLayoutData {
  return {
    ...layout,
    warehouses: layout.warehouses.map((warehouse) => (warehouse.id === warehouseId ? nextWarehouse : warehouse)),
  };
}

export function findSelectedObject(layout: StorageLayoutData, selectedElement: StorageLayoutSelection | null) {
  if (!selectedElement) return null;
  if (selectedElement.type === "warehouse") {
    return layout.warehouses.find((warehouse) => warehouse.id === selectedElement.id) || null;
  }
  return layout.warehouses
    .find((warehouse) => warehouse.id === selectedElement.warehouseId)
    ?.shelves.find((shelf) => shelf.id === selectedElement.id) || null;
}

export function findSelectedWarehouse(layout: StorageLayoutData, selectedElement: StorageLayoutSelection | null) {
  if (!selectedElement) return null;
  return selectedElement.type === "warehouse"
    ? layout.warehouses.find((warehouse) => warehouse.id === selectedElement.id) || null
    : layout.warehouses.find((warehouse) => warehouse.id === selectedElement.warehouseId) || null;
}

export function doRectsOverlap(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function getOverlappingShelfIds(warehouse: StorageLayoutWarehouse) {
  const ids = new Set<string>();
  for (let index = 0; index < warehouse.shelves.length; index += 1) {
    for (let nextIndex = index + 1; nextIndex < warehouse.shelves.length; nextIndex += 1) {
      const first = warehouse.shelves[index];
      const second = warehouse.shelves[nextIndex];
      if (doRectsOverlap(first, second)) {
        ids.add(first.id);
        ids.add(second.id);
      }
    }
  }
  return ids;
}

export function getLayoutMismatch(layout: StorageLayoutData, physicalGroups: { id: string; name?: string; shelves: { id: string; name?: string; row?: string }[] }[]) {
  const physicalWarehouseIds = new Set(physicalGroups.map((warehouse) => warehouse.id));
  const physicalShelfKeys = new Set(physicalGroups.flatMap((warehouse) => warehouse.shelves.map((shelf) => `${warehouse.id}::${shelf.id}`)));
  const layoutWarehouseIds = new Set(layout.warehouses.map((warehouse) => warehouse.id));
  const layoutShelfKeys = new Set(layout.warehouses.flatMap((warehouse) => warehouse.shelves.map((shelf) => `${warehouse.id}::${shelf.id}`)));

  return {
    missingWarehouses: physicalGroups.filter((warehouse) => !layoutWarehouseIds.has(warehouse.id)),
    missingShelves: physicalGroups.flatMap((warehouse) =>
      warehouse.shelves
        .filter((shelf) => !layoutShelfKeys.has(`${warehouse.id}::${shelf.id}`))
        .map((shelf) => ({ warehouseId: warehouse.id, shelfId: shelf.id }))
    ),
    staleWarehouses: layout.warehouses.filter((warehouse) => !physicalWarehouseIds.has(warehouse.id)),
    staleShelves: layout.warehouses.flatMap((warehouse) =>
      warehouse.shelves
        .filter((shelf) => !physicalShelfKeys.has(`${warehouse.id}::${shelf.id}`))
        .map((shelf) => ({ warehouseId: warehouse.id, shelfId: shelf.id }))
    ),
  };
}
