"use client";

import { useEffect, useMemo } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AutocompleteInput } from "@/components/ui/autocomplete-input";
import { useAutocompleteSuggestions } from "@/lib/hooks/use-autocomplete-suggestions";
import { toast } from "sonner";
import type { StorageBoxDto } from "@/lib/api/types";
import {
  useAgencies,
  useCreateStorageBox,
  useUpdateStorageBox,
  type StorageBoxPayload,
} from "@/lib/hooks/use-storage-boxes";

const formSchema = z.object({
  warehouse: z.string().min(1, "Kho không được để trống"),
  line: z.string().min(1, "Dãy không được để trống"),
  shelf: z.string().min(1, "Kệ không được để trống"),
  slot: z.string().min(1, "Ngăn không được để trống"),
  boxNumber: z.string().min(1, "Số hộp không được để trống"),
  code: z.string().min(1, "Mã hộp không được để trống"),
  agencyId: z.string().nullable().optional(),
  caseType: z.string().nullable().optional(),
  year: z.coerce.number().int().min(1900, "Năm không hợp lệ").max(2100, "Năm không hợp lệ").nullable().optional(),
  fromFileCode: z.string().nullable().optional(),
  toFileCode: z.string().nullable().optional(),
  retention: z.string().nullable().optional(),
  autoGenerateCode: z.boolean().default(true),
});

type FormValues = z.infer<typeof formSchema>;

interface StorageBoxDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  box?: StorageBoxDto | null; // If editing
}

export function StorageBoxDialog({
  isOpen,
  onClose,
  onSuccess,
  box,
}: StorageBoxDialogProps) {
  const { agencies } = useAgencies(isOpen);
  const { suggestions } = useAutocompleteSuggestions();
  const createStorageBox = useCreateStorageBox();
  const updateStorageBox = useUpdateStorageBox();
  const isSaving = createStorageBox.isPending || updateStorageBox.isPending;

  const mergedCaseTypes = useMemo(() => {
    const defaultTypes = [
      "Hình sự sơ thẩm",
      "Dân sự sơ thẩm",
      "Hình sự phúc thẩm",
      "Dân sự phúc thẩm",
      "Hôn nhân phúc thẩm",
      "Hành chính",
      "Kinh doanh thương mại",
      "Lao động",
      "Gia đình và người chưa thành niên",
    ];
    const dbTypes = suggestions?.types || [];
    const set = new Set([...defaultTypes, ...dbTypes]);
    return Array.from(set);
  }, [suggestions?.types]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as Resolver<FormValues>,
    defaultValues: {
      warehouse: "",
      line: "",
      shelf: "",
      slot: "",
      boxNumber: "",
      code: "",
      agencyId: null,
      caseType: null,
      year: new Date().getFullYear(),
      fromFileCode: "",
      toFileCode: "",
      retention: "10 năm",
      autoGenerateCode: true,
    },
  });

  // Set default values when box changes or dialog opens
  useEffect(() => {
    if (box) {
      form.reset({
        warehouse: box.warehouse || "",
        line: box.line || "",
        shelf: box.shelf || "",
        slot: box.slot || "",
        boxNumber: box.boxNumber || "",
        code: box.code || "",
        agencyId: box.agencyId || null,
        caseType: box.caseType || null,
        year: box.year || new Date().getFullYear(),
        fromFileCode: box.fromFileCode || "",
        toFileCode: box.toFileCode || "",
        retention: box.retention || "10 năm",
        autoGenerateCode: false, // Default to false when editing existing so we don't accidentally overwrite
      });
    } else {
      form.reset({
        warehouse: "",
        line: "",
        shelf: "",
        slot: "",
        boxNumber: "",
        code: "",
        agencyId: null,
        caseType: null,
        year: new Date().getFullYear(),
        fromFileCode: "",
        toFileCode: "",
        retention: "10 năm",
        autoGenerateCode: true,
      });
    }
  }, [box, form, isOpen]);

  // Watch fields for automatic code generation
  const warehouse = form.watch("warehouse");
  const line = form.watch("line");
  const shelf = form.watch("shelf");
  const slot = form.watch("slot");
  const boxNumber = form.watch("boxNumber");
  const autoGenerateCode = form.watch("autoGenerateCode");

  useEffect(() => {
    if (autoGenerateCode) {
      const parts = [warehouse, line, shelf, slot, boxNumber]
        .map((p) => (p || "").trim())
        .filter(Boolean);

      const generated = parts.join("-").toUpperCase();
      form.setValue("code", generated);
    }
  }, [warehouse, line, shelf, slot, boxNumber, autoGenerateCode, form]);

  async function onSubmit(values: FormValues) {
    try {
      const payload: StorageBoxPayload = {
        ...values,
        agencyId: values.agencyId === "none" ? null : values.agencyId,
        caseType: values.caseType === "none" ? null : values.caseType,
      };

      if (box) {
        await updateStorageBox.mutateAsync({ id: box.id, payload });
      } else {
        await createStorageBox.mutateAsync(payload);
      }

      toast.success(box ? "Cập nhật hộp lưu trữ thành công" : "Thêm mới hộp lưu trữ thành công");
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Lưu thất bại. Vui lòng kiểm tra lại");
    }
  }

  const retentionPeriods = [
    "5 năm",
    "10 năm",
    "15 năm",
    "20 năm",
    "30 năm",
    "50 năm",
    "Vĩnh viễn",
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {box ? "Chỉnh sửa Hộp lưu trữ" : "Thêm Hộp lưu trữ mới"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* Physical Coordinates Grid */}
            <div className="bg-muted/40 p-4 rounded-xl space-y-4 border">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Tọa độ vị trí vật lý
              </h4>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
                <FormField
                  control={form.control}
                  name="warehouse"
                  render={({ field }) => (
                    <FormItem className="col-span-2 sm:col-span-1">
                      <FormLabel className="text-xs">Kho</FormLabel>
                      <FormControl>
                        <Input placeholder="K1" className="h-9" {...field} />
                      </FormControl>
                      <FormMessage className="text-[10px]" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="line"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Dãy</FormLabel>
                      <FormControl>
                        <Input placeholder="D1" className="h-9" {...field} />
                      </FormControl>
                      <FormMessage className="text-[10px]" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="shelf"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Kệ</FormLabel>
                      <FormControl>
                        <Input placeholder="KE1" className="h-9" {...field} />
                      </FormControl>
                      <FormMessage className="text-[10px]" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="slot"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Ngăn</FormLabel>
                      <FormControl>
                        <Input placeholder="N1" className="h-9" {...field} />
                      </FormControl>
                      <FormMessage className="text-[10px]" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="boxNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Số hộp</FormLabel>
                      <FormControl>
                        <Input placeholder="H01" className="h-9" {...field} />
                      </FormControl>
                      <FormMessage className="text-[10px]" />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Auto generation Toggle & Code */}
            <div className="grid grid-cols-1 gap-4">
              <FormField
                control={form.control}
                name="autoGenerateCode"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 bg-muted/20">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="text-sm font-medium cursor-pointer">
                        Tự động sinh mã hộp lưu trữ
                      </FormLabel>
                      <FormDescription className="text-xs text-muted-foreground">
                        Tạo mã code dựa trên vị trí vật lý: [Kho]-[Dãy]-[Kệ]-[Ngăn]-[Số hộp].
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mã QR/Mã hộp lưu trữ</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="K1-D1-KE1-N1-H01"
                        className="font-mono tracking-wide font-semibold uppercase bg-background"
                        disabled={autoGenerateCode}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      {autoGenerateCode 
                        ? "Mã này được sinh tự động theo tọa độ vị trí vật lý ở trên." 
                        : "Vui lòng nhập mã tùy chọn (ví dụ: mã QR cũ hoặc mã dán sẵn)."}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Label Metadata Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-4">
              {/* Agency Selection */}
              <FormField
                control={form.control}
                name="agencyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phông lưu trữ</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || "none"}
                    >
                      <FormControl>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Chọn phông lưu trữ" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Không chọn (Trống)</SelectItem>
                        {agencies.map((agency) => (
                          <SelectItem key={agency.id} value={agency.id}>
                            {agency.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Case Type Selection */}
              <FormField
                control={form.control}
                name="caseType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Loại hồ sơ</FormLabel>
                    <FormControl>
                      <AutocompleteInput
                        placeholder="Chọn hoặc nhập loại hồ sơ..."
                        value={field.value || ""}
                        suggestions={mergedCaseTypes}
                        onValueChange={(val) => field.onChange(val ? val.trim() : null)}
                        className="h-9 text-xs rounded-md"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Year */}
              <FormField
                control={form.control}
                name="year"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Năm (Niên hạn)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Năm lưu trữ"
                        className="h-9"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Retention Periods Selection */}
              <FormField
                control={form.control}
                name="retention"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Thời hạn bảo quản</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || "10 năm"}
                    >
                      <FormControl>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Chọn thời hạn bảo quản" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {retentionPeriods.map((period) => (
                          <SelectItem key={period} value={period}>
                            {period}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* From - To Case File Codes */}
            <div className="grid grid-cols-1 gap-4 border-t pt-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="fromFileCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Từ số hồ sơ</FormLabel>
                    <FormControl>
                      <Input placeholder="01" className="h-9" {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="toFileCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Đến số hồ sơ</FormLabel>
                    <FormControl>
                      <Input placeholder="50" className="h-9" {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Footer buttons */}
            <DialogFooter className="border-t pt-4 flex items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose} className="h-9">
                Hủy
              </Button>
              <Button type="submit" disabled={isSaving} className="h-9">
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {box ? "Lưu thay đổi" : "Tạo hộp"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
