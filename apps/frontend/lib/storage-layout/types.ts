export type StorageLayoutShelf = {
  id: string;
  name: string;
  row: string;
  x: number;
  y: number;
  w: number;
  h: number;
  capacity?: number | null;
};

export type StorageLayoutWarehouse = {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  widthInMeters?: number | null;
  heightInMeters?: number | null;
  capacity?: number | null;
  shelves: StorageLayoutShelf[];
};

export type StorageLayoutData = {
  version: 1;
  warehouses: StorageLayoutWarehouse[];
};

export type StorageLayoutSelection =
  | { type: "warehouse"; id: string }
  | { type: "shelf"; warehouseId: string; id: string };

export type StorageLayoutTransform = {
  x: number;
  y: number;
  k: number;
};

export type StorageShelfOccupancy = {
  count: number;
  matchedCount: number;
  boxes: StorageLayoutBoxPreview[];
  isHighlighted: boolean;
};

export type StorageOccupancyMap = Map<string, StorageShelfOccupancy>;

export type StorageLayoutSearch = {
  code: string;
  fond: string;
  caseType: string;
  documentNumber: string;
};

export type StorageLayoutBoxPreview = {
  id: string;
  code: string;
  warehouse: string;
  line: string;
  shelf: string;
  slot: string;
  boxNumber: string;
  year?: number | null;
  caseType?: string | null;
  agencyName?: string | null;
};

export type StorageLayoutOccupancyShelf = {
  id: string;
  row: string;
  name: string;
  totalBoxes: number;
  matchedBoxes: number;
  previewBoxes: StorageLayoutBoxPreview[];
};

export type StorageLayoutOccupancyWarehouse = {
  id: string;
  name: string;
  totalBoxes: number;
  matchedBoxes: number;
  shelves: StorageLayoutOccupancyShelf[];
};

export type StorageLayoutOccupancyResponse = {
  totalBoxes: number;
  matchedBoxes: number;
  caseTypes: string[];
  warehouses: StorageLayoutOccupancyWarehouse[];
};

export type StorageLayoutPhysicalWarehouse = {
  id: string;
  name: string;
  shelves: {
    id: string;
    name: string;
    row: string;
  }[];
};

export type StorageLayoutValidationResult =
  | { ok: true; data: StorageLayoutData }
  | { ok: false; error: string };
