import { useQuery } from "@tanstack/react-query";
import type { Todo } from "@todo/shared";
import { api } from "../api/todos";

export const TODOS_KEY = ["todos"] as const;

export function useTodos() {
  return useQuery<Todo[]>({
    queryKey: TODOS_KEY,
    queryFn: api.list,
  });
}
