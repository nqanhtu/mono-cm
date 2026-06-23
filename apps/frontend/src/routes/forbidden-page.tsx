'use client';

import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ForbiddenPage() {
  useEffect(() => {
    document.title = "Không có quyền truy cập | Court Management";
  }, []);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-semibold">Bạn không có quyền truy cập</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tài khoản hiện tại chưa được cấp quyền sử dụng chức năng này. Vui lòng liên hệ quản trị viên nếu cần hỗ trợ.
        </p>
        <Button asChild className="mt-6">
          <Link to="/">Về trang tra cứu</Link>
        </Button>
      </div>
    </div>
  )
}
