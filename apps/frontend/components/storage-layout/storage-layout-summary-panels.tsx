import { Box, MapPinned } from "lucide-react";

import type { StorageLayoutData, StorageLayoutSelection, StorageOccupancyMap } from "@/lib/storage-layout/types";
import type { getLayoutMismatch } from "@/lib/storage-layout/geometry";
import { cn } from "@/lib/utils";

type StorageLayoutDistributionPanelProps = {
  layout: StorageLayoutData;
  occupancyMap: StorageOccupancyMap;
  selectedElement: StorageLayoutSelection | null;
  onSelectShelf: (selection: StorageLayoutSelection) => void;
};

type StorageLayoutMismatchPanelProps = {
  mismatch: ReturnType<typeof getLayoutMismatch>;
  onSelectShelf: (selection: StorageLayoutSelection) => void;
};

function getShelfMapKey(warehouseId: string, shelfId: string) {
  return `${warehouseId}::${shelfId}`;
}

export function StorageLayoutDistributionPanel({
  layout,
  occupancyMap,
  selectedElement,
  onSelectShelf,
}: StorageLayoutDistributionPanelProps) {
  return (
    <section className="storage-animate-fade-in rounded-xl border bg-white p-4 shadow-sm dark:bg-slate-900">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Phân bổ hộp theo kệ</div>
          <div className="text-xs text-slate-500">Dữ liệu đọc từ danh sách hộp, layout chỉ lưu hình học</div>
        </div>
        <Box className="h-4 w-4 text-slate-400" />
      </div>
      <div className="grid max-h-80 gap-3 overflow-auto md:grid-cols-2">
        {layout.warehouses.flatMap((warehouse) =>
          warehouse.shelves.map((shelf) => {
            const shelfOccupancy = occupancyMap.get(getShelfMapKey(warehouse.id, shelf.id));
            const shelfBoxes = shelfOccupancy?.boxes || [];
            return (
              <button
                key={`${warehouse.id}-${shelf.id}`}
                type="button"
                className={cn(
                  "rounded-xl border bg-slate-50 p-3 text-left transition-all hover:-translate-y-0.5 hover:border-sky-300 hover:bg-sky-50 hover:shadow-sm dark:bg-slate-950 dark:hover:bg-slate-900",
                  selectedElement?.type === "shelf" && selectedElement.warehouseId === warehouse.id && selectedElement.id === shelf.id && "border-sky-400 bg-sky-50 dark:bg-slate-900",
                )}
                onClick={() => onSelectShelf({ type: "shelf", warehouseId: warehouse.id, id: shelf.id })}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{shelf.name}</div>
                    <div className="truncate text-xs text-slate-500">{warehouse.name} · {shelf.row}</div>
                  </div>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600 shadow-sm dark:bg-slate-800 dark:text-slate-200">{shelfOccupancy?.count || 0}</span>
                </div>
                <div className="mt-3 space-y-1">
                  {shelfBoxes.slice(0, 3).map((box) => (
                    <div key={box.id} className="flex items-center justify-between gap-2 rounded bg-white px-2 py-1 text-[11px] dark:bg-slate-900">
                      <span className="truncate font-mono text-sky-700">{box.code}</span>
                      <span className="shrink-0 text-slate-400">{box.year || "-"}</span>
                    </div>
                  ))}
                  {(shelfOccupancy?.count || 0) > 3 && <div className="text-[11px] text-slate-500">+{(shelfOccupancy?.count || 0) - 3} hộp khác</div>}
                  {(shelfOccupancy?.count || 0) === 0 && <div className="text-[11px] text-slate-400">Kệ trống</div>}
                </div>
              </button>
            );
          }),
        )}
      </div>
    </section>
  );
}

export function StorageLayoutMismatchPanel({ mismatch, onSelectShelf }: StorageLayoutMismatchPanelProps) {
  return (
    <section className="storage-animate-fade-in rounded-xl border bg-white p-4 shadow-sm dark:bg-slate-900">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Đối chiếu dữ liệu vật lý</div>
          <div className="text-xs text-slate-500">Nhóm mới và nhóm không còn hộp</div>
        </div>
        <MapPinned className="h-4 w-4 text-slate-400" />
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <div className="rounded-lg border bg-slate-50 p-3 text-xs dark:bg-slate-950">
          <div className="mb-2 font-semibold">Chưa đặt trên sơ đồ</div>
          {mismatch.missingShelves.length === 0 && mismatch.missingWarehouses.length === 0 ? (
            <div className="text-slate-500">Không có nhóm mới</div>
          ) : (
            <div className="space-y-1">
              {mismatch.missingWarehouses.map((warehouse) => <div key={warehouse.id}>{warehouse.name}</div>)}
              {mismatch.missingShelves.map((item) => <div key={`${item.warehouseId}-${item.shelfId}`}>{item.warehouseId} / {item.shelfId}</div>)}
            </div>
          )}
        </div>
        <div className="rounded-lg border bg-slate-50 p-3 text-xs dark:bg-slate-950">
          <div className="mb-2 font-semibold">Không còn hộp hiện tại</div>
          {mismatch.staleShelves.length === 0 && mismatch.staleWarehouses.length === 0 ? (
            <div className="text-slate-500">Không có nhóm cũ</div>
          ) : (
            <div className="space-y-1">
              {mismatch.staleWarehouses.map((warehouse) => <div key={warehouse.id}>{warehouse.name}</div>)}
              {mismatch.staleShelves.map((item) => (
                <button key={`${item.warehouseId}-${item.shelfId}`} type="button" className="block text-left text-sky-700" onClick={() => onSelectShelf({ type: "shelf", warehouseId: item.warehouseId, id: item.shelfId })}>
                  {item.warehouseId} / {item.shelfId}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
