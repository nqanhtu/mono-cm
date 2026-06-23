import type { StorageBoxDto } from "@/lib/api/types";
import type {
  StorageLayoutData,
  StorageLayoutOccupancyResponse,
  StorageLayoutSearch,
  StorageLayoutShelf,
  StorageLayoutValidationResult,
  StorageLayoutWarehouse,
  StorageOccupancyMap,
  StorageLayoutPhysicalWarehouse,
} from "@/lib/storage-layout/types";

const LOGICAL_WIDTH = 1000;
const DEFAULT_WAREHOUSE_WIDTH = 420;
const DEFAULT_WAREHOUSE_HEIGHT = 220;
const DEFAULT_SHELF_WIDTH = 108;
const DEFAULT_SHELF_HEIGHT = 42;

function normalizeLabel(value: string, fallback: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

export function getStorageShelfId(box: Pick<StorageBoxDto, "line" | "shelf">) {
  return `${normalizeLabel(box.line, "Chưa rõ dãy")}::${normalizeLabel(box.shelf, "Chưa rõ kệ")}`;
}

export function getStorageShelfParts(shelfId: string) {
  const [row, ...nameParts] = shelfId.split("::");
  return {
    row: row || "Dãy",
    name: nameParts.join("::") || shelfId,
  };
}

function getOccupancyKey(warehouseId: string, shelfId: string) {
  return `${warehouseId}::${shelfId}`;
}

function sortByVietnameseName<T>(items: T[], getName: (item: T) => string) {
  return [...items].sort((a, b) => getName(a).localeCompare(getName(b), "vi"));
}

function isStorageLayoutShelf(value: StorageLayoutShelf | undefined): value is StorageLayoutShelf {
  return value !== undefined;
}

function createDefaultWarehouse(warehouseId: string, index: number, shelves: { id: string; name: string; row: string }[]): StorageLayoutWarehouse {
  const column = index % 2;
  const row = Math.floor(index / 2);
  const x = 40 + column * 480;
  const y = 40 + row * 270;
  const shelfRows = Math.max(1, Math.ceil(shelves.length / 3));
  const h = Math.max(DEFAULT_WAREHOUSE_HEIGHT, 86 + shelfRows * 60);

  return {
    id: warehouseId,
    name: warehouseId,
    x: Math.min(x, LOGICAL_WIDTH - DEFAULT_WAREHOUSE_WIDTH - 24),
    y,
    w: DEFAULT_WAREHOUSE_WIDTH,
    h,
    widthInMeters: null,
    heightInMeters: null,
    capacity: null,
    shelves: shelves.map((physicalShelf, shelfIndex) => {
      return {
        id: physicalShelf.id,
        name: physicalShelf.name,
        row: physicalShelf.row,
        x: 64 + column * 480 + (shelfIndex % 3) * 126,
        y: y + 56 + Math.floor(shelfIndex / 3) * 60,
        w: DEFAULT_SHELF_WIDTH,
        h: DEFAULT_SHELF_HEIGHT,
        capacity: null,
      };
    }),
  };
}

export function getPhysicalWarehousesFromBoxes(boxes: StorageBoxDto[]): StorageLayoutPhysicalWarehouse[] {
  const physicalWarehouseShelves = new Map<string, Map<string, { id: string; name: string; row: string }>>();
  for (const box of boxes) {
    const warehouseId = normalizeLabel(box.warehouse, "Chưa rõ kho");
    const shelfId = getStorageShelfId(box);
    const row = normalizeLabel(box.line, "Chưa rõ dãy");
    const name = normalizeLabel(box.shelf, "Chưa rõ kệ");
    if (!physicalWarehouseShelves.has(warehouseId)) physicalWarehouseShelves.set(warehouseId, new Map());
    physicalWarehouseShelves.get(warehouseId)?.set(shelfId, { id: shelfId, name, row });
  }
  return sortByVietnameseName(Array.from(physicalWarehouseShelves.entries()), ([id]) => id).map(([id, shelves]) => ({
    id,
    name: id,
    shelves: sortByVietnameseName(Array.from(shelves.values()), (shelf) => shelf.id),
  }));
}

export function getPhysicalWarehousesFromOccupancy(occupancy: StorageLayoutOccupancyResponse | null | undefined): StorageLayoutPhysicalWarehouse[] {
  return (occupancy?.warehouses || []).map((warehouse) => ({
    id: warehouse.id,
    name: warehouse.name,
    shelves: warehouse.shelves.map((shelf) => ({ id: shelf.id, name: shelf.name, row: shelf.row })),
  }));
}

export function buildStorageOccupancyMapFromResponse(occupancy: StorageLayoutOccupancyResponse | null | undefined): StorageOccupancyMap {
  const map: StorageOccupancyMap = new Map();
  if (!occupancy) return map;

  for (const warehouse of occupancy.warehouses) {
    for (const shelf of warehouse.shelves) {
      map.set(getOccupancyKey(warehouse.id, shelf.id), {
        count: shelf.totalBoxes,
        matchedCount: shelf.matchedBoxes,
        boxes: shelf.previewBoxes,
        isHighlighted: shelf.matchedBoxes > 0 && occupancy.matchedBoxes !== occupancy.totalBoxes,
      });
    }
  }

  return map;
}

export function buildStorageOccupancyMap(boxes: StorageBoxDto[], highlightedBoxes: StorageBoxDto[] = boxes): StorageOccupancyMap {
  const highlightedKeys = new Set(
    highlightedBoxes.map((box) => getOccupancyKey(normalizeLabel(box.warehouse, "Chưa rõ kho"), getStorageShelfId(box)))
  );
  const map: StorageOccupancyMap = new Map();

  for (const box of boxes) {
    const warehouseId = normalizeLabel(box.warehouse, "Chưa rõ kho");
    const shelfId = getStorageShelfId(box);
    const key = getOccupancyKey(warehouseId, shelfId);
    const current = map.get(key) || { count: 0, matchedCount: 0, boxes: [], isHighlighted: false };
    current.count += 1;
    current.matchedCount += highlightedKeys.has(key) ? 1 : 0;
    current.boxes.push({
      id: box.id,
      code: box.code,
      warehouse: box.warehouse,
      line: box.line,
      shelf: box.shelf,
      slot: box.slot,
      boxNumber: box.boxNumber,
      year: box.year,
      caseType: box.caseType,
      agencyName: box.agency?.name || null,
    });
    current.isHighlighted = highlightedKeys.has(key);
    map.set(key, current);
  }

  return map;
}

export function mergeStorageLayoutFromPhysical(physicalWarehouses: StorageLayoutPhysicalWarehouse[], savedLayout: StorageLayoutData | null | undefined): StorageLayoutData {
  const savedWarehouses = new Map((savedLayout?.warehouses || []).map((warehouse) => [warehouse.id, warehouse]));
  const mergedWarehouses: StorageLayoutWarehouse[] = [];
  const warehouseIds = sortByVietnameseName(
    Array.from(new Set([...savedWarehouses.keys(), ...physicalWarehouses.map((warehouse) => warehouse.id)])),
    (id) => id
  );
  const physicalMap = new Map(physicalWarehouses.map((warehouse) => [warehouse.id, warehouse]));

  warehouseIds.forEach((warehouseId, warehouseIndex) => {
    const requiredShelves = physicalMap.get(warehouseId)?.shelves || [];
    const savedWarehouse = savedWarehouses.get(warehouseId);
    if (!savedWarehouse) {
      mergedWarehouses.push(createDefaultWarehouse(warehouseId, warehouseIndex, requiredShelves));
      return;
    }

    const savedShelves = new Map(savedWarehouse.shelves.map((shelf) => [shelf.id, shelf]));
    const allShelfIds = sortByVietnameseName(
      Array.from(new Set([...savedShelves.keys(), ...requiredShelves.map((shelf) => shelf.id)])),
      (id) => id
    );
    const missingShelfDefaults = createDefaultWarehouse(warehouseId, warehouseIndex, requiredShelves).shelves;
    const missingShelves = new Map(missingShelfDefaults.map((shelf) => [shelf.id, shelf]));

    mergedWarehouses.push({
      ...savedWarehouse,
      shelves: allShelfIds.map((shelfId) => savedShelves.get(shelfId) || missingShelves.get(shelfId)).filter(isStorageLayoutShelf),
    });
  });

  return { version: 1, warehouses: mergedWarehouses };
}

export function mergeStorageLayout(boxes: StorageBoxDto[], savedLayout: StorageLayoutData | null | undefined): StorageLayoutData {
  return mergeStorageLayoutFromPhysical(getPhysicalWarehousesFromBoxes(boxes), savedLayout);
}

export function getStorageLayoutSignature(layout: StorageLayoutData) {
  return JSON.stringify(layout);
}

export function filterBoxesForStorageLayoutSearch(boxes: StorageBoxDto[], search: StorageLayoutSearch) {
  const code = search.code.trim().toLowerCase();
  const fond = search.fond.trim().toLowerCase();
  const caseType = search.caseType.trim();
  const documentNumber = search.documentNumber.trim();
  const docNumber = Number(documentNumber);

  const isActive = Boolean(code || fond || caseType || documentNumber);
  if (!isActive) return { boxes, isActive: false };

  return {
    isActive: true,
    boxes: boxes.filter((box) => {
      if (code && !box.code.toLowerCase().includes(code)) return false;
      if (fond && !(box.agency?.name || "").toLowerCase().includes(fond)) return false;
      if (caseType && box.caseType !== caseType) return false;
      if (documentNumber) {
        if (!Number.isFinite(docNumber)) return false;
        const from = Number(box.fromFileCode);
        const to = Number(box.toFileCode);
        if (!Number.isFinite(from) || !Number.isFinite(to) || docNumber < from || docNumber > to) return false;
      }
      return true;
    }),
  };
}

export function validateStorageLayoutData(value: unknown): StorageLayoutValidationResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, error: "Layout payload must be an object." };
  const record = value as Record<string, unknown>;
  if (record.version !== 1) return { ok: false, error: "Layout version must be 1." };
  if (!Array.isArray(record.warehouses)) return { ok: false, error: "Layout warehouses must be an array." };

  const warehouseIds = new Set<string>();
  const warehouses: StorageLayoutWarehouse[] = [];
  for (const warehouseValue of record.warehouses) {
    if (!warehouseValue || typeof warehouseValue !== "object" || Array.isArray(warehouseValue)) return { ok: false, error: "Each warehouse must be an object." };
    const warehouse = warehouseValue as Record<string, unknown>;
    const id = typeof warehouse.id === "string" ? warehouse.id.trim() : "";
    const name = typeof warehouse.name === "string" ? warehouse.name.trim() : "";
    const x = warehouse.x;
    const y = warehouse.y;
    const w = warehouse.w;
    const h = warehouse.h;
    if (!id || !name || typeof x !== "number" || typeof y !== "number" || typeof w !== "number" || typeof h !== "number" || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
      return { ok: false, error: "Each warehouse must have a non-empty id/name and finite positive geometry." };
    }
    if (warehouseIds.has(id)) return { ok: false, error: "Warehouse ids must be unique." };
    warehouseIds.add(id);
    const widthInMeters = readOptionalNumber(warehouse.widthInMeters);
    const heightInMeters = readOptionalNumber(warehouse.heightInMeters);
    const capacity = readOptionalPositiveNumber(warehouse.capacity);
    if (widthInMeters === undefined || heightInMeters === undefined) return { ok: false, error: "Warehouse meter dimensions must be finite numbers when provided." };
    if (capacity === undefined) return { ok: false, error: "Warehouse capacity must be a positive finite number when provided." };
    if (!Array.isArray(warehouse.shelves)) return { ok: false, error: "Each warehouse shelves field must be an array." };

    const shelfIds = new Set<string>();
    const shelves: StorageLayoutShelf[] = [];
    for (const shelfValue of warehouse.shelves) {
      if (!shelfValue || typeof shelfValue !== "object" || Array.isArray(shelfValue)) return { ok: false, error: "Each shelf must be an object." };
      const shelf = shelfValue as Record<string, unknown>;
      const shelfId = typeof shelf.id === "string" ? shelf.id.trim() : "";
      const shelfName = typeof shelf.name === "string" ? shelf.name.trim() : "";
      const row = typeof shelf.row === "string" ? shelf.row.trim() : "";
      const shelfX = shelf.x;
      const shelfY = shelf.y;
      const shelfW = shelf.w;
      const shelfH = shelf.h;
      if (!shelfId || !shelfName || !row || typeof shelfX !== "number" || typeof shelfY !== "number" || typeof shelfW !== "number" || typeof shelfH !== "number" || !Number.isFinite(shelfX) || !Number.isFinite(shelfY) || !Number.isFinite(shelfW) || !Number.isFinite(shelfH) || shelfW <= 0 || shelfH <= 0) {
        return { ok: false, error: "Each shelf must have a non-empty id/name/row and finite positive geometry." };
      }
      if (shelfIds.has(shelfId)) return { ok: false, error: "Shelf ids must be unique within each warehouse." };
      shelfIds.add(shelfId);
      const shelfCapacity = readOptionalPositiveNumber(shelf.capacity);
      if (shelfCapacity === undefined) return { ok: false, error: "Shelf capacity must be a positive finite number when provided." };
      shelves.push({ id: shelfId, name: shelfName, row, x: shelfX, y: shelfY, w: shelfW, h: shelfH, capacity: shelfCapacity });
    }
    warehouses.push({ id, name, x, y, w, h, widthInMeters, heightInMeters, capacity, shelves });
  }
  return { ok: true, data: { version: 1, warehouses } };
}

function readOptionalNumber(value: unknown) {
  if (value === undefined || value === null) return null;
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readOptionalPositiveNumber(value: unknown) {
  const number = readOptionalNumber(value);
  if (number === null) return null;
  if (number === undefined || number <= 0) return undefined;
  return number;
}
