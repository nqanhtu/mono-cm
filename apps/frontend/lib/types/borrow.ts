import type { BorrowItemDto, BorrowSlipDto, FileDto, UserDto } from '@/lib/api/types';

export type BorrowSlipWithDetails = BorrowSlipDto & {
  lender: UserDto;
  items: (BorrowItemDto & { file: FileDto })[];
};
