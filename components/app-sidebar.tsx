"use client";

import {
  LayoutDashboard,
  Users,
  FileText,
  BarChart3,
  Upload,
  History as HistoryIcon,
  Building2,
  RotateCcw,
  Archive,
  Database,
  Scale,
} from "lucide-react";
import { usePathname } from '@/src/lib/router';
import type { User } from "@/lib/types/user";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Link } from 'react-router-dom';
import { can } from "@/lib/rbac";

interface AppSidebarProps {
  user?: User;
}

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname();

  if (pathname === "/login") return null;

  const role = user?.role;
  const isItemActive = (href: string) => {
    if (href === '/') return pathname === '/' || pathname.startsWith('/files/')
    if (href === '/borrow') return pathname === '/borrow' || pathname.startsWith('/borrow/')
    return pathname === href
  }

  const menuItems = [
    {
      category: "Quản lý",
      items: [
        { name: "Hồ sơ", href: "/", icon: LayoutDashboard },
        ...(can(role, "viewBorrow")
          ? [{ name: "Mượn trả", href: "/borrow", icon: FileText }]
          : []),
        ...(can(role, "createFiles")
          ? [{ name: "Nhập liệu", href: "/upload", icon: Upload }]
          : []),
        ...(can(role, "manageUsers")
          ? [
              { name: "Người dùng", href: "/users", icon: Users },
              { name: "Phông lưu trữ", href: "/admin/agency", icon: Building2 },
              { name: "Hộp lưu trữ", href: "/admin/boxes", icon: Archive },
              { name: "Sao lưu dữ liệu", href: "/admin/backup", icon: Database },
              { name: "Nhật ký", href: "/admin/audit", icon: HistoryIcon },
            ]
          : []),
        ...(can(role, "manageMaintenance")
          ? [{ name: "Reset dữ liệu", href: "/reset", icon: RotateCcw }]
          : []),
      ],
    },
    {
      category: "Báo cáo",
      items: [{ name: "Thống kê", href: "/reports", icon: BarChart3 }],
    },
  ];

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border/70 px-3 py-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="h-11 data-[slot=sidebar-menu-button]:!p-1.5 hover:bg-transparent"
            >
              <Link to="/">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm shadow-primary/20">
                  <Scale className="size-4" />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-semibold leading-5">
                    Quản lý hồ sơ
                  </span>
                  <span className="truncate text-[11px] font-medium text-sidebar-foreground/55">
                    Lưu trữ nội bộ
                  </span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {menuItems.map((group, idx) => (
          <SidebarGroup key={idx}>
            <SidebarGroupLabel>{group.category}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton
                      asChild
                      isActive={isItemActive(item.href)}
                      tooltip={item.name}
                      className="font-medium data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:shadow-sm data-[active=true]:shadow-primary/20"
                    >
                      <Link to={item.href}>
                        <item.icon />
                        <span>{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
