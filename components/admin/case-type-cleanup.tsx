import { useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, GitMerge, Loader2, Pencil, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AutocompleteInput } from "@/components/ui/autocomplete-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { describeRenameTarget, showWhitespace, type CaseTypeGroup } from "@/lib/data-cleanup/case-types";
import { useBlankCaseTypeRecords, useCaseTypeGroups, useFillCaseType, useRenameCaseType } from "@/lib/hooks/use-data-cleanup";

const numberFormat = new Intl.NumberFormat("vi-VN");

export function CaseTypeCleanup() {
  const { data, isLoading, error } = useCaseTypeGroups();
  const [editing, setEditing] = useState<CaseTypeGroup | null>(null);
  const [blankOpen, setBlankOpen] = useState(false);

  const groups = useMemo(() => data?.groups ?? [], [data]);
  const blank = data?.blank ?? { boxCount: 0, fileCount: 0 };
  const hasBlank = blank.boxCount + blank.fileCount > 0;
  const suggestions = useMemo(() => [...new Set(groups.map((group) => group.value.trim()))], [groups]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="Đang tải" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Không tải được danh sách Loại án</AlertTitle>
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <Alert>
        <AlertTriangle aria-hidden="true" />
        <AlertTitle>Nên sao lưu dữ liệu trước khi chuẩn hoá</AlertTitle>
        <AlertDescription>
          Đổi tên một Loại án sẽ cập nhật mọi Hộp và Hồ sơ đang mang đúng giá trị đó, và không thể hoàn tác tự động.
        </AlertDescription>
      </Alert>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Loại án</TableHead>
              <TableHead className="w-28 text-right">Số hộp</TableHead>
              <TableHead className="w-28 text-right">Số hồ sơ</TableHead>
              <TableHead className="w-28" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {hasBlank && (
              <TableRow className="bg-amber-50/60 dark:bg-amber-950/20">
                <TableCell>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 font-medium text-amber-800 dark:text-amber-300"
                    onClick={() => setBlankOpen((open) => !open)}
                    aria-expanded={blankOpen}
                  >
                    {blankOpen ? <ChevronDown className="h-4 w-4" aria-hidden="true" /> : <ChevronRight className="h-4 w-4" aria-hidden="true" />}
                    (Chưa có Loại án)
                  </button>
                </TableCell>
                <TableCell className="text-right tabular-nums">{numberFormat.format(blank.boxCount)}</TableCell>
                <TableCell className="text-right tabular-nums">{numberFormat.format(blank.fileCount)}</TableCell>
                <TableCell />
              </TableRow>
            )}
            {hasBlank && blankOpen && (
              <TableRow>
                <TableCell colSpan={4} className="whitespace-normal bg-muted/30 p-0">
                  {/* w-0 min-w-full: panel lấp đầy bảng nhưng không làm bảng nới rộng theo nội dung dài */}
                  <div className="w-0 min-w-full">
                    <BlankCaseTypeRecords />
                  </div>
                </TableCell>
              </TableRow>
            )}
            {groups.map((group) => (
              <TableRow key={group.value}>
                <TableCell>
                  <span className="whitespace-pre font-medium">{showWhitespace(group.value)}</span>
                  {group.hasExtraWhitespace && (
                    <Badge variant="outline" className="ml-2 border-amber-300 text-amber-700 dark:text-amber-300">
                      Có khoảng trắng thừa
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">{numberFormat.format(group.boxCount)}</TableCell>
                <TableCell className="text-right tabular-nums">{numberFormat.format(group.fileCount)}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(group)}>
                    <Pencil className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                    Sửa
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {groups.length === 0 && !hasBlank && (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  Chưa có dữ liệu Loại án.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {editing && (
        <RenameCaseTypeDialog
          group={editing}
          groups={groups}
          suggestions={suggestions.filter((value) => value !== editing.value)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function RenameCaseTypeDialog({
  group,
  groups,
  suggestions,
  onClose,
}: {
  group: CaseTypeGroup;
  groups: CaseTypeGroup[];
  suggestions: string[];
  onClose: () => void;
}) {
  const [input, setInput] = useState(group.value.trim());
  const rename = useRenameCaseType();
  const target = describeRenameTarget(groups, group.value, input);

  const submit = async () => {
    if (target.kind === "invalid") return;
    try {
      const result = await rename.mutateAsync({ from: group.value, to: target.value });
      toast.success(`Đã cập nhật ${result.boxesUpdated} hộp và ${result.filesUpdated} hồ sơ sang "${target.value}"`);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể đổi tên Loại án");
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sửa Loại án</DialogTitle>
          <DialogDescription>
            Giá trị hiện tại: <span className="whitespace-pre font-medium text-foreground">"{showWhitespace(group.value)}"</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <label className="text-sm font-medium" htmlFor="case-type-rename-input">Loại án đúng</label>
          <AutocompleteInput
            id="case-type-rename-input"
            value={input}
            onValueChange={setInput}
            suggestions={suggestions}
            autoFocus
          />

          {target.kind === "merge" && (
            <p className="flex items-start gap-2 rounded-md bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
              <GitMerge className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              Sẽ gộp vào nhóm "{target.value}" (đang có {numberFormat.format(target.boxCount)} hộp, {numberFormat.format(target.fileCount)} hồ sơ).
            </p>
          )}
          {target.kind === "new" && (
            <p className="flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              Tạo Loại án mới "{target.value}". Kiểm tra lại chính tả nếu bạn định gộp vào một nhóm có sẵn.
            </p>
          )}
          {target.kind === "invalid" && input.trim() !== "" && (
            <p className="text-sm text-destructive">{target.reason}</p>
          )}

          <p className="text-sm text-muted-foreground">
            Sẽ cập nhật <strong className="text-foreground">{numberFormat.format(group.boxCount)} hộp</strong> và{" "}
            <strong className="text-foreground">{numberFormat.format(group.fileCount)} hồ sơ</strong> đang mang đúng giá trị hiện tại.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={rename.isPending}>Huỷ</Button>
          <Button onClick={submit} disabled={target.kind === "invalid" || rename.isPending}>
            {rename.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            Xác nhận
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BlankCaseTypeRecords() {
  const { data, isLoading, error } = useBlankCaseTypeRecords(true);

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-primary" aria-label="Đang tải" />
      </div>
    );
  }
  if (error || !data) {
    return <p className="px-4 py-3 text-sm text-destructive">Không tải được danh sách bản ghi thiếu Loại án.</p>;
  }

  return (
    <div className="space-y-4 p-4">
      {data.boxes.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Hộp chưa có Loại án ({data.boxes.length})</h3>
          {data.boxes.map((box) => (
            <FillCaseTypeRow
              key={box.id}
              kind="box"
              id={box.id}
              label={`Hộp số ${box.boxNumber}`}
              detail={`${box.code} · ${[box.warehouse, box.line, box.shelf, box.slot].join("-")}`}
              initialValue=""
              suggestions={data.suggestions}
            />
          ))}
        </section>
      )}
      {data.files.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Hồ sơ chưa có Loại án ({data.files.length})</h3>
          {data.files.map((file) => (
            <FillCaseTypeRow
              key={file.id}
              kind="file"
              id={file.id}
              label={file.code}
              href={`/files/${file.id}`}
              detail={[file.title, file.year, file.box ? `Hộp số ${file.box.boxNumber}${file.box.caseType ? ` (${file.box.caseType})` : ""}` : "Chưa có hộp"]
                .filter(Boolean)
                .join(" · ")}
              initialValue={file.box?.caseType ?? ""}
              suggestions={data.suggestions}
            />
          ))}
        </section>
      )}
      {data.boxes.length === 0 && data.files.length === 0 && (
        <p className="text-sm text-muted-foreground">Không còn bản ghi nào thiếu Loại án.</p>
      )}
    </div>
  );
}

function FillCaseTypeRow({
  kind,
  id,
  label,
  href,
  detail,
  initialValue,
  suggestions,
}: {
  kind: "box" | "file";
  id: string;
  label: string;
  href?: string;
  detail: string;
  initialValue: string;
  suggestions: string[];
}) {
  const [value, setValue] = useState(initialValue);
  const fill = useFillCaseType();
  const inputId = `fill-case-type-${kind}-${id}`;

  const submit = async () => {
    try {
      await fill.mutateAsync({ kind, id, value });
      toast.success(`Đã điền Loại án "${value.trim()}" cho ${label}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể lưu Loại án");
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-md border bg-background p-3 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <label htmlFor={inputId} className="block break-all font-medium">
          {href ? (
            <a href={href} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">{label}</a>
          ) : (
            label
          )}
        </label>
        <p className="truncate text-xs text-muted-foreground">{detail}</p>
      </div>
      <div className="flex gap-2 sm:w-96">
        <AutocompleteInput id={inputId} value={value} onValueChange={setValue} suggestions={suggestions} placeholder="Nhập Loại án" />
        <Button size="sm" onClick={submit} disabled={!value.trim() || fill.isPending}>
          {fill.isPending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
          Lưu
        </Button>
      </div>
    </div>
  );
}
