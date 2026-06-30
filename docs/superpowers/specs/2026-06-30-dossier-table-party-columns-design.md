# Design Spec: Beautiful Plaintiff & Defendant Columns in Case Files Table

**Author**: Antigravity
**Date**: 2026-06-30
**Status**: Approved (Conceptual)

## 1. Goal & Context

When viewing the Case Files table, columns for **Bị cáo / Bị đơn** (defendants & civil defendants) and **Nguyên đơn / Bị hại** (plaintiffs) are crucial for quick case identification.
However, a single case can have multiple defendants or plaintiffs (often 2 to 10+ people). Listing all names in badges directly causes row wrapping and stretches row heights, breaking the table's layout alignment and aesthetic.

This change aims to:
- Make these two columns visible by default.
- Display multiple names in a compact, uniform, and clean layout that prevents row expansion.
- Provide quick hover access (via Radix UI Tooltip) to view the full lists of names.

---

## 2. Detailed Technical Design

### A. Component Columns Update

We will update [columns.tsx](file:///Users/anhtu/Projects/mono-cm/components/files/columns.tsx) to implement a custom formatter for lists of names.

We'll define a helper component/renderer `NameListCell` inside `columns.tsx` (or inline):

```tsx
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface NameListCellProps {
  names: string[];
  variant?: "red" | "blue" | "orange";
}

export function NameListCell({ names, variant = "blue" }: NameListCellProps) {
  if (names.length === 0) return <span className="text-muted-foreground">-</span>;

  const firstName = names[0];
  const remainingCount = names.length - 1;

  // Set colors based on role
  let badgeClass = "bg-blue-50/50 border-blue-200 text-blue-700 dark:bg-blue-950/20 dark:border-blue-800 dark:text-blue-300";
  if (variant === "red") {
    badgeClass = "bg-red-50/50 border-red-200 text-red-700 dark:bg-red-950/20 dark:border-red-800 dark:text-red-300";
  } else if (variant === "orange") {
    badgeClass = "bg-orange-50/50 border-orange-200 text-orange-700 dark:bg-orange-950/20 dark:border-orange-800 dark:text-orange-300";
  }

  return (
    <div className="flex items-center gap-1 text-xs">
      <Badge variant="outline" className={cn("font-normal px-2 py-0.5 max-w-[120px] truncate block", badgeClass)} title={firstName}>
        {firstName}
      </Badge>
      {remainingCount > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="secondary" className="cursor-help px-1.5 py-0.5 text-[10px] font-medium bg-muted/65 hover:bg-muted/80 text-muted-foreground border border-muted/85">
              +{remainingCount} khác
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="p-2.5 max-w-[280px]">
            <div className="space-y-1">
              <p className="font-semibold border-b border-muted-foreground/20 pb-1 mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                Danh sách chi tiết ({names.length})
              </p>
              <ul className="list-disc pl-3.5 space-y-1 text-xs font-normal">
                {names.map((name, i) => (
                  <li key={i} className="break-words">
                    {name}
                  </li>
                ))}
              </ul>
            </div>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
```

We will replace the cell renderers for `defendants_civil` and `plaintiffs_victims`:
- For **Bị cáo / Bị đơn**:
  We have two categories: `defendants` (defs) and `civilDefendants` (civilDefs).
  If both exist, we can render them as separate groups or merge them.
  Let's keep them separated by showing the primary defendant/civil defendant name or grouping them nicely inside the tooltip.
  Wait, let's design it so it renders both if they fit, or merges them into a clean grouped tooltip.
  Let's do this:
  - If we have primary defendants and primary civil defendants, we can render the first defendant (red badge) and the first civil defendant (orange badge) if they exist.
  - If there are more than 1 in either category (or combined), we show a combined `+{N} khác` badge with a tooltip showing a grouped list:
    - **Bị cáo/Bị đơn:** name 1, name 2...
    - **Bị đơn dân sự:** name 1, name 2...

- For **Nguyên đơn / Bị hại**:
  - Render the first plaintiff (blue badge).
  - If more than 1, show a `+{N} khác` badge with a tooltip showing all plaintiffs.

### B. Table Default Visibility Update

In [file-table.tsx](file:///Users/anhtu/Projects/mono-cm/components/files/file-table.tsx), update `columnVisibility` to set `defendants_civil` and `plaintiffs_victims` to `true` by default.

---

## 3. Verification Plan

### Automated Tests
- Run `npm run test` or any component tests if available.

### Manual Verification
- Launch local development environment.
- Go to Case Files list.
- Check that "Bị cáo / Bị đơn" and "Nguyên đơn / Bị hại" columns are visible by default.
- Hover over the `+{N} khác` badges to check if the tooltip displays the full names list properly.
- Verify that row heights of rows with multiple names are identical to rows with a single name (no layout stretching).
