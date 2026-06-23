import { getBorrowWorkflowActions } from '@/components/borrow/workflow-actions'

describe('borrow workflow actions', () => {
  it('only exposes approval actions for pending slips when user can approve', () => {
    expect(getBorrowWorkflowActions({
      status: 'PENDING_APPROVAL',
      canApproveBorrow: true,
      canManageBorrow: false,
    })).toMatchObject({
      canApprove: true,
      canReject: true,
      canExport: false,
      canReturn: false,
    })
  })

  it('only exposes export after approval for borrow managers', () => {
    expect(getBorrowWorkflowActions({
      status: 'APPROVED',
      canApproveBorrow: false,
      canManageBorrow: true,
    })).toMatchObject({
      canApprove: false,
      canReject: false,
      canExport: true,
      canReturn: false,
    })
  })

  it('only exposes return after files are exported or overdue', () => {
    expect(getBorrowWorkflowActions({
      status: 'EXPORTED',
      canManageBorrow: true,
    })).toMatchObject({
      canExport: false,
      canReturn: true,
    })
  })
})
