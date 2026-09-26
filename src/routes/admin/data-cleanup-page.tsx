import { CaseTypeCleanup } from "@/components/admin/case-type-cleanup";

export default function DataCleanupPage() {
  return (
    <div className="flex flex-col">
      <main className="p-6">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6">
            <h1 className="text-3xl font-bold tracking-tight">Chuẩn hoá dữ liệu</h1>
            <p className="mt-2 text-muted-foreground">
              Gộp các cách viết khác nhau của cùng một Loại án và điền Loại án cho các Hộp, Hồ sơ còn trống.
            </p>
          </div>
          <CaseTypeCleanup />
        </div>
      </main>
    </div>
  );
}
