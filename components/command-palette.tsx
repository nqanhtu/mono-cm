'use client'

import * as React from 'react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'
import { useRouter } from '@/src/lib/router'
import { apiFetch } from '@/lib/api/client'
import { useDebounce } from 'use-debounce'
import {
  FileText,
  LayoutDashboard,
  Plus,
  Upload,
  BarChart3,
  Database,
  History
} from 'lucide-react'
import { toast } from 'sonner'

interface FileSearchResult {
  id: string
  code: string
  title: string
  type: string
  year?: number | null
}

export function CommandPalette() {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [debouncedQuery] = useDebounce(query, 250)
  const [files, setFiles] = React.useState<FileSearchResult[]>([])
  const [isSearching, setIsSearching] = React.useState(false)
  const router = useRouter()

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  React.useEffect(() => {
    if (!debouncedQuery.trim()) {
      setFiles([])
      return
    }

    const searchFiles = async () => {
      setIsSearching(true)
      try {
        const res = await apiFetch(`/api/files?q=${encodeURIComponent(debouncedQuery)}&limit=5`)
        if (res.ok) {
          const data = await res.json()
          setFiles(data.files || [])
        }
      } catch (error) {
        console.error('Lỗi tìm kiếm hồ sơ:', error)
      } finally {
        setIsSearching(false)
      }
    }

    searchFiles()
  }, [debouncedQuery])

  const handleRunBackup = async () => {
    setOpen(false)
    const toastId = toast.loading('Đang chạy sao lưu dữ liệu...')
    try {
      const res = await apiFetch('/api/admin/backup/run', { method: 'POST' })
      if (res.ok) {
        toast.success('Sao lưu dữ liệu thành công', { id: toastId })
      } else {
        toast.error('Sao lưu thất bại', { id: toastId })
      }
    } catch {
      toast.error('Có lỗi xảy ra khi sao lưu', { id: toastId })
    }
  }

  const navigateTo = (path: string) => {
    router.push(path)
    setOpen(false)
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput 
        placeholder="Tìm kiếm hồ sơ, lệnh điều hướng... (Ctrl + K)" 
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {isSearching ? 'Đang tìm kiếm...' : 'Không tìm thấy kết quả phù hợp.'}
        </CommandEmpty>
        
        {files.length > 0 && (
          <CommandGroup heading="Hồ sơ khớp kết quả">
            {files.map((file) => (
              <CommandItem
                key={file.id}
                value={file.code + ' ' + file.title}
                onSelect={() => navigateTo(`/files/${file.id}`)}
              >
                <FileText className="mr-2 h-4 w-4" />
                <div className="flex flex-col">
                  <span className="font-medium">{file.code} - {file.title}</span>
                  <span className="text-xs text-muted-foreground">{file.type} {file.year ? `• Năm ${file.year}` : ''}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandGroup heading="Điều hướng nhanh">
          <CommandItem value="ho so tra cuu home dashboard" onSelect={() => navigateTo('/')}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            <span>Tra cứu hồ sơ</span>
            <CommandShortcut>🏠</CommandShortcut>
          </CommandItem>
          <CommandItem value="muon tra phieu muon borrow" onSelect={() => navigateTo('/borrow')}>
            <FileText className="mr-2 h-4 w-4" />
            <span>Mượn trả hồ sơ</span>
            <CommandShortcut>📄</CommandShortcut>
          </CommandItem>
          <CommandItem value="nhap lieu upload excel" onSelect={() => navigateTo('/upload')}>
            <Upload className="mr-2 h-4 w-4" />
            <span>Nhập liệu hàng loạt</span>
          </CommandItem>
          <CommandItem value="thong ke bao cao reports" onSelect={() => navigateTo('/reports')}>
            <BarChart3 className="mr-2 h-4 w-4" />
            <span>Thống kê & báo cáo</span>
          </CommandItem>
          <CommandItem value="nhat ky hoat dong audit logs" onSelect={() => navigateTo('/admin/audit')}>
            <History className="mr-2 h-4 w-4" />
            <span>Nhật ký hoạt động</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Hành động nhanh">
          <CommandItem value="tao ho so moi create manual" onSelect={() => navigateTo('/?create=true')}>
            <Plus className="mr-2 h-4 w-4" />
            <span>Tạo mới hồ sơ thủ công</span>
            <CommandShortcut>⌘N</CommandShortcut>
          </CommandItem>
          <CommandItem value="sao luu du lieu backup system" onSelect={handleRunBackup}>
            <Database className="mr-2 h-4 w-4" />
            <span>Sao lưu dữ liệu hệ thống</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
