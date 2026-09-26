import { useMemo, useState, type CSSProperties } from "react";
import { AlertOctagon, AlertTriangle, ChevronDown, ChevronRight, CircleAlert, Info, Loader2, PackageCheck, X } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  assignCaseTypeSlots,
  comboOptions,
  filterMismatchedBoxes,
  KIND_LABELS,
  KIND_ORDER,
  SEVERITY_HINTS,
  SEVERITY_LABELS,
  SEVERITY_ORDER,
  type MismatchedBox,
  type MismatchFilters,
  type MismatchKind,
  type MismatchSeverity,
} from "@/lib/data-cleanup/mismatched-boxes";
import { useMismatchedBoxes } from "@/lib/hooks/use-data-cleanup";

const numberFormat = new Intl.NumberFormat("vi-VN");
const percentFormat = new Intl.NumberFormat("vi-VN", { style: "percent", maximumFractionDigits: 0 });

/** Bảng màu phân loại (thứ tự cố định, đã chạy validator cho light/dark). */
const CATEGORICAL: { light: string; dark: string }[] = [
  { light: "#2a78d6", dark: "#3987e5" },
  { light: "#eb6834", dark: "#d95926" },
  { light: "#1baf7a", dark: "#199e70" },
  { light: "#eda100", dark: "#c98500" },
  { light: "#e87ba4", dark: "#d55181" },
  { light: "#008300", dark: "#008300" },
  { light: "#4a3aa7", dark: "#9085e9" },
  { light: "#e34948", dark: "#e66767" },
];
/** Loại án trùng nhãn Hộp: màu trung tính, để các Loại án lệch nổi lên. */
const MATCHING = { light: "#c9c8c1", dark: "#55544f" };
const OVERFLOW = { light: "#8a897f", dark: "#8a897f" };

/** Màu trạng thái — luôn đi kèm biểu tượng và chữ. */
const SEVERITY_STYLE: Record<MismatchSeverity, { color: string; icon: typeof AlertOctagon }> = {
  "wrong-label": { color: "#d03b3b", icon: AlertOctagon },
  significant: { color: "#ec835a", icon: AlertTriangle },
  minor: { color: "#fab219", icon: CircleAlert },
};

type Swatch = { light: string; dark: string };

function swatchStyle(swatch: Swatch) {
  return { "--swatch-light": swatch.light, "--swatch-dark": swatch.dark } as CSSProperties;
}
const SWATCH_BG = "bg-[var(--swatch-light)] dark:bg-[var(--swatch-dark)]";

const EMPTY_FILTERS: MismatchFilters = { severity: null, kind: null, combo: null };

export function MismatchedBoxes({ onGoToCaseTypes }: { onGoToCaseTypes: () => void }) {
  const { data, isLoading, error } = useMismatchedBoxes();
  const [filters, setFilters] = useState<MismatchFilters>(EMPTY_FILTERS);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const boxes = useMemo(() => data?.boxes ?? [], [data]);
  const slots = useMemo(() => assignCaseTypeSlots(boxes, CATEGORICAL.length), [boxes]);
  const combos = useMemo(() => comboOptions(boxes), [boxes]);
  const visible = useMemo(() => filterMismatchedBoxes(boxes, filters), [boxes, filters]);
  const hasFilters = filters.severity !== null || filters.kind !== null || filters.combo !== null;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="Đang tải" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Không tải được danh sách Hộp lệch loại</AlertTitle>
        <AlertDescription>{error?.message}</AlertDescription>
      </Alert>
    );
  }

  const toggle = <K extends keyof MismatchFilters>(key: K, value: MismatchFilters[K]) =>
    setFilters((current) => ({ ...current, [key]: current[key] === value ? null : value }));

  const toggleExpanded = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const colorFor = (box: MismatchedBox, caseType: string): Swatch => {
    if (caseType === box.caseType) return MATCHING;
    const slot = slots.get(caseType);
    return slot === null || slot === undefined ? OVERFLOW : CATEGORICAL[slot];
  };

  return (
    <div className="space-y-4">
      <Alert>
        <Info aria-hidden="true" />
        <AlertTitle>Nên chuẩn hoá Loại án trước</AlertTitle>
        <AlertDescription>
          <p>
            Loại án được so sánh chính xác từng chữ, nên lỗi chính tả (ví dụ nhãn "Hình sự" với hồ sơ "Hình sự sơ thẩm") cũng
            bị tính là lệch. Tab này chỉ hiển thị, không sửa dữ liệu.
          </p>
          <Button variant="link" className="h-auto p-0" onClick={onGoToCaseTypes}>
            Sang tab Loại án để chuẩn hoá
          </Button>
        </AlertDescription>
      </Alert>

      {data.summary.totalBoxes === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border py-12 text-center">
          <PackageCheck className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="font-medium">Không có Hộp nào chứa Hồ sơ lệch loại</p>
          <p className="text-sm text-muted-foreground">Mọi Hồ sơ đều khớp nhãn Loại án của Hộp chứa nó.</p>
        </div>
      ) : (
        <>
          <section aria-label="Tổng quan" className="space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Hộp có hồ sơ lệch</p>
                <p className="text-2xl font-semibold tabular-nums">{numberFormat.format(data.summary.totalBoxes)}</p>
                <p className="text-xs text-muted-foreground">{numberFormat.format(data.summary.mismatchedFiles)} hồ sơ lệch</p>
              </div>
              {SEVERITY_ORDER.map((severity) => {
                const { color, icon: Icon } = SEVERITY_STYLE[severity];
                const active = filters.severity === severity;
                return (
                  <button
                    key={severity}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggle("severity", severity)}
                    className={cn(
                      "rounded-lg border p-3 text-left text-foreground transition-colors hover:bg-muted/50",
                      active && "border-primary bg-primary/5 ring-1 ring-primary"
                    )}
                  >
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Icon className="h-3.5 w-3.5" style={{ color }} aria-hidden="true" />
                      {SEVERITY_LABELS[severity]}
                    </p>
                    <p className="text-2xl font-semibold tabular-nums">{numberFormat.format(data.summary.bySeverity[severity])}</p>
                    <p className="text-xs text-muted-foreground">{SEVERITY_HINTS[severity]}</p>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-2">
              {KIND_ORDER.filter((kind) => data.summary.byKind[kind] > 0).map((kind) => {
                const active = filters.kind === kind;
                return (
                  <button
                    key={kind}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggle("kind", kind)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-sm text-foreground transition-colors hover:bg-muted/50",
                      active && "border-primary bg-primary/5 ring-1 ring-primary"
                    )}
                  >
                    {KIND_LABELS[kind]} <span className="font-semibold tabular-nums">{numberFormat.format(data.summary.byKind[kind])}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={filters.combo ?? "all"} onValueChange={(value) => setFilters((current) => ({ ...current, combo: value === "all" ? null : value }))}>
              <SelectTrigger aria-label="Lọc theo tổ hợp Loại án" className="h-9 w-full rounded-lg sm:w-96">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Mọi tổ hợp Loại án</SelectItem>
                {combos.map(({ combo, count }) => (
                  <SelectItem key={combo} value={combo}>
                    {combo} ({count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>
                <X className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                Xoá bộ lọc
              </Button>
            )}
            <p className="ml-auto text-sm text-muted-foreground" aria-live="polite">
              {numberFormat.format(visible.length)} / {numberFormat.format(boxes.length)} hộp
            </p>
          </div>

          {visible.length === 0 ? (
            <div className="rounded-lg border py-10 text-center text-sm text-muted-foreground">
              Không có Hộp nào khớp bộ lọc.{" "}
              <Button variant="link" className="h-auto p-0" onClick={() => setFilters(EMPTY_FILTERS)}>
                Xoá bộ lọc
              </Button>
            </div>
          ) : (
            <ul className="divide-y rounded-lg border">
              {visible.map((box) => (
                <MismatchedBoxRow
                  key={box.id}
                  box={box}
                  expanded={expanded.has(box.id)}
                  onToggle={() => toggleExpanded(box.id)}
                  colorFor={(caseType) => colorFor(box, caseType)}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function SeverityBadge({ severity }: { severity: MismatchSeverity }) {
  const { color, icon: Icon } = SEVERITY_STYLE[severity];
  return (
    <span className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium">
      <Icon className="h-3.5 w-3.5" style={{ color }} aria-hidden="true" />
      {SEVERITY_LABELS[severity]}
    </span>
  );
}

function KindBadge({ kind }: { kind: MismatchKind }) {
  return <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{KIND_LABELS[kind]}</span>;
}

function MismatchedBoxRow({
  box,
  expanded,
  onToggle,
  colorFor,
}: {
  box: MismatchedBox;
  expanded: boolean;
  onToggle: () => void;
  colorFor: (caseType: string) => Swatch;
}) {
  const matchingCount = box.totalCount - box.mismatchedCount;
  const panelId = `mismatched-box-${box.id}`;

  return (
    <li>
      <div className="space-y-2 p-4">
        <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-controls={panelId}
            className="flex items-center gap-1 text-left font-semibold"
          >
            {expanded ? <ChevronDown className="h-4 w-4" aria-hidden="true" /> : <ChevronRight className="h-4 w-4" aria-hidden="true" />}
            Hộp số {box.boxNumber}
          </button>
          <span className={cn("text-sm", box.caseType ? "text-foreground" : "italic text-muted-foreground")}>
            {box.caseType ?? "(chưa có nhãn)"}
          </span>
          <SeverityBadge severity={box.severity} />
          <KindBadge kind={box.kind} />
          <span className="ml-auto text-sm tabular-nums">
            <strong>{numberFormat.format(box.mismatchedCount)}</strong>/{numberFormat.format(box.totalCount)} hồ sơ lệch (
            {percentFormat.format(box.mismatchRatio)})
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Kho {box.warehouse} → Dãy {box.line} → Kệ {box.shelf} → Ô {box.slot} · Mã hộp {box.code}
        </p>

        <CompositionBar box={box} colorFor={colorFor} />
      </div>

      {expanded && (
        <div id={panelId} className="border-t bg-muted/30 px-4 py-3">
          <table className="w-full text-sm">
            <caption className="sr-only">Hồ sơ lệch loại trong Hộp số {box.boxNumber}</caption>
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="py-1 pr-3 font-medium">Mã hồ sơ</th>
                <th className="py-1 pr-3 font-medium">Tiêu đề</th>
                <th className="py-1 pr-3 font-medium">Năm</th>
                <th className="py-1 font-medium">Loại án</th>
              </tr>
            </thead>
            <tbody>
              {box.mismatchedFiles.map((file) => (
                <tr key={file.id} className="border-t border-border/60 align-top">
                  <td className="py-1.5 pr-3">
                    <a href={`/files/${file.id}`} target="_blank" rel="noreferrer" className="break-all font-medium underline-offset-2 hover:underline">
                      {file.code}
                    </a>
                  </td>
                  <td className="py-1.5 pr-3">{file.title}</td>
                  <td className="py-1.5 pr-3 tabular-nums">{file.year ?? "—"}</td>
                  <td className="py-1.5">{file.caseType}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {matchingCount > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">và {numberFormat.format(matchingCount)} hồ sơ đúng nhãn</p>
          )}
        </div>
      )}
    </li>
  );
}

function CompositionBar({ box, colorFor }: { box: MismatchedBox; colorFor: (caseType: string) => Swatch }) {
  return (
    <div className="space-y-1.5">
      <div
        className="flex h-2.5 w-full gap-[2px] overflow-hidden rounded-[4px]"
        role="img"
        aria-label={`Thành phần Loại án: ${box.composition.map((item) => `${item.caseType} ${item.count}`).join(", ")}`}
      >
        {box.composition.map((item) => (
          <div
            key={item.caseType}
            title={`${item.caseType}: ${item.count} hồ sơ (${percentFormat.format(item.count / box.totalCount)})`}
            className={cn("h-full min-w-1 first:rounded-l-[4px] last:rounded-r-[4px]", SWATCH_BG)}
            style={{ ...swatchStyle(colorFor(item.caseType)), flexGrow: item.count, flexBasis: 0 }}
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
        {box.composition.map((item) => (
          <li key={item.caseType} className="flex items-center gap-1.5">
            <span className={cn("inline-block h-2 w-2 rounded-[2px]", SWATCH_BG)} style={swatchStyle(colorFor(item.caseType))} aria-hidden="true" />
            <span className="text-foreground">{item.caseType}</span>
            <span className="tabular-nums">{numberFormat.format(item.count)}</span>
            {item.caseType === box.caseType && <span>(đúng nhãn)</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
