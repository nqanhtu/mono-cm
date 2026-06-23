'use client';

import { Search, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useRouter, useSearchParams } from '@/src/lib/router';
import { useDebouncedCallback } from 'use-debounce';

export function AuditFilters() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const handleSearch = useDebouncedCallback((term: string) => {
        const params = new URLSearchParams(searchParams);
        if (term) {
            params.set('q', term);
        } else {
            params.delete('q');
        }
        params.set('page', '1');
        router.replace(`?${params.toString()}`);
    }, 300);

    const handleFilterChange = (value: string) => {
        const params = new URLSearchParams(searchParams);
        if (value && value !== 'ALL') {
            params.set('action', value);
        } else {
            params.delete('action');
        }
        params.set('page', '1');
        router.replace(`?${params.toString()}`);
    };

    return (
        <div className='p-4 border-b border-slate-200 flex flex-wrap items-center gap-3 bg-white shrink-0'>
            <div className='flex items-center gap-2'>
                <Filter className='w-5 h-5 text-indigo-600' />
                <h3 className='font-bold text-slate-700'>Bộ lọc</h3>
            </div>
            <div className='h-6 w-px bg-slate-200 mx-2 hidden md:block'></div>

            <div className='flex items-center gap-2'>
                <Select 
                    defaultValue={searchParams.get('action') || 'ALL'} 
                    onValueChange={handleFilterChange}
                >
                    <SelectTrigger className="w-[160px] bg-slate-50 border-slate-200 h-9">
                        <SelectValue placeholder="Hành động" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">Tất cả hành động</SelectItem>
                        <SelectItem value="CREATE">Thêm mới</SelectItem>
                        <SelectItem value="UPDATE">Cập nhật</SelectItem>
                        <SelectItem value="DELETE">Xóa</SelectItem>
                        <SelectItem value="LOGIN">Đăng nhập</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className='flex-1 min-w-50 relative max-w-md ml-auto'>
                <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10' />
                <Input
                    type='text'
                    placeholder='Tìm kiếm người dùng, đối tượng...'
                    defaultValue={searchParams.get('q')?.toString()}
                    onChange={(e) => handleSearch(e.target.value)}
                    className='w-full pl-9 pr-4 py-1.5 bg-slate-50 border-slate-200 rounded-lg text-sm outline-none focus-visible:ring-indigo-500 transition-all h-9'
                />
            </div>
        </div>
    );
}
