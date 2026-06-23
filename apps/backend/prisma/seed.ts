import "dotenv/config";
import bcrypt from "bcryptjs";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "../generated/prisma/client";
import { AuditAction, UserRole, UserAccessEvent } from "../generated/prisma/enums";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not configured");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const day = 24 * 60 * 60 * 1000;
const now = new Date();
const daysFromNow = (days: number) => new Date(now.getTime() + days * day);

async function upsertAgency(data: {
  name: string;
  startDate: Date;
  endDate: Date | null;
}) {
  const existing = await prisma.agencyHistory.findFirst({
    where: { name: data.name },
  });

  if (existing) {
    return prisma.agencyHistory.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.agencyHistory.create({ data });
}

async function seedAgencies() {
  console.log("Seeding agency history...");

  const agencies = await Promise.all([
    upsertAgency({
      name: "TAND tỉnh Sông Bé",
      startDate: new Date("1976-01-01"),
      endDate: new Date("1996-12-31"),
    }),
    upsertAgency({
      name: "TAND tỉnh Bình Dương",
      startDate: new Date("1997-01-01"),
      endDate: new Date("2025-06-30"),
    }),
    upsertAgency({
      name: "TAND Thành phố Hồ Chí Minh",
      startDate: new Date("2025-07-01"),
      endDate: null,
    }),
  ]);

  return {
    songBe: agencies[0],
    binhDuong: agencies[1],
    hoChiMinh: agencies[2],
  };
}

async function seedUsers() {
  console.log("Seeding users...");

  const genericPassword = await bcrypt.hash("123456", 10);
  const adminPassword = await bcrypt.hash("admin@123", 10);
  const coordinatorPassword = await bcrypt.hash("coordinator", 10);

  const users = await Promise.all([
    prisma.user.upsert({
      where: { username: "superadmin" },
      update: {
        fullName: "Quản trị hệ thống",
        role: UserRole.SUPER_ADMIN,
        status: true,
        unit: "Ban Quản trị",
      },
      create: {
        username: "superadmin",
        fullName: "Quản trị hệ thống",
        role: UserRole.SUPER_ADMIN,
        password: adminPassword,
        status: true,
        unit: "Ban Quản trị",
      },
    }),
    prisma.user.upsert({
      where: { username: "admin" },
      update: {
        fullName: "Nguyễn Văn A",
        role: UserRole.ADMIN,
        status: true,
        unit: "Lãnh đạo Tòa",
      },
      create: {
        username: "admin",
        fullName: "Nguyễn Văn A",
        role: UserRole.ADMIN,
        password: genericPassword,
        status: true,
        unit: "Lãnh đạo Tòa",
      },
    }),
    prisma.user.upsert({
      where: { username: "viewer" },
      update: {
        fullName: "Trần Văn B",
        role: UserRole.VIEWER,
        status: true,
        unit: "Tòa Hình sự",
      },
      create: {
        username: "viewer",
        fullName: "Trần Văn B",
        role: UserRole.VIEWER,
        password: genericPassword,
        status: true,
        unit: "Tòa Hình sự",
      },
    }),
    prisma.user.upsert({
      where: { username: "coordinator" },
      update: {
        fullName: "Lê Thị C",
        role: UserRole.COORDINATOR,
        status: true,
        unit: "Phòng Hành chính Tư pháp",
      },
      create: {
        username: "coordinator",
        fullName: "Lê Thị C",
        role: UserRole.COORDINATOR,
        password: genericPassword,
        status: true,
        unit: "Phòng Hành chính Tư pháp",
      },
    }),
    prisma.user.upsert({
      where: { username: "coordinator1" },
      update: {
        fullName: "Người điều phối 1",
        role: UserRole.COORDINATOR,
        status: true,
        unit: "Phòng Hành chính Tư pháp",
        password: coordinatorPassword,
      },
      create: {
        username: "coordinator1",
        fullName: "Người điều phối 1",
        role: UserRole.COORDINATOR,
        password: coordinatorPassword,
        status: true,
        unit: "Phòng Hành chính Tư pháp",
      },
    }),
    prisma.user.upsert({
      where: { username: "coordinator2" },
      update: {
        fullName: "Người điều phối 2",
        role: UserRole.COORDINATOR,
        status: true,
        unit: "Phòng Hành chính Tư pháp",
        password: coordinatorPassword,
      },
      create: {
        username: "coordinator2",
        fullName: "Người điều phối 2",
        role: UserRole.COORDINATOR,
        password: coordinatorPassword,
        status: true,
        unit: "Phòng Hành chính Tư pháp",
      },
    }),
    prisma.user.upsert({
      where: { username: "inactive" },
      update: {
        fullName: "Phạm Thị D",
        role: UserRole.VIEWER,
        status: false,
        unit: "Tòa Dân sự",
      },
      create: {
        username: "inactive",
        fullName: "Phạm Thị D",
        role: UserRole.VIEWER,
        password: genericPassword,
        status: false,
        unit: "Tòa Dân sự",
      },
    }),
  ]);

  return {
    superadmin: users[0],
    admin: users[1],
    viewer: users[2],
    coordinator: users[3],
    inactive: users[4],
  };
}

async function seedStorage(agencies: Awaited<ReturnType<typeof seedAgencies>>) {
  console.log("Seeding storage boxes...");

  const boxSeeds = [
    {
      code: "BOX-001",
      agencyId: agencies.songBe.id,
      caseType: "Hình sự",
      year: 1995,
      fromFileCode: "HS-1995-001",
      toFileCode: "HS-1995-099",
      retention: "Vĩnh viễn",
    },
    {
      code: "BOX-002",
      agencyId: agencies.binhDuong.id,
      caseType: "Dân sự",
      year: 2021,
      fromFileCode: "DS-2021-001",
      toFileCode: "DS-2021-099",
      retention: "20 năm",
    },
    {
      code: "BOX-003",
      agencyId: agencies.binhDuong.id,
      caseType: "Hôn nhân gia đình",
      year: 2022,
      fromFileCode: "HNGD-2022-001",
      toFileCode: "HNGD-2022-099",
      retention: "10 năm",
    },
    {
      code: "BOX-004",
      agencyId: agencies.binhDuong.id,
      caseType: "Kinh doanh thương mại",
      year: 2023,
      fromFileCode: "KDTM-2023-001",
      toFileCode: "KDTM-2023-099",
      retention: "20 năm",
    },
    {
      code: "BOX-005",
      agencyId: agencies.binhDuong.id,
      caseType: "Hành chính",
      year: 2024,
      fromFileCode: "HC-2024-001",
      toFileCode: "HC-2024-099",
      retention: "Vĩnh viễn",
    },
    {
      code: "BOX-006",
      agencyId: agencies.hoChiMinh.id,
      caseType: "Hình sự",
      year: 2025,
      fromFileCode: "HS-2025-001",
      toFileCode: "HS-2025-099",
      retention: "Vĩnh viễn",
    },
    {
      code: "BOX-007",
      agencyId: agencies.hoChiMinh.id,
      caseType: "Dân sự",
      year: 2026,
      fromFileCode: "DS-2026-001",
      toFileCode: "DS-2026-099",
      retention: "20 năm",
    },
    {
      code: "BOX-008",
      agencyId: agencies.hoChiMinh.id,
      caseType: "Lao động",
      year: 2026,
      fromFileCode: "LD-2026-001",
      toFileCode: "LD-2026-099",
      retention: "10 năm",
    },
  ];

  const boxes = await Promise.all(
    boxSeeds.map((box, index) =>
      prisma.storageBox.upsert({
        where: { code: box.code },
        update: {
          ...box,
          warehouse: index < 5 ? "Kho A" : "Kho B",
          line: `Dãy ${Math.floor(index / 4) + 1}`,
          shelf: `Kệ ${(index % 4) + 1}`,
          slot: `Ô ${(index % 8) + 1}`,
          boxNumber: String(index + 1).padStart(3, "0"),
        },
        create: {
          ...box,
          warehouse: index < 5 ? "Kho A" : "Kho B",
          line: `Dãy ${Math.floor(index / 4) + 1}`,
          shelf: `Kệ ${(index % 4) + 1}`,
          slot: `Ô ${(index % 8) + 1}`,
          boxNumber: String(index + 1).padStart(3, "0"),
        },
      }),
    ),
  );

  await Promise.all(
    boxes.map((box) =>
      prisma.storageBoxLabel.deleteMany({
        where: { storageBoxId: box.id },
      }),
    ),
  );

  await prisma.storageBoxLabel.createMany({
    data: boxes.map((box) => ({
      agencyId: box.agencyId,
      fromYear: box.year,
      toYear: box.year,
      label: `${box.code} - ${box.caseType} ${box.year}`,
      storageBoxId: box.id,
    })),
  });

  return Object.fromEntries(boxes.map((box) => [box.code, box]));
}

async function upsertFile(data: {
  code: string;
  title: string;
  type: string;
  datetime: Date;
  year: number;
  pageCount: number;
  judgmentDate: Date;
  retention: string;
  note?: string;
  indexCode: string;
  judgmentNumber: string;
  defendants?: string[];
  plaintiffs?: string[];
  civilDefendants?: string[];
  status?: string;
  isLocked?: boolean;
  boxId: string;
  details: Prisma.InputJsonValue;
  documents: Array<{
    code: string;
    title: string;
    year: number;
    pageCount: number;
    order: number;
    contentIndex: string;
    preservationTime: string;
    note?: string;
  }>;
}) {
  const file = await prisma.file.upsert({
    where: { code: data.code },
    update: {
      title: data.title,
      type: data.type,
      datetime: data.datetime,
      year: data.year,
      pageCount: data.pageCount,
      details: data.details,
      judgmentDate: data.judgmentDate,
      retention: data.retention,
      note: data.note,
      indexCode: data.indexCode,
      judgmentNumber: data.judgmentNumber,
      defendants: data.defendants ?? [],
      plaintiffs: data.plaintiffs ?? [],
      civilDefendants: data.civilDefendants ?? [],
      status: data.status ?? "IN_STOCK",
      isLocked: data.isLocked ?? false,
      boxId: data.boxId,
    },
    create: {
      code: data.code,
      title: data.title,
      type: data.type,
      datetime: data.datetime,
      year: data.year,
      pageCount: data.pageCount,
      details: data.details,
      judgmentDate: data.judgmentDate,
      retention: data.retention,
      note: data.note,
      indexCode: data.indexCode,
      judgmentNumber: data.judgmentNumber,
      defendants: data.defendants ?? [],
      plaintiffs: data.plaintiffs ?? [],
      civilDefendants: data.civilDefendants ?? [],
      status: data.status ?? "IN_STOCK",
      isLocked: data.isLocked ?? false,
      boxId: data.boxId,
    },
  });

  await prisma.document.deleteMany({ where: { fileId: file.id } });
  await prisma.document.createMany({
    data: data.documents.map((document) => ({
      ...document,
      fileId: file.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
  });

  await prisma.fileIndex.upsert({
    where: { fileId: file.id },
    update: {
      attachments: [
        `/demo/${data.code}/ban-an.pdf`,
        `/demo/${data.code}/muc-luc.pdf`,
      ],
      totalPage: data.pageCount,
      judgmentTime: data.judgmentDate,
    },
    create: {
      fileId: file.id,
      attachments: [
        `/demo/${data.code}/ban-an.pdf`,
        `/demo/${data.code}/muc-luc.pdf`,
      ],
      totalPage: data.pageCount,
      judgmentTime: data.judgmentDate,
    },
  });

  return file;
}

async function seedFiles(boxes: Record<string, { id: string }>) {
  console.log("Seeding case files and documents...");

  const fileSeeds = [
    {
      code: "HS-1995-001",
      title: "Vụ án trộm cắp tài sản tại thị xã Thủ Dầu Một",
      type: "Hình sự",
      datetime: new Date("1995-04-12"),
      year: 1995,
      pageCount: 128,
      judgmentDate: new Date("1995-06-20"),
      retention: "Vĩnh viễn",
      indexCode: "MLHS-1995-001",
      judgmentNumber: "12/1995/HSST",
      defendants: ["Nguyễn Văn Minh"],
      boxId: boxes["BOX-001"].id,
      details: {
        court: "TAND tỉnh Sông Bé",
        summary: "Hồ sơ trước khi tách tỉnh.",
      },
    },
    {
      code: "DS-2021-014",
      title: "Tranh chấp hợp đồng vay tài sản",
      type: "Dân sự",
      datetime: new Date("2021-03-15"),
      year: 2021,
      pageCount: 96,
      judgmentDate: new Date("2021-05-18"),
      retention: "20 năm",
      indexCode: "MLDS-2021-014",
      judgmentNumber: "14/2021/DS-ST",
      plaintiffs: ["Công ty TNHH An Phú"],
      civilDefendants: ["Lê Văn Hải"],
      boxId: boxes["BOX-002"].id,
      details: {
        value: 450000000,
        summary: "Tranh chấp nghĩa vụ thanh toán khoản vay.",
      },
    },
    {
      code: "DS-2021-088",
      title: "Tranh chấp quyền sử dụng đất",
      type: "Dân sự",
      datetime: new Date("2021-11-02"),
      year: 2021,
      pageCount: 210,
      judgmentDate: new Date("2022-01-14"),
      retention: "Vĩnh viễn",
      indexCode: "MLDS-2021-088",
      judgmentNumber: "88/2021/DS-ST",
      plaintiffs: ["Phạm Thị Hoa"],
      civilDefendants: ["Nguyễn Văn Lợi"],
      isLocked: true,
      boxId: boxes["BOX-002"].id,
      details: {
        landLot: "Thửa 112, phường Phú Lợi",
        summary: "Hồ sơ có giá trị lưu trữ lâu dài.",
      },
    },
    {
      code: "HNGD-2022-031",
      title: "Ly hôn và tranh chấp nuôi con",
      type: "Hôn nhân gia đình",
      datetime: new Date("2022-07-04"),
      year: 2022,
      pageCount: 72,
      judgmentDate: new Date("2022-08-22"),
      retention: "10 năm",
      indexCode: "MLHNGD-2022-031",
      judgmentNumber: "31/2022/HNGĐ-ST",
      plaintiffs: ["Trần Thị Lan"],
      civilDefendants: ["Võ Minh Tâm"],
      boxId: boxes["BOX-003"].id,
      details: {
        children: 1,
        summary: "Giải quyết ly hôn và quyền trực tiếp nuôi con.",
      },
    },
    {
      code: "KDTM-2023-009",
      title: "Tranh chấp hợp đồng mua bán hàng hóa",
      type: "Kinh doanh thương mại",
      datetime: new Date("2023-02-11"),
      year: 2023,
      pageCount: 184,
      judgmentDate: new Date("2023-04-19"),
      retention: "20 năm",
      indexCode: "MLKDTM-2023-009",
      judgmentNumber: "09/2023/KDTM-ST",
      plaintiffs: ["Công ty CP Gỗ Nam Việt"],
      civilDefendants: ["Công ty TNHH Bình Minh"],
      boxId: boxes["BOX-004"].id,
      details: {
        contractNo: "HDMB-45/2022",
        summary: "Tranh chấp giao hàng và thanh toán.",
      },
    },
    {
      code: "HC-2024-006",
      title: "Khiếu kiện quyết định xử phạt hành chính",
      type: "Hành chính",
      datetime: new Date("2024-01-26"),
      year: 2024,
      pageCount: 154,
      judgmentDate: new Date("2024-03-12"),
      retention: "Vĩnh viễn",
      indexCode: "MLHC-2024-006",
      judgmentNumber: "06/2024/HC-ST",
      plaintiffs: ["Hộ kinh doanh Minh Tâm"],
      civilDefendants: ["UBND thành phố Thủ Dầu Một"],
      status: "BORROWED",
      boxId: boxes["BOX-005"].id,
      details: {
        decisionNo: "45/QD-XPHC",
        summary: "Hồ sơ đang được mượn quá hạn.",
      },
    },
    {
      code: "HS-2025-021",
      title: "Vụ án cố ý gây thương tích",
      type: "Hình sự",
      datetime: new Date("2025-05-09"),
      year: 2025,
      pageCount: 132,
      judgmentDate: new Date("2025-06-18"),
      retention: "Vĩnh viễn",
      indexCode: "MLHS-2025-021",
      judgmentNumber: "21/2025/HS-ST",
      defendants: ["Đặng Quốc Huy"],
      status: "BORROWED",
      boxId: boxes["BOX-006"].id,
      details: {
        court: "TAND tỉnh Bình Dương",
        note: "Hồ sơ trước mốc sáp nhập 01/07/2025.",
      },
    },
    {
      code: "HS-2025-072",
      title: "Vụ án lừa đảo chiếm đoạt tài sản",
      type: "Hình sự",
      datetime: new Date("2025-08-20"),
      year: 2025,
      pageCount: 246,
      judgmentDate: new Date("2025-10-01"),
      retention: "Vĩnh viễn",
      indexCode: "MLHS-2025-072",
      judgmentNumber: "72/2025/HS-ST",
      defendants: ["Bùi Văn Khánh", "Ngô Thị Mai"],
      boxId: boxes["BOX-006"].id,
      details: {
        court: "TAND Thành phố Hồ Chí Minh",
        note: "Hồ sơ sau mốc sáp nhập Bình Dương vào TP.HCM.",
      },
    },
    {
      code: "DS-2026-004",
      title: "Tranh chấp bồi thường thiệt hại ngoài hợp đồng",
      type: "Dân sự",
      datetime: new Date("2026-01-08"),
      year: 2026,
      pageCount: 118,
      judgmentDate: new Date("2026-02-15"),
      retention: "20 năm",
      indexCode: "MLDS-2026-004",
      judgmentNumber: "04/2026/DS-ST",
      plaintiffs: ["Mai Văn Sơn"],
      civilDefendants: ["Công ty TNHH Vận tải An Khang"],
      status: "BORROWED",
      boxId: boxes["BOX-007"].id,
      details: { summary: "Hồ sơ sắp đến hạn trả trong dữ liệu test." },
    },
    {
      code: "LD-2026-011",
      title: "Tranh chấp đơn phương chấm dứt hợp đồng lao động",
      type: "Lao động",
      datetime: new Date("2026-02-02"),
      year: 2026,
      pageCount: 88,
      judgmentDate: new Date("2026-03-10"),
      retention: "10 năm",
      indexCode: "MLLD-2026-011",
      judgmentNumber: "11/2026/LĐ-ST",
      plaintiffs: ["Nguyễn Thị Kim Ngân"],
      civilDefendants: ["Công ty CP Dịch vụ Sao Nam"],
      boxId: boxes["BOX-008"].id,
      details: {
        summary: "Hồ sơ dùng để test tìm kiếm theo loại án lao động.",
      },
    },
  ];

  const files = await Promise.all(
    fileSeeds.map((file, index) =>
      upsertFile({
        ...file,
        documents: [
          {
            code: `${file.code}-TL01`,
            title: "Đơn khởi kiện hoặc cáo trạng",
            year: file.year,
            pageCount: 8 + index,
            order: 1,
            contentIndex: "01",
            preservationTime: file.retention,
            note: "Tài liệu chính",
          },
          {
            code: `${file.code}-TL02`,
            title: "Biên bản phiên tòa",
            year: file.year,
            pageCount: 12 + index,
            order: 2,
            contentIndex: "02",
            preservationTime: file.retention,
          },
          {
            code: `${file.code}-TL03`,
            title: "Bản án và quyết định liên quan",
            year: file.year,
            pageCount: 10 + index,
            order: 3,
            contentIndex: "03",
            preservationTime: file.retention,
          },
        ],
      }),
    ),
  );

  return Object.fromEntries(files.map((file) => [file.code, file]));
}

async function seedBorrowSlips(
  users: Awaited<ReturnType<typeof seedUsers>>,
  files: Record<string, { id: string }>,
) {
  console.log("Seeding borrow slips...");

  type BorrowSlipSeed = {
    code: string;
    borrowerName: string;
    borrowerUnit: string;
    borrowerTitle: string;
    reason: string;
    borrowDate: Date;
    dueDate: Date;
    returnedDate?: Date;
    status: string;
    lenderId: string;
    items: Array<{
      fileCode: string;
      status: string;
      returnedDate?: Date;
    }>;
  };

  const slips: BorrowSlipSeed[] = [
    {
      code: "PM-2026-001",
      borrowerName: "Hoàng Văn Phúc",
      borrowerUnit: "Tòa Hành chính",
      borrowerTitle: "Thẩm phán",
      reason: "Nghiên cứu hồ sơ phục vụ xét xử phúc thẩm",
      borrowDate: daysFromNow(-20),
      dueDate: daysFromNow(-5),
      status: "OVERDUE",
      lenderId: users.coordinator.id,
      items: [
        { fileCode: "HC-2024-006", status: "BORROWING" },
        { fileCode: "HS-2025-021", status: "BORROWING" },
      ],
    },
    {
      code: "PM-2026-002",
      borrowerName: "Đỗ Thị Hạnh",
      borrowerUnit: "Tòa Dân sự",
      borrowerTitle: "Thư ký",
      reason: "Đối chiếu tài liệu theo yêu cầu nghiệp vụ",
      borrowDate: daysFromNow(-4),
      dueDate: daysFromNow(2),
      status: "BORROWING",
      lenderId: users.coordinator.id,
      items: [{ fileCode: "DS-2026-004", status: "BORROWING" }],
    },
    {
      code: "PM-2026-003",
      borrowerName: "Nguyễn Minh Quân",
      borrowerUnit: "Phòng Hành chính Tư pháp",
      borrowerTitle: "Chuyên viên",
      reason: "Số hóa hồ sơ mẫu",
      borrowDate: daysFromNow(-12),
      dueDate: daysFromNow(-2),
      returnedDate: daysFromNow(-1),
      status: "RETURNED",
      lenderId: users.coordinator.id,
      items: [
        {
          fileCode: "KDTM-2023-009",
          status: "RETURNED",
          returnedDate: daysFromNow(-1),
        },
      ],
    },
  ];

  for (const slip of slips) {
    const existing = await prisma.borrowSlip.upsert({
      where: { code: slip.code },
      update: {
        borrowerName: slip.borrowerName,
        borrowerUnit: slip.borrowerUnit,
        borrowerTitle: slip.borrowerTitle,
        reason: slip.reason,
        borrowDate: slip.borrowDate,
        dueDate: slip.dueDate,
        returnedDate: slip.returnedDate ?? null,
        status: slip.status,
        lenderId: slip.lenderId,
      },
      create: {
        code: slip.code,
        borrowerName: slip.borrowerName,
        borrowerUnit: slip.borrowerUnit,
        borrowerTitle: slip.borrowerTitle,
        reason: slip.reason,
        borrowDate: slip.borrowDate,
        dueDate: slip.dueDate,
        returnedDate: slip.returnedDate ?? null,
        status: slip.status,
        lenderId: slip.lenderId,
      },
    });

    await prisma.borrowSlipEvent.deleteMany({
      where: { borrowSlipId: existing.id },
    });
    await prisma.borrowItem.deleteMany({
      where: { borrowSlipId: existing.id },
    });

    await prisma.borrowItem.createMany({
      data: slip.items.map((item) => ({
        borrowSlipId: existing.id,
        fileId: files[item.fileCode].id,
        status: item.status,
        returnedDate: item.returnedDate ?? null,
        condition: item.status === "RETURNED" ? "Hồ sơ nguyên vẹn" : null,
      })),
    });

    await prisma.borrowSlipEvent.createMany({
      data: [
        {
          borrowSlipId: existing.id,
          eventType: "CREATED",
          description: `Tạo phiếu mượn ${slip.code}`,
          details: { fileCodes: slip.items.map((item) => item.fileCode) },
          creatorId: users.coordinator.id,
        },
        ...(slip.status === "RETURNED"
          ? [
              {
                borrowSlipId: existing.id,
                eventType: "RETURNED_ALL",
                description: `Trả toàn bộ hồ sơ của phiếu ${slip.code}`,
                details: { returnedAt: slip.returnedDate?.toISOString() },
                creatorId: users.coordinator.id,
              },
            ]
          : []),
      ],
    });
  }
}

async function seedAuditLogs(users: Awaited<ReturnType<typeof seedUsers>>) {
  console.log("Seeding audit logs...");

  await prisma.auditLog.deleteMany({
    where: {
      target: {
        in: ["SeedDemo", "File", "BorrowSlip", "User"],
      },
    },
  });

  await prisma.auditLog.createMany({
    data: [
      {
        action: AuditAction.LOGIN,
        target: "User",
        targetId: users.superadmin.id,
        detail: { username: "superadmin", result: "success" },
        ipAddress: "127.0.0.1",
        macAddress: "00:1A:2B:3C:4D:5E",
        userId: users.superadmin.id,
        createdAt: daysFromNow(-2),
      },
      {
        action: AuditAction.UPLOAD,
        target: "File",
        detail: { fileCodes: ["DS-2026-004", "LD-2026-011"], source: "seed" },
        ipAddress: "127.0.0.1",
        macAddress: "FC:AA:14:98:21:44",
        userId: users.admin.id,
        createdAt: daysFromNow(-1),
      },
      {
        action: AuditAction.CREATE,
        target: "BorrowSlip",
        detail: { code: "PM-2026-002" },
        ipAddress: "127.0.0.1",
        macAddress: "12:34:56:78:9A:BC",
        userId: users.coordinator.id,
        createdAt: daysFromNow(-1),
      },
      {
        action: AuditAction.VIEW,
        target: "SeedDemo",
        detail: {
          note: "Dữ liệu mẫu phục vụ test phân quyền, hồ sơ, mượn trả, audit.",
        },
        ipAddress: "127.0.0.1",
        macAddress: "AA:BB:CC:DD:EE:FF",
        userId: users.viewer.id,
        createdAt: now,
      },
    ],
  });
}

async function seedUserAccessLogs(users: Awaited<ReturnType<typeof seedUsers>>) {
  console.log("Seeding user access logs (including Mac data)...");

  await prisma.userAccessLog.deleteMany({});

  const logs = [
    {
      event: UserAccessEvent.LOGIN,
      occurredAt: daysFromNow(-2),
      ipAddress: "192.168.1.45",
      macAddress: "00:1B:44:11:3A:B7",
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      deviceType: "Desktop",
      osName: "Mac OS",
      osVersion: "10.15.7",
      browserName: "Chrome",
      browserVersion: "120.0.0",
      userId: users.superadmin.id,
    },
    {
      event: UserAccessEvent.LOGIN,
      occurredAt: daysFromNow(-1),
      ipAddress: "192.168.1.102",
      macAddress: "FC:AA:14:98:21:44",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      deviceType: "Desktop",
      osName: "Windows",
      osVersion: "10",
      browserName: "Chrome",
      browserVersion: "121.0.0",
      userId: users.admin.id,
    },
    {
      event: UserAccessEvent.LOGOUT,
      occurredAt: daysFromNow(-1),
      ipAddress: "192.168.1.102",
      macAddress: "FC:AA:14:98:21:44",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      deviceType: "Desktop",
      osName: "Windows",
      osVersion: "10",
      browserName: "Chrome",
      browserVersion: "121.0.0",
      userId: users.admin.id,
    },
    {
      event: UserAccessEvent.LOGIN,
      occurredAt: now,
      ipAddress: "172.16.0.5",
      macAddress: "12:34:56:78:9A:BC",
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15",
      deviceType: "Desktop",
      osName: "Mac OS",
      osVersion: "14.3.1",
      browserName: "Safari",
      browserVersion: "17.3",
      userId: users.coordinator.id,
    }
  ];

  await prisma.userAccessLog.createMany({
    data: logs
  });
}

async function main() {
  console.log("Start seeding...");

  const agencies = await seedAgencies();
  const users = await seedUsers();
  const boxes = await seedStorage(agencies);
  const files = await seedFiles(boxes);
  await seedBorrowSlips(users, files);
  await seedAuditLogs(users);
  await seedUserAccessLogs(users);

  console.log("Seeding finished.");
  console.log("Login accounts:");
  console.log("  superadmin / admin@123");
  console.log("  admin      / 123456");
  console.log("  coordinator / 123456");
  console.log("  viewer     / 123456");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
