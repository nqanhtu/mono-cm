import {
  BorrowSlipModel,
  UserModel,
  BorrowItemModel,
  FileModel,
} from '@/generated/prisma/models';

export type BorrowSlipWithDetails = BorrowSlipModel & {
  lender: UserModel;
  items: (BorrowItemModel & { file: FileModel })[];
};
