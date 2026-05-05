import { useEffect, useState } from "react";

export type FilterValue = "all" | "active" | "completed";
const KEY = "todo.filter";
const VALID: FilterValue[] = ["all", "active", "completed"];

export function readFilter(): FilterValue {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw && (VALID as string[]).includes(raw)) {
      return raw as FilterValue;
    }
  } catch {
    // ignore (SSR / privacy mode)
  }
  return "all";
}

export function writeFilter(v: FilterValue): void {
  try {
    window.localStorage.setItem(KEY, v);
  } catch {
    // ignore
  }
}

export function useFilter(): [FilterValue, (v: FilterValue) => void] {
  const [filter, setFilter] = useState<FilterValue>(() => readFilter());
  useEffect(() => {
    writeFilter(filter);
  }, [filter]);
  return [filter, setFilter];
}
