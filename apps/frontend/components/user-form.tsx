'use client';

import { apiFetch } from '@/lib/api/client';

import { useState, useEffect } from 'react'
import { User, Building2, Lock, KeyRound, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from 'sonner'
import type { UserDto } from '@/lib/api/types'

interface UserFormProps {
  userId?: string
  initialData?: UserDto
  onSuccess?: () => void
  onCancel?: () => void
}

type FormData = {
  username: string
  password: string
  fullName: string
  unit: string
  role: string
  status: boolean
}

const defaultFormData: FormData = {
  username: '',
  password: '',
  fullName: '',
  unit: '',
  role: 'VIEWER',
  status: true
}

export default function UserForm({ userId, initialData, onSuccess, onCancel }: UserFormProps) {
  const [formData, setFormData] = useState<FormData>(defaultFormData)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isEditMode = !!userId

  // Populate form when editing
  useEffect(() => {
    if (initialData) {
      setFormData({
        username: initialData.username || '',
        password: '', // Don't prefill password for edit
        fullName: initialData.fullName || '',
        unit: initialData.unit || '',
        role: initialData.role || 'VIEWER',
        status: initialData.status ?? true
      })
    } else {
      setFormData(defaultFormData)
    }
  }, [initialData])

  const handleChange = (field: keyof FormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.fullName.trim()) {
      toast.error('Vui lòng nhập họ và tên')
      return
    }

    if (!formData.username.trim()) {
      toast.error('Vui lòng nhập tên đăng nhập')
      return
    }

    if (!isEditMode && !formData.password.trim()) {
      toast.error('Vui lòng nhập mật khẩu')
      return
    }

    setIsSubmitting(true)

    try {
      const url = isEditMode ? `/api/users/${userId}` : '/api/users'
      const method = isEditMode ? 'PUT' : 'POST'

      // Don't send empty password in edit mode
      const payload = isEditMode && !formData.password.trim()
        ? { ...formData, password: undefined }
        : formData

      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        toast.success(isEditMode ? 'Cập nhật thành công' : 'Thêm người dùng thành công')
        onSuccess?.()
      } else {
        const data = await res.json()
        toast.error(data.error || data.message || 'Có lỗi xảy ra')
      }
    } catch {
      toast.error('Lỗi kết nối')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-8">
      {/* Avatar / Identity Section */}
      <div className="w-64 flex flex-col gap-4 shrink-0">
        <div className="aspect-square rounded-2xl bg-slate-100 border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 hover:bg-slate-50 transition-colors cursor-pointer group relative overflow-hidden">
          <User className="w-16 h-16 group-hover:scale-110 transition-transform" />
          <span className="text-xs font-medium mt-2">Tải ảnh đại diện</span>
          <Input type="file" className="absolute inset-0 opacity-0 cursor-pointer p-0 h-full" />
        </div>
        <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
          <h4 className="text-sm font-bold text-indigo-900 mb-1">Mẹo</h4>
          <p className="text-xs text-indigo-700 leading-relaxed">
            Tên đăng nhập nên ngắn gọn và dễ nhớ. Mật khẩu phải có ít nhất 6 ký tự.
          </p>
        </div>
      </div>

      {/* Main Fields */}
      <div className="flex-1 space-y-5">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-slate-700">
              Họ và tên <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10" />
              <Input
                type="text"
                value={formData.fullName}
                onChange={(e) => handleChange('fullName', e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border-slate-200 rounded-lg text-sm focus-visible:ring-indigo-500 outline-none transition-colors"
                placeholder="Nhập họ và tên..."
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-slate-700">Đơn vị công tác</Label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10" />
              <Input
                type="text"
                value={formData.unit}
                onChange={(e) => handleChange('unit', e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border-slate-200 rounded-lg text-sm focus-visible:ring-indigo-500 outline-none transition-colors"
                placeholder="Phòng ban..."
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-slate-700">
              Tên đăng nhập <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10" />
              <Input
                type="text"
                value={formData.username}
                onChange={(e) => handleChange('username', e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border-slate-200 rounded-lg text-sm focus-visible:ring-indigo-500 outline-none transition-colors"
                placeholder="username"
                disabled={isEditMode}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-slate-700">
              Mật khẩu {!isEditMode && <span className="text-red-500">*</span>}
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10" />
              <Input
                type="password"
                value={formData.password}
                onChange={(e) => handleChange('password', e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border-slate-200 rounded-lg text-sm focus-visible:ring-indigo-500 outline-none transition-colors"
                placeholder={isEditMode ? "Để trống nếu không đổi" : "Nhập mật khẩu..."}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-slate-700">Vai trò</Label>
            <Select value={formData.role} onValueChange={(value) => handleChange('role', value)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Chọn vai trò" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SUPER_ADMIN">Quản trị toàn hệ thống</SelectItem>
                <SelectItem value="ADMIN">Quản trị</SelectItem>
                <SelectItem value="COORDINATOR">Điều phối</SelectItem>
                <SelectItem value="VIEWER">Chỉ xem</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-slate-700">Trạng thái</Label>
            <Select
              value={formData.status ? 'active' : 'inactive'}
              onValueChange={(value) => handleChange('status', value === 'active')}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Chọn trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Đang hoạt động</SelectItem>
                <SelectItem value="inactive">Đã khóa</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-100 gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="px-5 py-2 bg-white border-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors h-auto"
          >
            Hủy
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition-colors h-auto"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isEditMode ? 'Cập nhật' : 'Lưu thông tin'}
          </Button>
        </div>
      </div>
    </form>
  )
}
