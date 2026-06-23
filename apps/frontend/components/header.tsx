"use client";

import { UserCircle, LogOut, Search } from "lucide-react";
import { usePathname, useRouter } from '@/src/lib/router';
import type { User } from "@/lib/types/user";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "./ui/sidebar";
import { useSession } from "@/lib/hooks/use-auth";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface HeaderProps {
  user?: User;
}

export default function Header({ user }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useSession();

  if (pathname === "/login") return null;

  const pageTitles: Record<string, { title: string; description: string }> = {
    "/": { title: "Hồ sơ", description: "Tra cứu, lọc và xử lý hồ sơ lưu trữ" },
    "/borrow": { title: "Mượn trả", description: "Theo dõi phiếu mượn và hoàn trả hồ sơ" },
    "/upload": { title: "Nhập liệu", description: "Tạo mới hoặc nhập hồ sơ từ Excel" },
    "/users": { title: "Người dùng", description: "Quản lý tài khoản và phân quyền" },
    "/admin/agency": { title: "Phông lưu trữ", description: "Quản lý đơn vị và phông lưu trữ" },
    "/admin/boxes": { title: "Hộp lưu trữ", description: "Quản lý vị trí và hộp hồ sơ" },
    "/admin/backup": { title: "Sao lưu dữ liệu", description: "Thiết lập và kiểm tra sao lưu" },
    "/admin/audit": { title: "Nhật ký", description: "Theo dõi hoạt động hệ thống" },
    "/reports": { title: "Thống kê", description: "Báo cáo tình trạng hồ sơ" },
    "/reset": { title: "Reset dữ liệu", description: "Công cụ bảo trì hệ thống" },
  }
  const currentPage = pageTitles[pathname] ?? (
    pathname.startsWith("/files/")
      ? { title: "Chi tiết hồ sơ", description: "Xem và cập nhật thông tin hồ sơ" }
      : { title: "Quản lý hồ sơ", description: "Hệ thống lưu trữ nội bộ" }
  )

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/75 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-3 px-4 lg:px-5">
        <SidebarTrigger className="-ml-1" />

        <div className="hidden min-w-0 flex-col lg:flex">
          <h1 className="truncate text-sm font-semibold leading-5 text-foreground">{currentPage.title}</h1>
          <p className="truncate text-xs text-muted-foreground">{currentPage.description}</p>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('toggle-command-palette'))}
              className="ml-0 hidden w-72 items-center gap-2 rounded-lg border bg-muted/35 px-2.5 py-1.5 text-left text-xs font-normal text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground md:flex lg:ml-6"
            >
              <Search className="h-3.5 w-3.5 shrink-0" />
              <span>Tìm kiếm...</span>
              <kbd className="ml-auto pointer-events-none inline-flex h-4.5 select-none items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[9px] font-medium opacity-100">
                <span className="text-[10px]">Ctrl</span> K
              </kbd>
            </button>
          </TooltipTrigger>
          <TooltipContent>
            Tìm kiếm nhanh (Ctrl + K)
          </TooltipContent>
        </Tooltip>


        <div className="ml-auto flex items-center gap-1 lg:gap-2">
          <div className="mx-2 h-8 w-px bg-border"></div>
          {user ? (
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-foreground">
                  {user.fullName}
                </p>
                <p className="text-xs text-muted-foreground">{user.role}</p>
              </div>
              <UserCircle className="w-9 h-9 text-muted-foreground/50" />
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="ml-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors h-10 w-10"
                title="Đăng xuất"
              >
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <UserCircle className="w-9 h-9 text-muted-foreground/50" />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
