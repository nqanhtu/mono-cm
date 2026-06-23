import { QRCodeCanvas } from "qrcode.react";

import type { StorageBoxDto } from "@/lib/api/types";
import { Button } from "@/components/ui/button";

type StorageLayoutLabelPreviewModalProps = {
  boxes: StorageBoxDto[];
  getBoxQrUrl: (box: StorageBoxDto) => string;
  onClose: () => void;
  onPrint: () => void;
};

export function StorageLayoutLabelPreviewModal({
  boxes,
  getBoxQrUrl,
  onClose,
  onPrint,
}: StorageLayoutLabelPreviewModalProps) {
  if (boxes.length === 0) return null;

  return (
    <>
      <div className="hidden">
        {boxes.map((box) => (
          <QRCodeCanvas key={box.id} id={`storage-layout-qr-${box.id}`} value={getBoxQrUrl(box)} size={112} level="M" includeMargin />
        ))}
      </div>

      <div className="storage-animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
        <div className="storage-animate-scale-in w-full max-w-md rounded-xl border bg-background p-5 shadow-xl">
          <div className="mb-4">
            <div className="text-base font-semibold">In nhãn từ sơ đồ kho</div>
            <div className="text-sm text-muted-foreground">{boxes.length} hộp trong kệ đang chọn</div>
          </div>
          <div className="max-h-56 space-y-2 overflow-auto">
            {boxes.map((box) => (
              <div key={box.id} className="rounded border p-2 text-sm">
                <div className="font-mono font-semibold">{box.code}</div>
                <div className="text-xs text-muted-foreground">{[box.warehouse, box.line, box.shelf, box.slot, box.boxNumber].filter(Boolean).join(" - ")}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Đóng</Button>
            <Button type="button" onClick={onPrint}>In nhãn</Button>
          </div>
        </div>
      </div>
    </>
  );
}
