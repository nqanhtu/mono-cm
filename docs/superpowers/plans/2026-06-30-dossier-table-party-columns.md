# Beautiful Plaintiff & Defendant Columns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the Bị cáo / Bị đơn (defendants) and Nguyên đơn / Bị hại (plaintiffs) columns in the dossier files table to support smart truncation with detailed hover tooltips, preventing row height expansion. Enable both columns by default in the UI.

**Architecture:** Update columns definitions with `Tooltip` wrapper and default visibility settings.

**Tech Stack:** React, Tailwind CSS, Radix UI (Tooltip), TypeScript, TanStack Table.

## Global Constraints

- Do not introduce arbitrary formatting changes.
- Ensure tooltips display cleanly on hover.

---

### Task 1: Update Columns Definitions with Tooltip and Truncation

**Files:**
- Modify: `components/files/columns.tsx`

**Interfaces:**
- Consumes: Prisma `defendants`, `civilDefendants`, `plaintiffs` array fields.
- Produces: Formatted table cells with Tooltip for columns `defendants_civil` and `plaintiffs_victims`.

- [ ] **Step 1: Import Tooltip components and cn helper**
  Add the following imports to `components/files/columns.tsx`:
  ```typescript
  import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
  ```

- [ ] **Step 2: Update defendants_civil column definition**
  Replace the cell renderer for `defendants_civil` with:
  ```tsx
    {
      id: "defendants_civil",
      header: "Bị cáo / Bị đơn",
      cell: ({ row }) => {
        const defs = row.original.defendants || [];
        const civilDefs = row.original.civilDefendants || [];
        if (defs.length === 0 && civilDefs.length === 0) return <span className="text-muted-foreground">-</span>;
        
        const allDefs = [
          ...defs.map(d => ({ name: d, type: "def" as const })),
          ...civilDefs.map(cd => ({ name: cd, type: "civil" as const }))
        ];

        const first = allDefs[0];
        const remainingCount = allDefs.length - 1;
        const badgeClass = first.type === "def" 
          ? "bg-red-50/50 border-red-200 text-red-700 dark:bg-red-950/20 dark:border-red-800 dark:text-red-300"
          : "bg-orange-50/50 border-orange-200 text-orange-700 dark:bg-orange-950/20 dark:border-orange-800 dark:text-orange-300";

        return (
          <div className="flex items-center gap-1 text-xs">
            <Badge variant="outline" className={cn("font-normal px-2 py-0.5 max-w-[120px] truncate block", badgeClass)} title={first.name}>
              {first.name}
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
                      Danh sách chi tiết ({allDefs.length})
                    </p>
                    <ul className="list-disc pl-3.5 space-y-1 text-xs font-normal">
                      {allDefs.map((item, i) => (
                        <li key={i} className="break-words">
                          <span className={item.type === "def" ? "text-red-600 dark:text-red-400 font-medium" : "text-orange-600 dark:text-orange-400 font-medium"}>
                            {item.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground ml-1">
                            ({item.type === "def" ? "Bị cáo / Bị đơn" : "Bị đơn dân sự"})
                          </span>
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
    },
  ```

- [ ] **Step 3: Update plaintiffs_victims column definition**
  Replace the cell renderer for `plaintiffs_victims` with:
  ```tsx
    {
      id: "plaintiffs_victims",
      header: "Nguyên đơn / Bị hại",
      cell: ({ row }) => {
        const plaintiffs = row.original.plaintiffs || [];
        if (plaintiffs.length === 0) return <span className="text-muted-foreground">-</span>;
        
        const first = plaintiffs[0];
        const remainingCount = plaintiffs.length - 1;
        const badgeClass = "bg-blue-50/50 border-blue-200 text-blue-700 dark:bg-blue-950/20 dark:border-blue-800 dark:text-blue-300";

        return (
          <div className="flex items-center gap-1 text-xs">
            <Badge variant="outline" className={cn("font-normal px-2 py-0.5 max-w-[120px] truncate block", badgeClass)} title={first}>
              {first}
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
                      Danh sách chi tiết ({plaintiffs.length})
                    </p>
                    <ul className="list-disc pl-3.5 space-y-1 text-xs font-normal">
                      {plaintiffs.map((name, i) => (
                        <li key={i} className="break-words">
                          <span className="text-blue-600 dark:text-blue-400 font-medium">{name}</span>
                          <span className="text-[10px] text-muted-foreground ml-1">(Nguyên đơn / Bị hại)</span>
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
    },
  ```

- [ ] **Step 4: Commit column changes**
  Run: `git commit -am "feat: update columns definition with smart truncation and tooltips for party names"`

---

### Task 2: Enable Column Visibility by Default

**Files:**
- Modify: `components/files/file-table.tsx`

**Interfaces:**
- Consumes: Table `columnVisibility` settings.
- Produces: Table with `defendants_civil` and `plaintiffs_victims` columns visible by default.

- [ ] **Step 1: Update initial columnVisibility state**
  In `components/files/file-table.tsx`, update initial state inside `useState` of `columnVisibility`:
  ```typescript
      return {
        defendants_civil: true,
        plaintiffs_victims: true,
      }
  ```

- [ ] **Step 2: Update default fallback in useEffect**
  In `components/files/file-table.tsx`, update the `useEffect` that loads stored visibility to:
  ```typescript
    React.useEffect(() => {
      const storedVisibility = window.localStorage.getItem('files-table-column-visibility')
      const storedDensity = window.localStorage.getItem('files-table-density')

      if (storedVisibility) setColumnVisibility(JSON.parse(storedVisibility))
      else {
        setColumnVisibility({
          defendants_civil: true,
          plaintiffs_victims: true,
        })
      }
      if (storedDensity === 'compact' || storedDensity === 'comfortable') setDensity(storedDensity)
    }, [])
  ```

- [ ] **Step 3: Commit visibility changes**
  Run: `git commit -am "feat: set defendants and plaintiffs columns visible by default"`
