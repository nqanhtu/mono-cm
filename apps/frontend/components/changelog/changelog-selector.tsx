'use client';

import { useRouter } from '@/src/lib/router';

interface ChangelogSelectorProps {
  files: {
    filename: string;
    title: string;
    date: string;
  }[];
  activeFile: string;
}

export function ChangelogSelector({ files, activeFile }: ChangelogSelectorProps) {
  const router = useRouter();

  return (
    <select
      id="changelog-select"
      value={activeFile}
      onChange={(e) => {
        router.push(`/changelog?file=${e.target.value}`);
      }}
      className="w-full p-2.5 rounded-lg border bg-card text-sm font-medium cursor-pointer"
    >
      {files.map((f) => (
        <option key={f.filename} value={f.filename}>
          {f.date ? `[${f.date}] ` : ''}{f.title}
        </option>
      ))}
    </select>
  );
}
