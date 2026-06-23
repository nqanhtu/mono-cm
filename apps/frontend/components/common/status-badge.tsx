import { Badge } from '@/components/ui/badge'

const labels: Record<string, string> = {
  IN_STOCK: 'Lưu kho',
  BORROWED: 'Đang mượn',
  PENDING_APPROVAL: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
  EXPORTED: 'Đang mượn',
  PARTIAL_RETURN: 'Trả một phần',
  RETURNED: 'Đã trả',
  OVERDUE: 'Quá hạn',
}

export function StatusBadge({ status }: { status: string }) {
  const variant = ['REJECTED', 'OVERDUE'].includes(status)
    ? 'destructive'
    : ['RETURNED', 'APPROVED'].includes(status)
      ? 'success'
      : ['BORROWED', 'EXPORTED', 'PARTIAL_RETURN'].includes(status)
        ? 'warning'
        : 'secondary'

  return <Badge variant={variant}>{labels[status] || status}</Badge>
}
