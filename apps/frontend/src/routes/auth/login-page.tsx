'use client';

import { apiFetch } from '@/lib/api/client';

import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useRouter } from '@/src/lib/router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, User, KeyRound, Scale } from 'lucide-react';
import { toast } from 'sonner';
import { useSession } from '@/lib/hooks/use-auth';

export default function LoginPage() {
    const router = useRouter();
    const location = useLocation();
    const { mutate } = useSession();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError('');

        const formData = new FormData(e.currentTarget);
        const username = formData.get('username')?.toString().trim();
        const password = formData.get('password')?.toString();

        if (!username) {
            setError('Vui lòng nhập tên đăng nhập');
            toast.error('Vui lòng nhập tên đăng nhập');
            window.document.getElementById('username')?.focus();
            return;
        }

        if (!password) {
            setError('Vui lòng nhập mật khẩu');
            toast.error('Vui lòng nhập mật khẩu');
            window.document.getElementById('password')?.focus();
            return;
        }

        setIsLoading(true);

        try {
            const res = await apiFetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            
            const data = await res.json();

            if (res.ok && data.success) {
                toast.success('Đăng nhập thành công');
                await mutate();
                const redirectTo = typeof location.state?.from === 'string' ? location.state.from : '/';
                router.push(redirectTo);
            } else {
                setError(data.message || 'Đăng nhập thất bại');
                toast.error(data.message || 'Đăng nhập thất bại');
            }
        } catch {
            setError('Lỗi kết nối');
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div className="flex min-h-dvh items-center justify-center bg-[linear-gradient(180deg,oklch(0.99_0.003_255),oklch(0.965_0.006_255))] p-6">
            <Card className="z-10 w-full max-w-md rounded-xl border-slate-200 bg-white/95 shadow-xl shadow-slate-200/60">
                <CardHeader className="space-y-1 pb-7 pt-8 text-center">
                    <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/20">
                        <Scale className="size-7" />
                    </div>
                    <CardTitle className="text-2xl font-semibold text-slate-900">Đăng nhập hệ thống</CardTitle>
                    <CardDescription className="text-slate-500">
                        Quản lý hồ sơ lưu trữ nội bộ
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={onSubmit} noValidate className="space-y-5">
                        {error && (
                            <Alert variant="destructive" className="bg-red-50 text-red-700 border-red-200">
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="username">Tên đăng nhập</Label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <Input
                                    id="username"
                                    name="username"
                                    placeholder="admin"
                                    required
                                    disabled={isLoading}
                                    className="h-10 rounded-lg border-slate-200 pl-10 transition-colors hover:border-slate-300 focus-visible:border-primary focus-visible:ring-primary/20"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Mật khẩu</Label>
                            <div className="relative">
                                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <Input
                                    id="password"
                                    name="password"
                                    type="password"
                                    placeholder="••••••••"
                                    required
                                    disabled={isLoading}
                                    className="h-10 rounded-lg border-slate-200 pl-10 transition-colors hover:border-slate-300 focus-visible:border-primary focus-visible:ring-primary/20"
                                />
                            </div>
                        </div>
                        <div className="pt-1">
                            <Button type="submit" disabled={isLoading} className="h-10 w-full rounded-lg">
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                <span>Đăng nhập</span>
                            </Button>
                        </div>
                    </form>
                </CardContent>
                <CardFooter className="flex justify-center pb-8 pt-2">
                    <p className="text-xs text-slate-400 text-center">
                        Hệ thống lưu trữ và quản lý hồ sơ nội bộ <br />
                    </p>
                </CardFooter>
            </Card>
        </div>
    );
}
