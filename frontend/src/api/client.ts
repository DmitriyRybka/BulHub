const API = import.meta.env.VITE_API_URL ?? `http://${window.location.hostname}:8000`;

export function getToken(): string | null {
  return localStorage.getItem("token");
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem("token", token);
  else localStorage.removeItem("token");
}

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  const res = await fetch(API + path, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  if (res.status === 401) {
    setToken(null);
    window.location.href = "/login";
    throw new Error("Сессия истекла");
  }
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.detail ?? `Ошибка ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ---------- Типы ----------

export type Role = "owner" | "editor" | "viewer";

export interface UserOut { id: number; email: string; username: string; }

export interface Space {
  id: number; name: string; owner_id: number;
  is_personal: boolean; my_role: Role;
}
export interface Member { user_id: number; email: string; username: string; role: Role; }
export interface Occurrence {
  event_id: number; title: string; start: string; end: string;
  all_day: boolean; space_id: number; reminder_minutes: number | null;
}

export interface Category { id: number; name: string; kind: "income" | "expense"; }
export interface Tx { id: number; category_id: number; amount: number; date: string; note: string; }
export interface CategorySummary {
  category_id: number; name: string; kind: "income" | "expense";
  total: number; budget_limit: number | null; budget_left: number | null;
}
export interface Summary {
  month: string; income_total: number; expense_total: number;
  savings: number; savings_rate: number;
  by_category: CategorySummary[]; advice: string[];
}

export interface TodoList { id: number; name: string; owner_id: number; my_role: Role; }
export type TodoStatus = "todo" | "doing" | "done";
export interface TodoItem {
  id: number; list_id: number; title: string;
  status: TodoStatus; due_date: string | null; created_by: number;
}
