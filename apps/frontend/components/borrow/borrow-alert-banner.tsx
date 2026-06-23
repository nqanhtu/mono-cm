"use client";

import { useState } from "react";
import { AlertTriangle, Clock, X, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from 'react-router-dom';
import { useBorrowAlerts } from "@/lib/hooks/use-borrow";

export function BorrowAlertBanner() {
  const { alerts } = useBorrowAlerts();
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible || !alerts) return null;
  if (alerts.overdueCount === 0 && alerts.soonOverdueCount === 0) return null;

  // Don't show on the borrow page itself to avoid redundancy, or show a condensed version?
  // User might want it everywhere for visibility.

  return (
    <div className="px-6 py-2 bg-background border-b animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          {alerts.overdueCount > 0 ? (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-destructive/10 text-destructive text-sm font-medium border border-destructive/20">
              <AlertTriangle className="h-4 w-4" />
              <span>{alerts.overdueCount} phiếu quá hạn</span>
            </div>
          ) : null}
          {alerts.soonOverdueCount > 0 ? (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 text-sm font-medium border border-amber-500/20">
              <Clock className="h-4 w-4" />
              <span>{alerts.soonOverdueCount} phiếu sắp hết hạn (3 ngày)</span>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="link" size="sm" asChild className="h-8 text-muted-foreground hover:text-primary">
            <Link to="/borrow" className="flex items-center gap-1">
              Xem chi tiết <ChevronRight className="h-3 w-3" />
            </Link>
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-muted-foreground"
            onClick={() => setIsVisible(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
