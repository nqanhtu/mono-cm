import { Boxes, Tags } from "lucide-react";

import { CaseTypeCleanup } from "@/components/admin/case-type-cleanup";
import { MismatchedBoxes } from "@/components/admin/mismatched-boxes";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRouter, useSearchParams } from "@/src/lib/router";

const TRIGGER_CLASS =
  "gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs font-semibold px-3 py-1.5 rounded-md";

export default function DataCleanupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab") === "boxes" ? "boxes" : "case-types";

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value === "boxes") params.set("tab", "boxes");
    else params.delete("tab");
    const query = params.toString();
    router.replace(query ? `?${query}` : "?");
  };

  return (
    <div className="flex flex-col">
      <main className="p-6">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6">
            <h1 className="text-3xl font-bold tracking-tight">Chuẩn hoá dữ liệu</h1>
            <p className="mt-2 text-muted-foreground">
              Gộp các cách viết khác nhau của cùng một Loại án, điền Loại án còn trống, và rà soát Hộp có Hồ sơ lệch loại.
            </p>
          </div>
          <Tabs value={currentTab} onValueChange={handleTabChange} className="space-y-4">
            <TabsList className="w-max rounded-lg bg-muted/30 p-1">
              <TabsTrigger value="case-types" className={TRIGGER_CLASS}>
                <Tags className="h-3.5 w-3.5" aria-hidden="true" />
                Loại án
              </TabsTrigger>
              <TabsTrigger value="boxes" className={TRIGGER_CLASS}>
                <Boxes className="h-3.5 w-3.5" aria-hidden="true" />
                Hộp lẫn loại án
              </TabsTrigger>
            </TabsList>
            <TabsContent value="case-types" className="outline-none">
              <CaseTypeCleanup />
            </TabsContent>
            <TabsContent value="boxes" className="outline-none">
              <MismatchedBoxes onGoToCaseTypes={() => handleTabChange("case-types")} />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
