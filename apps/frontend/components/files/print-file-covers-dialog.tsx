"use client";

import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Modal from "@/components/modal";
import { Printer } from "lucide-react";
import type { FileWithBox } from "./columns";

// A4 dimensions in mm
const A4_W_MM = 210;
const A4_H_MM = 297;

// Preview panel width in px (fixed)
const PREVIEW_PX = 260;
const SCALE = PREVIEW_PX / A4_W_MM; // px per mm

export function PrintFileCoversDialog({
  files,
  isOpen,
  onClose,
}: {
  files: FileWithBox[];
  isOpen: boolean;
  onClose: () => void;
}) {
  const [layout, setLayout] = useState<"1" | "2" | "3" | "4">("2");
  const [fontSize, setFontSize] = useState<number>(14);
  const [margin, setMargin] = useState<number>(15);

  // Reset margin default when layout changes
  useEffect(() => {
    setMargin(layout === "3" ? 8 : 15);
  }, [layout]);

  const formatDate = (date: string | Date | null | undefined) => {
    if (!date) return "";
    try {
      return format(new Date(date), "dd/MM/yyyy", { locale: vi });
    } catch {
      return "";
    }
  };

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const formatPeople = (people: string[] | null | undefined) =>
    escapeHtml((people || []).join(", "));

  const numPerPage =
    layout === "1" ? 1 : layout === "2" ? 2 : layout === "3" ? 3 : 4;

  // ── Preview helpers ──────────────────────────────────────────────
  const previewFiles = useMemo(
    () => files.slice(0, numPerPage),
    [files, numPerPage]
  );

  const previewH = A4_H_MM * SCALE;

  const contentW = A4_W_MM - margin * 2;
  const contentH = A4_H_MM - margin * 2;

  // gap between covers (mm)
  const gapMm = layout === "2" ? 10 : layout === "3" ? 6 : 5;

  // cover height for preview (mm)
  const cols = layout === "4" ? 2 : 1;
  const rows = layout === "1" ? 1 : layout === "2" ? 2 : layout === "3" ? 3 : 2;
  const coverW = (contentW - (cols - 1) * gapMm) / cols;
  const coverH = (contentH - (rows - 1) * gapMm) / rows;

  const coverStyle = (idx: number): React.CSSProperties => {
    const col = layout === "4" ? idx % 2 : 0;
    const row = layout === "4" ? Math.floor(idx / 2) : idx;
    return {
      position: "absolute",
      left: (margin + col * (coverW + gapMm)) * SCALE,
      top: (margin + row * (coverH + gapMm)) * SCALE,
      width: coverW * SCALE,
      height: coverH * SCALE,
      border: "1px solid #333",
      boxSizing: "border-box",
      overflow: "hidden",
      backgroundColor: "#fff",
      display: "flex",
      flexDirection: "column",
      fontSize: 5,
      fontFamily: "serif",
    };
  };

  const previewRows = [
    { label: "Loại án", key: "type" },
    { label: "Mã hồ sơ", key: "code" },
    { label: "Số bản án", key: "judgmentNumber" },
    { label: "Ngày", key: "judgmentDate" },
    { label: "Nguyên đơn", key: "plaintiffs" },
    { label: "Bị đơn", key: "defendants" },
    { label: "Số bút lục", key: "pageCount" },
    { label: "Vụ việc", key: "title" },
  ];

  // ── Print HTML ───────────────────────────────────────────────────
  const handlePrint = () => {
    const printWindow = window.open("", "_blank", "width=800,height=800");
    if (!printWindow) return;

    let gridStyle = "grid-template-columns: 1fr;";
    if (layout === "2") {
      gridStyle = `grid-template-columns: 1fr; grid-template-rows: 1fr 1fr; gap: ${gapMm}mm;`;
    } else if (layout === "3") {
      gridStyle = `grid-template-columns: 1fr; grid-template-rows: 1fr 1fr 1fr; gap: ${gapMm}mm;`;
    } else if (layout === "4") {
      gridStyle = `grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: ${gapMm}mm;`;
    }

    const chunks: FileWithBox[][] = [];
    for (let i = 0; i < files.length; i += numPerPage) {
      chunks.push(files.slice(i, i + numPerPage));
    }

    const htmlPages = chunks
      .map((chunkFiles) => {
        const chunkHtml = chunkFiles
          .map((file) => {
            const typeYear = `${file.type || ""} ${file.year || ""}`.trim();
            const plaintiffs = formatPeople(file.plaintiffs);
            const defendants = formatPeople([
              ...(file.civilDefendants || []),
              ...(file.defendants || []),
            ]);

            return `
              <div class="cover-wrapper">
                <table class="cover-table">
                  <tbody>
                    <tr>
                      <td class="label">Loại án:</td>
                      <td class="value font-bold">${escapeHtml(typeYear)}</td>
                    </tr>
                    <tr>
                      <td class="label">Mã hồ sơ:</td>
                      <td class="value">${escapeHtml(file.code || "")}</td>
                    </tr>
                    <tr>
                      <td class="label">Số bản án/<br/>quyết định:</td>
                      <td class="value">${escapeHtml(file.judgmentNumber || "")}</td>
                    </tr>
                    <tr>
                      <td class="label">Ngày:</td>
                      <td class="value">${formatDate(file.judgmentDate)}</td>
                    </tr>
                    <tr>
                      <td class="label">Nguyên đơn / Người bị hại:</td>
                      <td class="value">${plaintiffs}</td>
                    </tr>
                    <tr>
                      <td class="label">Bị đơn, bị cáo:</td>
                      <td class="value">${defendants}</td>
                    </tr>
                    <tr>
                      <td class="label">Số bút lục:</td>
                      <td class="value">${file.pageCount || ""}</td>
                    </tr>
                    <tr>
                      <td class="label">Vụ việc:</td>
                      <td class="value">${escapeHtml(file.title || "")}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            `;
          })
          .join("");

        return `<div class="page-container">${chunkHtml}</div>`;
      })
      .join("");

    const paddingCell = layout === "3" ? "4px 6px" : "8px 12px";

    printWindow.document.write(`
      <html>
        <head>
          <title>In bìa hồ sơ</title>
          <style>
            @page {
              size: A4 portrait;
              margin: ${margin}mm;
            }
            body {
              font-family: 'Times New Roman', Times, serif;
              margin: 0;
              padding: 0;
              font-size: ${fontSize}pt;
              line-height: 1.5;
            }
            .page-container {
              display: grid;
              ${gridStyle}
              height: calc(297mm - ${margin * 2}mm);
              page-break-after: always;
            }
            .cover-wrapper {
              display: flex;
              flex-direction: column;
              border: 2px solid #000;
              padding: 10px;
              box-sizing: border-box;
              page-break-inside: avoid;
            }
            .cover-table {
              width: 100%;
              border-collapse: collapse;
            }
            .cover-table td {
              border: 1px solid #000;
              padding: ${paddingCell};
              vertical-align: top;
            }
            .cover-table td.label {
              width: 35%;
              font-weight: normal;
            }
            .cover-table td.value {
              width: 65%;
            }
            .font-bold {
              font-weight: bold;
            }
            @media print {
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="no-print" style="text-align: center; margin-bottom: 20px; font-family: sans-serif;">
             <p>Cửa sổ sẽ tự động đóng sau khi in.</p>
          </div>
          <div class="print-container">
            ${htmlPages}
          </div>
          <script>
            window.onload = () => {
                setTimeout(() => {
                    window.print();
                    window.close();
                }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="In bìa hồ sơ" className="max-w-3xl">
      <div className="flex gap-6">
        {/* ── Left: controls ── */}
        <div className="flex-1 space-y-5 min-w-0">
          <div className="text-sm text-muted-foreground">
            Bạn đã chọn <strong>{files.length}</strong> hồ sơ để in bìa.
            Vui lòng chọn cách ghép trên khổ giấy A4:
          </div>

          {/* Layout buttons */}
          <div className="grid grid-cols-4 gap-3">
            {(["1", "2", "3", "4"] as const).map((v) => (
              <Button
                key={v}
                variant={layout === v ? "default" : "outline"}
                className="h-auto flex-col py-3"
                onClick={() => setLayout(v)}
              >
                <span className="text-lg font-bold mb-0.5">{v}</span>
                <span className="text-xs">bìa / A4</span>
              </Button>
            ))}
          </div>

          {/* Margin control */}
          <div className="space-y-2 border-t pt-4">
            <label className="text-xs font-semibold text-foreground block">
              Lề trang (mm)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={3}
                max={25}
                step={1}
                value={margin}
                onChange={(e) => setMargin(Number(e.target.value))}
                className="flex-1 accent-primary"
              />
              <Input
                type="number"
                min={3}
                max={25}
                value={margin}
                onChange={(e) =>
                  setMargin(Math.max(3, Math.min(25, Number(e.target.value) || 10)))
                }
                className="w-20 h-8 text-sm"
              />
              <span className="text-xs text-muted-foreground">mm</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Khuyến nghị: {layout === "3" ? "6–10" : "12–18"} mm cho layout này
            </p>
          </div>

          {/* Font size */}
          <div className="space-y-2 border-t pt-4">
            <label htmlFor="fontSize" className="text-xs font-semibold text-foreground block">
              Cỡ chữ in (pt)
            </label>
            <div className="flex items-center gap-2">
              <Input
                id="fontSize"
                type="number"
                min={8}
                max={36}
                value={fontSize}
                onChange={(e) => setFontSize(parseInt(e.target.value) || 14)}
                className="w-24 h-9"
              />
              <span className="text-xs text-muted-foreground">(Mặc định: 14pt)</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Hủy
            </Button>
            <Button onClick={handlePrint} className="gap-2">
              <Printer className="h-4 w-4" />
              Bắt đầu in
            </Button>
          </div>
        </div>

        {/* ── Right: A4 preview ── */}
        <div className="flex flex-col items-center gap-2 shrink-0">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Xem trước (A4)
          </span>
          {/* A4 paper */}
          <div
            style={{
              width: PREVIEW_PX,
              height: previewH,
              backgroundColor: "#fff",
              border: "1px solid #ccc",
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              position: "relative",
              flexShrink: 0,
            }}
          >
            {/* Margin guides */}
            <div
              style={{
                position: "absolute",
                left: margin * SCALE,
                top: margin * SCALE,
                right: margin * SCALE,
                bottom: margin * SCALE,
                border: "1px dashed #aaa",
                pointerEvents: "none",
              }}
            />

            {/* Cover cards */}
            {previewFiles.map((file, idx) => (
              <div key={idx} style={coverStyle(idx)}>
                <div
                  style={{
                    backgroundColor: "#1a1a2e",
                    color: "#fff",
                    padding: "2px 3px",
                    fontSize: 5,
                    fontWeight: "bold",
                    textAlign: "center",
                    flexShrink: 0,
                  }}
                >
                  Bìa hồ sơ {idx + 1}
                </div>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    flex: 1,
                  }}
                >
                  <tbody>
                    {previewRows.map((row) => (
                      <tr key={row.key}>
                        <td
                          style={{
                            border: "0.5px solid #333",
                            padding: "1px 2px",
                            width: "38%",
                            fontSize: 4.5,
                            color: "#555",
                            verticalAlign: "top",
                          }}
                        >
                          {row.label}
                        </td>
                        <td
                          style={{
                            border: "0.5px solid #333",
                            padding: "1px 2px",
                            fontSize: 4.5,
                            verticalAlign: "top",
                          }}
                        >
                          {row.key === "judgmentDate"
                            ? formatDate(file.judgmentDate)
                            : row.key === "plaintiffs"
                            ? (file.plaintiffs || []).join(", ")
                            : row.key === "defendants"
                            ? [
                                ...(file.civilDefendants || []),
                                ...(file.defendants || []),
                              ].join(", ")
                            : String((file as unknown as Record<string, unknown>)[row.key] ?? "")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}

            {/* Empty slots (faded) */}
            {Array.from({ length: numPerPage - previewFiles.length }).map(
              (_, idx) => {
                const realIdx = previewFiles.length + idx;
                return (
                  <div
                    key={`empty-${idx}`}
                    style={{
                      ...coverStyle(realIdx),
                      backgroundColor: "#f5f5f5",
                      border: "1px dashed #bbb",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <span style={{ fontSize: 5, color: "#bbb" }}>Trống</span>
                  </div>
                );
              }
            )}
          </div>

          {/* Margin label */}
          <span className="text-xs text-muted-foreground">
            Lề: {margin} mm &nbsp;|&nbsp; {numPerPage} bìa/trang
          </span>
        </div>
      </div>
    </Modal>
  );
}
