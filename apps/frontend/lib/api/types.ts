export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'VIEWER' | 'COORDINATOR'

export type UserDto = {
  id: string
  username: string
  fullName: string
  role: UserRole | string
  unit?: string | null
  status: boolean
  createdAt?: string | Date
  updatedAt?: string | Date
}

export type StorageBoxDto = {
  id: string
  code: string
  warehouse: string
  line: string
  shelf: string
  slot: string
  boxNumber: string
  agencyId?: string | null
  agency?: AgencyHistoryDto | null
  caseType?: string | null
  year?: number | null
  fromFileCode?: string | null
  toFileCode?: string | null
  retention?: string | null
  _count?: { files: number }
}

export type AgencyHistoryDto = {
  id: string
  name: string
  startDate: string | Date
  endDate?: string | Date | null
}

export type DocumentDto = {
  id: string
  code?: string | null
  title: string
  year?: number | null
  pageCount?: number | null
  order?: number | null
  contentIndex?: string | null
  preservationTime?: string | null
  note?: string | null
  fileId: string
}

export type FileDto = {
  id: string
  code: string
  title: string
  type: string
  datetime: string | Date
  year?: number | null
  pageCount?: number | null
  details?: unknown
  judgmentDate?: string | Date | null
  retention?: string | null
  note?: string | null
  indexCode?: string | null
  judgmentNumber?: string | null
  defendants: string[]
  plaintiffs: string[]
  civilDefendants: string[]
  isLocked: boolean
  status: string
  boxId?: string | null
  box: StorageBoxDto | null
  documents?: DocumentDto[]
  borrowItems?: BorrowItemDto[]
  fileIndex?: FileIndexDto | null
  createdById?: string | null
  updatedById?: string | null
  createdBy?: Pick<UserDto, 'id' | 'username' | 'fullName'> | null
  updatedBy?: Pick<UserDto, 'id' | 'username' | 'fullName'> | null
  createdAt?: string | Date
  updatedAt?: string | Date
}

export type FileIndexDto = {
  id: string
  fileId: string
  attachments: string[]
  totalPage: number
  judgmentTime: string | Date
  createdAt?: string | Date
  updatedAt?: string | Date
}

export type BorrowSlipDto = {
  id: string
  code: string
  borrowerName: string
  borrowerUnit?: string | null
  borrowerTitle?: string | null
  reason?: string | null
  borrowDate: string | Date
  dueDate: string | Date
  returnedDate?: string | Date | null
  status: string
  approvedById?: string | null
  approvedAt?: string | Date | null
  rejectedById?: string | null
  rejectedAt?: string | Date | null
  rejectReason?: string | null
  exportedById?: string | null
  exportedAt?: string | Date | null
  lenderId: string
  lender?: UserDto
  items?: BorrowItemDto[]
  events?: BorrowSlipEventDto[]
  createdAt?: string | Date
  updatedAt?: string | Date
}

export type BorrowItemDto = {
  id: string
  borrowSlipId: string
  fileId: string
  file: FileDto
  borrowSlip?: BorrowSlipDto
  returnedDate?: string | Date | null
  status: string
  condition?: string | null
}

export type BorrowSlipEventDto = {
  id: string
  borrowSlipId: string
  eventType: string
  description?: string | null
  details?: unknown
  creatorId?: string | null
  creator?: Pick<UserDto, 'fullName' | 'username'>
  createdAt: string | Date
}

export type AuditLogDto = {
  id: string
  action: string
  target: string
  targetId?: string | null
  detail?: unknown
  ipAddress?: string | null
  macAddress?: string | null
  userId?: string | null
  user?: UserDto | null
  createdAt: string | Date
}

export type UserAccessEvent = 'LOGIN' | 'LOGOUT'

export type UserAccessLogDto = {
  id: string
  userId: string
  user?: UserDto | null
  event: UserAccessEvent | string
  occurredAt: string | Date
  ipAddress?: string | null
  userAgent?: string | null
  deviceType?: string | null
  osName?: string | null
  osVersion?: string | null
  browserName?: string | null
  browserVersion?: string | null
  macAddress?: string | null
}

export type UserAccessLogSummaryDto = {
  totalLogins: number
  totalLogouts: number
  activeUsers: number
  lastAccessAt: string | Date | null
}

export type BackupScheduleDto = {
  id: string
  enabled: boolean
  frequency: string
  timeOfDay: string
  retentionDays: number
  target: string
  lastRunAt?: string | Date | null
  lastStatus?: string | null
  lastMessage?: string | null
}

export type AutocompleteSuggestions = {
  types: string[]
  retentions: string[]
  titles: string[]
  documentTitles?: string[]
}

export type DailyContribution = {
  date: string
  files: number
  documents: number
  total: number
}

export type UserContributionsResponse = {
  userId: string
  fullName: string
  username: string
  contributions: DailyContribution[]
}
