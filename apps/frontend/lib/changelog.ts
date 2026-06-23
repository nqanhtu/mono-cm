export interface ChangelogFile {
  filename: string;
  title: string;
  date: string;
}

const modules = import.meta.glob('../docs/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

function filenameFromPath(path: string) {
  return path.split('/').pop() || path;
}

function extractTitle(filename: string, content: string) {
  return content
    .split(/\r?\n/)
    .find((line) => line.trim().startsWith('# '))
    ?.trim()
    .substring(2) || filename;
}

export function getChangelogFiles(): ChangelogFile[] {
  return Object.entries(modules)
    .map(([path, content]) => {
      const filename = filenameFromPath(path);
      const dateMatch = filename.match(/(\d{4}-\d{2}-\d{2})/);
      return {
        filename,
        title: extractTitle(filename, content),
        date: dateMatch ? dateMatch[1] : '',
      };
    })
    .sort((a, b) => {
      if (!a.date && !b.date) return a.filename.localeCompare(b.filename);
      if (!a.date) return 1;
      if (!b.date) return -1;
      return b.date.localeCompare(a.date);
    });
}

export function getChangelogContent(filename: string): string | null {
  const safeFilename = filename.split('/').pop();
  if (!safeFilename) return null;
  const entry = Object.entries(modules).find(([path]) => filenameFromPath(path) === safeFilename);
  return entry?.[1] || null;
}
