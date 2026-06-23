import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, Clock } from 'lucide-react';
import { Marked } from 'marked';
import { getChangelogFiles, getChangelogContent } from '@/lib/changelog';
import { ThemeToggle } from '@/components/changelog/theme-toggle';
import { ChangelogSelector } from '@/components/changelog/changelog-selector';
import { useSearchParams } from '@/src/lib/router';

// Thiết lập Marked custom renderer để tự sinh id slug cho các tiêu đề h2, h3 để làm TOC
const marked = new Marked();
const renderer = {
  heading(args: any) {
    let text = '';
    let level = 2;
    if (typeof args === 'object' && args !== null) {
      text = args.text || '';
      level = args.depth || 2;
    } else {
      text = arguments[0] || '';
      level = arguments[1] || 2;
    }
    const slug = text.toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\u00c0-\u1ef9-]/g, '');
    return `<h${level} id="${slug}">${text}</h${level}>`;
  }
};
marked.use({ renderer });

export default function ChangelogPage() {
  const searchParams = useSearchParams();
  const selectedFile = searchParams.get('file') || undefined;
  const files = getChangelogFiles();

  if (files.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-6">
        <h1 className="text-2xl font-bold mb-2">Chưa có nhật ký thay đổi</h1>
        <p className="text-muted-foreground mb-4">Hãy thêm các file .md vào thư mục docs của dự án.</p>
        <Link to="/" className="text-primary hover:underline flex items-center">
          <ArrowLeft className="w-4 h-4 mr-2" /> Quay lại trang chính
        </Link>
      </div>
    );
  }

  const activeFile = selectedFile || files[0].filename;
  const rawContent = getChangelogContent(activeFile) || '';
  const htmlContent = marked.parse(rawContent) as string;

  // Trích xuất tiêu đề h2 để tạo danh sách Mục lục TOC bên phải
  const toc: { id: string; text: string }[] = [];
  const headingRegex = /^##\s+([^\r\n]+)$/gm;
  let match;
  while ((match = headingRegex.exec(rawContent)) !== null) {
    const text = match[1].trim();
    const id = text.toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\u00c0-\u1ef9-]/g, '');
    toc.push({ id, text });
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Header Bar */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/85 backdrop-blur-md">
        <div className="flex h-16 items-center justify-between px-4 md:px-8 max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              <span className="hidden sm:inline">Quay lại hệ thống</span>
            </Link>
            <span className="h-4 w-px bg-border hidden sm:block"></span>
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              <h1 className="font-bold text-lg tracking-tight">Changelog Hệ thống</h1>
            </div>
          </div>
          <div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex max-w-7xl mx-auto w-full min-h-0">
        
        {/* Cột Trái: Danh sách files */}
        <aside className="w-72 border-r p-6 overflow-y-auto hidden md:block shrink-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mb-4">
            <Clock className="w-4 h-4" />
            <span>Lịch sử nâng cấp</span>
          </div>
          <nav className="space-y-1">
            {files.map((f) => {
              const isActive = f.filename === activeFile;
              return (
                <Link
                  key={f.filename}
                  to={`/changelog?file=${f.filename}`}
                  className={`block p-3 rounded-lg border text-sm transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-primary/5 border-primary/30 text-primary font-medium shadow-sm'
                      : 'border-transparent hover:bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <div className="font-semibold line-clamp-2 leading-snug">{f.title}</div>
                  {f.date && (
                    <div className="text-xs mt-1.5 opacity-70 flex items-center">
                      {f.date}
                    </div>
                  )}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Cột Giữa: Nội dung chính */}
        <main className="flex-1 overflow-y-auto p-6 md:p-10 lg:px-12">
          {/* Dropdown thay thế cho Sidebar trên Mobile */}
          <div className="md:hidden mb-6">
            <label htmlFor="changelog-select" className="block text-xs font-semibold text-muted-foreground mb-2">
              Chọn phiên bản nâng cấp:
            </label>
            <ChangelogSelector files={files} activeFile={activeFile} />
          </div>

          <article className="markdown-body max-w-3xl mx-auto">
            <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
          </article>
        </main>

        {/* Cột Phải: Mục lục TOC */}
        {toc.length > 0 && (
          <aside className="w-64 p-8 overflow-y-auto hidden lg:block shrink-0 sticky top-16 h-[calc(100vh-4rem)]">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Nội dung chính
            </h3>
            <nav className="space-y-2.5 text-sm">
              {toc.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="block text-muted-foreground hover:text-foreground hover:underline transition-colors leading-relaxed line-clamp-2 cursor-pointer"
                >
                  {item.text}
                </a>
              ))}
            </nav>
          </aside>
        )}

      </div>
    </div>
  );
}
