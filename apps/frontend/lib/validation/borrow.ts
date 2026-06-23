import { z } from 'zod'

export const borrowReturnSchema = z.object({
  itemIds: z.array(z.string().min(1)).min(1).optional(),
  condition: z.string().max(500).optional(),
  note: z.string().max(500).optional(),
  returnedDate: z.coerce.date().optional(),
})

export type BorrowReturnInput = z.infer<typeof borrowReturnSchema>
