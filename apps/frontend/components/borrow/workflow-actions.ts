export function getBorrowWorkflowActions({
  status,
  canManageBorrow,
  canApproveBorrow,
}: {
  status: string
  canManageBorrow?: boolean
  canApproveBorrow?: boolean
}) {
  const isClosed = status === 'RETURNED' || status === 'REJECTED'

  return {
    canApprove: Boolean(canApproveBorrow && status === 'PENDING_APPROVAL'),
    canReject: Boolean(canApproveBorrow && status === 'PENDING_APPROVAL'),
    canExport: Boolean(canManageBorrow && status === 'APPROVED'),
    canReturn: Boolean(canManageBorrow && ['EXPORTED', 'PARTIAL_RETURN', 'OVERDUE'].includes(status)),
    canEdit: Boolean(canManageBorrow),
    canDelete: Boolean(canManageBorrow),
    canPrint: true,
    canViewHistory: true,
    isClosed,
  }
}
