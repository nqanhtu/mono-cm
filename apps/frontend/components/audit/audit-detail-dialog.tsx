"use client"

import { format } from "date-fns"
import { ChevronRight, Eye } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { AuditLogWithUser } from "@/lib/hooks/use-audit"
import { cn } from "@/lib/utils"

type DetailRecord = Record<string, unknown>

const detailLabels: Record<string, string> = {
  action: "Thao tác",
  agency: "Phông lưu trữ",
  browser: "Trình duyệt",
  changes: "Thay đổi",
  code: "Mã",
  count: "Số lượng",
  deletedCounts: "Dữ liệu đã xóa",
  errors: "Lỗi",
  failed: "Thất bại",
  fileId: "ID hồ sơ",
  filename: "Tên tệp",
  files: "Hồ sơ",
  location: "Vị trí",
  name: "Tên",
  returnedFiles: "Hồ sơ đã trả",
  size: "Kích thước",
  source: "Nguồn",
  stats: "Thống kê",
  status: "Trạng thái",
  success: "Thành công",
  title: "Tiêu đề",
  total: "Tổng",
  year: "Năm",
}

const summaryFields = [
  "code",
  "title",
  "name",
  "filename",
  "count",
  "status",
  "location",
]

const groupedFields = new Set(["changes", "deletedCounts", "errors"])

function isRecord(value: unknown): value is DetailRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function normalizeDetail(detail: unknown): DetailRecord | null {
  if (detail === null || detail === undefined || detail === "") {
    return null
  }

  if (typeof detail === "string") {
    try {
      const parsed: unknown = JSON.parse(detail)
      if (isRecord(parsed)) {
        return parsed
      }
      if (Array.isArray(parsed)) {
        return { items: parsed }
      }
      return parsed === null || parsed === undefined ? null : { value: parsed }
    } catch {
      return null
    }
  }

  if (isRecord(detail)) {
    return detail
  }

  if (Array.isArray(detail)) {
    return { items: detail }
  }

  return { value: detail }
}

function getLabel(key: string) {
  return detailLabels[key] ?? key
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "-"
  }
  if (typeof value === "boolean") {
    return value ? "Có" : "Không"
  }
  if (typeof value === "number" || typeof value === "bigint") {
    return value.toString()
  }
  if (typeof value === "string") {
    return value
  }
  return JSON.stringify(value)
}

function countRecordValues(value: unknown) {
  if (!isRecord(value)) {
    return 0
  }
  return Object.values(value).reduce<number>((total, current) => {
    if (typeof current === "number") {
      return total + current
    }
    const numericValue = Number(current)
    return Number.isFinite(numericValue) ? total + numericValue : total
  }, 0)
}

function getChangeCount(value: unknown) {
  return isRecord(value) ? Object.keys(value).length : 0
}

function buildDetailSummary(detail: DetailRecord | null) {
  if (!detail) {
    return "Không có chi tiết"
  }

  const summaryParts = summaryFields
    .filter((field) => detail[field] !== undefined && detail[field] !== null && detail[field] !== "")
    .slice(0, 3)
    .map((field) => `${getLabel(field)}: ${formatValue(detail[field])}`)

  const changeCount = getChangeCount(detail.changes)
  if (changeCount > 0) {
    summaryParts.push(`${changeCount} trường thay đổi`)
  }

  const deletedCount = countRecordValues(detail.deletedCounts)
  if (deletedCount > 0) {
    summaryParts.push(`Đã xóa ${deletedCount} mục`)
  }

  if (summaryParts.length > 0) {
    return summaryParts.join(" · ")
  }

  const fallbackParts = Object.entries(detail)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .slice(0, 2)
    .map(([key, value]) => `${getLabel(key)}: ${formatValue(value)}`)

  return fallbackParts.length > 0 ? fallbackParts.join(" · ") : "Không có chi tiết"
}

function actionLabel(action: string) {
  switch (action) {
    case "CREATE":
      return "THÊM MỚI"
    case "UPDATE":
      return "CẬP NHẬT"
    case "DELETE":
      return "XÓA"
    case "LOGIN":
      return "ĐĂNG NHẬP"
    default:
      return action
  }
}

function actionVariant(action: string) {
  switch (action) {
    case "CREATE":
      return "success"
    case "UPDATE":
      return "default"
    case "DELETE":
      return "destructive"
    case "LOGIN":
      return "secondary"
    default:
      return "outline"
  }
}

function renderDetailValue(value: unknown) {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-muted-foreground">Không có dữ liệu</span>
    }

    return (
      <div className="space-y-1">
        {value.map((item, index) => (
          <div key={`${formatValue(item)}-${index}`} className="rounded-md bg-muted px-2 py-1">
            {formatValue(item)}
          </div>
        ))}
      </div>
    )
  }

  if (isRecord(value)) {
    return (
      <div className="space-y-1">
        {Object.entries(value).map(([key, item]) => (
          <div key={key} className="flex gap-2">
            <span className="min-w-24 text-muted-foreground">{getLabel(key)}</span>
            <span className="break-words text-foreground">{formatValue(item)}</span>
          </div>
        ))}
      </div>
    )
  }

  return <span className="break-words text-foreground">{formatValue(value)}</span>
}

function DetailRows({ detail }: { detail: DetailRecord }) {
  const entries = Object.entries(detail).filter(([key]) => !groupedFields.has(key))

  if (entries.length === 0) {
    return null
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-foreground">Thông tin chung</h4>
      <div className="divide-y divide-border rounded-lg border border-border">
        {entries.map(([key, value]) => (
          <div key={key} className="grid gap-2 px-3 py-2 sm:grid-cols-[150px_1fr]">
            <div className="text-muted-foreground">{getLabel(key)}</div>
            <div className="min-w-0">{renderDetailValue(value)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ChangesBlock({ value }: { value: unknown }) {
  if (!isRecord(value) || Object.keys(value).length === 0) {
    return null
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-foreground">Thay đổi</h4>
      <div className="divide-y divide-border rounded-lg border border-border">
        {Object.entries(value).map(([key, change]) => {
          const fromValue = isRecord(change) ? change.from ?? change.old ?? change.before : undefined
          const toValue = isRecord(change) ? change.to ?? change.new ?? change.after : undefined
          const hasFromTo = fromValue !== undefined || toValue !== undefined

          return (
            <div key={key} className="grid gap-2 px-3 py-2 sm:grid-cols-[150px_1fr]">
              <div className="text-muted-foreground">{getLabel(key)}</div>
              <div className="flex min-w-0 items-center gap-2">
                {hasFromTo ? (
                  <>
                    <span className="break-words rounded-md bg-muted px-2 py-1">
                      {formatValue(fromValue)}
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                    <span className="break-words rounded-md bg-muted px-2 py-1">
                      {formatValue(toValue)}
                    </span>
                  </>
                ) : (
                  renderDetailValue(change)
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DeletedCountsBlock({ value }: { value: unknown }) {
  if (!isRecord(value) || Object.keys(value).length === 0) {
    return null
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-foreground">Dữ liệu đã xóa</h4>
      <div className="grid gap-2 sm:grid-cols-2">
        {Object.entries(value).map(([key, item]) => (
          <div key={key} className="rounded-lg border border-border px-3 py-2">
            <div className="text-xs text-muted-foreground">{getLabel(key)}</div>
            <div className="text-base font-semibold text-foreground">{formatValue(item)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ErrorsBlock({ value }: { value: unknown }) {
  const errors = Array.isArray(value) ? value : value ? [value] : []

  if (errors.length === 0) {
    return null
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-foreground">Lỗi</h4>
      <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
        {errors.map((error, index) => (
          <div key={`${formatValue(error)}-${index}`} className="text-sm text-destructive">
            {formatValue(error)}
          </div>
        ))}
      </div>
    </div>
  )
}

function MetadataItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 break-words text-sm font-medium text-foreground">{value}</div>
    </div>
  )
}

export function AuditDetailCell({ log }: { log: AuditLogWithUser }) {
  const detail = normalizeDetail(log.detail)
  const summary = buildDetailSummary(detail)

  if (!detail) {
    return <Badge variant="outline">Không có chi tiết</Badge>
  }

  const rawJson = JSON.stringify(detail, null, 2)
  const userName = log.user?.fullName ?? "Không rõ"
  const username = log.user?.username ? `@${log.user.username}` : ""
  const createdAt = format(new Date(log.createdAt), "dd/MM/yyyy HH:mm:ss")

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="h-auto max-w-xs justify-start gap-2 rounded-lg px-2 py-1.5 text-left"
        >
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            {summary}
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary">
            <Eye className="size-3" />
            Xem
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={actionVariant(log.action)}>{actionLabel(log.action)}</Badge>
            <Badge variant="secondary">{log.target}</Badge>
          </div>
          <DialogTitle>Chi tiết nhật ký thao tác</DialogTitle>
          <DialogDescription>{summary}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 rounded-lg border border-border bg-muted/30 p-3 sm:grid-cols-2">
          <MetadataItem label="Tài khoản" value={`${userName} ${username}`.trim()} />
          <MetadataItem label="Thời gian" value={createdAt} />
          <MetadataItem label="Địa chỉ IP" value={log.ipAddress ?? "Không có"} />
          <MetadataItem label="Địa chỉ MAC" value={log.macAddress ?? "Không có"} />
          <MetadataItem label="ID đối tượng" value={log.targetId ?? "Không có"} />
        </div>

        <div className="space-y-5">
          <DetailRows detail={detail} />
          <ChangesBlock value={detail.changes} />
          <DeletedCountsBlock value={detail.deletedCounts} />
          <ErrorsBlock value={detail.errors} />
        </div>

        <details className="rounded-lg border border-border bg-muted/30">
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-foreground">
            Dữ liệu gốc
          </summary>
          <pre
            className={cn(
              "max-h-72 overflow-auto border-t border-border p-3 text-xs text-muted-foreground",
              "whitespace-pre-wrap break-words"
            )}
          >
            {rawJson}
          </pre>
        </details>
      </DialogContent>
    </Dialog>
  )
}
