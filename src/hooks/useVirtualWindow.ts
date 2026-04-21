import { useMemo } from "react";

export function useVirtualWindow<T>(items: T[], visibleCount: number, offsetFromBottom: number): {
  visible: T[];
  start: number;
  end: number;
} {
  return useMemo(() => {
    const end = Math.max(0, items.length - offsetFromBottom);
    const start = Math.max(0, end - visibleCount);
    return {
      visible: items.slice(start, end),
      start,
      end,
    };
  }, [items, visibleCount, offsetFromBottom]);
}
