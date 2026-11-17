import type {
  Bucket,
  CardConfig,
  HassEntity,
  HomeAssistant,
  Item,
  ItemKind,
} from "./types";

const DAY_MS = 86_400_000;

/* ------------------------------------------------------------------ dates */

/**
 * Parses the date strings the Grocy integration emits: `2026-11-16`,
 * `2026-11-16 08:00:00`, or ISO strings with/without offset.
 * Grocy uses year 2999 as a "never" sentinel; that is treated as no date.
 */
export function parseGrocyDate(value: unknown): Date | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const s = value.trim();
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  const d = dateOnly
    ? new Date(+dateOnly[1], +dateOnly[2] - 1, +dateOnly[3])
    : new Date(s.replace(" ", "T"));
  if (Number.isNaN(d.getTime()) || d.getFullYear() >= 2999) return null;
  return d;
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Whole calendar days from `now` to `d` (DST-safe). */
export function calendarDaysFrom(now: Date, d: Date): number {
  return Math.round((startOfDay(d).getTime() - startOfDay(now).getTime()) / DAY_MS);
}

function hasTimeOfDay(d: Date): boolean {
  return d.getHours() !== 0 || d.getMinutes() !== 0;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** `YYYY-MM-DD` in local time. */
export function toDateString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** `YYYY-MM-DD HH:MM:SS` in local time, the format Grocy stores. */
export function toGrocyDateTime(d: Date): string {
  return `${toDateString(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

/* -------------------------------------------------------------- normalise */

const str = (v: unknown): string | null =>
  v === null || v === undefined || v === "" ? null : String(v);

const obj = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : null;

function userName(v: unknown): string | null {
  const u = obj(v);
  if (!u) return null;
  return str(u.display_name) ?? str(u.username) ?? null;
}

function toItem(
  kind: ItemKind,
  entityId: string,
  raw: Record<string, unknown>,
  now: Date,
): Item | null {
  const id = str(raw.id);
  if (id === null) return null;

  const due = parseGrocyDate(kind === "chore" ? raw.next_estimated_execution_time : raw.due_date);
  const lastTracked = kind === "chore" ? parseGrocyDate(raw.last_tracked_time) : null;

  const assigned =
    kind === "chore" ? obj(raw.next_execution_assigned_user) : obj(raw.assigned_to_user);
  const assignedId =
    str(assigned?.id) ??
    str(kind === "chore" ? raw.next_execution_assigned_to_user_id : raw.assigned_to_user_id);

  const category = obj(raw.category);
  const dueDateOnly =
    !due || kind === "task" || raw.track_date_only === true || raw.track_date_only === 1 || !hasTimeOfDay(due);

  return {
    key: `${entityId}|${kind}|${id}`,
    kind,
    id,
    entityId,
    name: str(raw.name) ?? `#${id}`,
    description: str(raw.description),
    due,
    dueDays: due ? calendarDaysFrom(now, due) : null,
    dueDateOnly,
    lastTracked,
    lastTrackedDays: lastTracked ? calendarDaysFrom(now, lastTracked) : null,
    lastTrackedBy: userName(raw.last_done_by),
    assignedId,
    assignedName: userName(assigned),
    categoryId: str(raw.category_id) ?? str(category?.id),
    signature: [
      raw.next_estimated_execution_time,
      raw.last_tracked_time,
      raw.due_date,
      raw.done,
      raw.rescheduled_date,
      assignedId,
    ].join("|"),
    raw,
  };
}

/** Reads chores and/or tasks from one Grocy sensor entity. */
export function itemsFromEntity(entity: HassEntity, now = new Date()): Item[] {
  const out: Item[] = [];
  const read = (kind: ItemKind, list: unknown) => {
    if (!Array.isArray(list)) return;
    for (const raw of list) {
      const o = obj(raw);
      if (!o) continue;
      // Completed tasks can linger in the attribute list.
      if (kind === "task" && (o.done === 1 || o.done === true || o.done === "1")) continue;
      const item = toItem(kind, entity.entity_id, o, now);
      if (item) out.push(item);
    }
  };
  read("chore", entity.attributes.chores);
  read("task", entity.attributes.tasks);
  return out;
}

export function entityIds(config: Pick<CardConfig, "entity">): string[] {
  const e = config.entity;
  return (Array.isArray(e) ? e : [e]).filter((x): x is string => typeof x === "string" && !!x);
}

/* ------------------------------------------------------------------ users */

/** The Grocy user id actions are recorded as. */
export function resolveUserId(config: CardConfig, hass?: HomeAssistant): string {
  const u = config.user_id;
  if (u === undefined || u === null) return "1";
  if (typeof u === "object") {
    const name = hass?.user?.name;
    const hit = name !== undefined ? (u[name] ?? u[name.toLowerCase()]) : undefined;
    return String(hit ?? u.default ?? "1");
  }
  return String(u);
}

function filterUsers(config: CardConfig, hass?: HomeAssistant): string[] | null {
  const f = config.filter_user;
  if (f === undefined || f === null || f === "") return null;
  return (Array.isArray(f) ? f : [f]).map((v) =>
    v === "current" ? resolveUserId(config, hass) : String(v),
  );
}

/* --------------------------------------------------------------- filtering */

function asList<T>(v: T | T[] | undefined): T[] {
  return v === undefined || v === null ? [] : Array.isArray(v) ? v : [v];
}

/** Parses `show_days` into an inclusive [min, max] window (min null = include overdue). */
export function parseShowDays(v: CardConfig["show_days"]): [number | null, number] | null {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v === "number") return [null, v];
  const range = /^\s*(-?\d+)\s*\.\.\s*(-?\d+)\s*$/.exec(v);
  if (range) return [+range[1], +range[2]];
  const n = Number(v);
  return Number.isFinite(n) ? [null, n] : null;
}

export function filterItems(
  items: Item[],
  config: CardConfig,
  hass?: HomeAssistant,
): Item[] {
  const window = parseShowDays(config.show_days);
  const nameFilters = asList(config.filter).map((f) => String(f).toLowerCase());
  const users = filterUsers(config, hass);
  const categories = asList(config.filter_task_category).map(String);

  return items.filter((item) => {
    if (item.dueDays === null) {
      if (item.kind === "chore" && config.show_chores_without_due === false) return false;
      if (item.kind === "task" && config.show_tasks_without_due === false) return false;
    } else if (window) {
      const [min, max] = window;
      if (item.dueDays > max) return false;
      if (min !== null && item.dueDays < min) return false;
    }

    if (nameFilters.length && !nameFilters.some((f) => item.name.toLowerCase().includes(f))) {
      return false;
    }

    if (users) {
      if (item.assignedId === null) {
        if (config.show_unassigned !== true) return false;
      } else if (!users.includes(item.assignedId)) {
        return false;
      }
    } else if (item.assignedId === null && config.show_unassigned === false) {
      return false;
    }

    if (categories.length && item.kind === "task" && !categories.includes(item.categoryId ?? "")) {
      return false;
    }
    return true;
  });
}

/** Name as displayed, with filter text stripped when `remove_filter` is set. */
export function displayName(item: Item, config: CardConfig): string {
  if (!config.remove_filter) return item.name;
  let name = item.name;
  for (const f of asList(config.filter)) {
    name = name.replace(new RegExp(String(f).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"), "");
  }
  return name.replace(/\s{2,}/g, " ").replace(/^[\s\-–—:|]+|[\s\-–—:|]+$/g, "") || item.name;
}

/* ----------------------------------------------------------------- sorting */

export function sortItems(items: Item[], config: CardConfig): Item[] {
  const key = config.sort_by ?? "due";
  const dir = config.sort_order === "desc" ? -1 : 1;
  const value = (i: Item): number | string | null => {
    switch (key) {
      case "name":
        return i.name.toLowerCase();
      case "assignee":
        return i.assignedName?.toLowerCase() ?? null;
      case "last_tracked":
        return i.lastTracked?.getTime() ?? null;
      default:
        return i.due?.getTime() ?? null;
    }
  };
  return [...items].sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    if (va !== vb) {
      // Missing values always sink to the bottom, regardless of direction.
      if (va === null) return 1;
      if (vb === null) return -1;
      return (va < vb ? -1 : 1) * dir;
    }
    if (key !== "due" && a.due?.getTime() !== b.due?.getTime()) {
      if (!a.due) return 1;
      if (!b.due) return -1;
      return a.due.getTime() - b.due.getTime();
    }
    return a.name.localeCompare(b.name);
  });
}

/* ---------------------------------------------------------------- grouping */

export function bucketOf(item: Item): Bucket {
  if (item.dueDays === null) return "anytime";
  if (item.dueDays < 0) return "overdue";
  if (item.dueDays === 0) return "today";
  return "upcoming";
}

export const BUCKET_ORDER: Bucket[] = ["overdue", "today", "upcoming", "anytime"];

export function countBuckets(items: Item[]): Record<Bucket, number> {
  const counts: Record<Bucket, number> = { overdue: 0, today: 0, upcoming: 0, anytime: 0 };
  for (const i of items) counts[bucketOf(i)]++;
  return counts;
}

/** Groups items into due buckets, preserving the incoming order within each. */
export function groupItems(items: Item[]): Array<{ bucket: Bucket; items: Item[] }> {
  return BUCKET_ORDER.map((bucket) => ({
    bucket,
    items: items.filter((i) => bucketOf(i) === bucket),
  })).filter((g) => g.items.length > 0);
}

/* ---------------------------------------------------------- service calls */

export interface ServiceCall {
  domain: string;
  service: string;
  data: Record<string, unknown>;
}

export function trackCall(item: Item, doneBy: string, config: CardConfig): ServiceCall {
  if (item.kind === "task") {
    return { domain: "grocy", service: "complete_task", data: { task_id: item.id } };
  }
  const data: Record<string, unknown> = { chore_id: item.id, done_by: doneBy };
  if (config.track_execution_now) data.track_execution_now = true;
  return { domain: "grocy", service: "execute_chore", data };
}

export function skipCall(item: Item, doneBy: string): ServiceCall {
  return {
    domain: "grocy",
    service: "execute_chore",
    data: { chore_id: item.id, done_by: doneBy, skipped: true },
  };
}

/** Task updates resend the editable fields so Grocy doesn't blank them. */
function taskData(item: Item, patch: Record<string, unknown>): Record<string, unknown> {
  const r = item.raw;
  return {
    name: r.name,
    description: r.description ?? "",
    category_id: r.category_id ?? obj(r.category)?.id ?? "",
    assigned_to_user_id: r.assigned_to_user_id ?? item.assignedId ?? "",
    due_date: r.due_date ?? "",
    ...patch,
  };
}

/** Moves an item's next due date to `date` (keeping the chore's time of day). */
export function rescheduleCall(item: Item, date: Date): ServiceCall {
  if (item.kind === "task") {
    return {
      domain: "grocy",
      service: "update_generic",
      data: {
        entity_type: "tasks",
        object_id: item.id,
        data: taskData(item, { due_date: toDateString(date) }),
      },
    };
  }
  const when = new Date(date);
  if (item.due) when.setHours(item.due.getHours(), item.due.getMinutes(), 0, 0);
  return {
    domain: "grocy",
    service: "update_generic",
    data: {
      entity_type: "chores",
      object_id: item.id,
      data: {
        rescheduled_date: toGrocyDateTime(when),
        rescheduled_next_execution_assigned_to_user_id: item.assignedId ?? "",
      },
    },
  };
}

export function assignCall(item: Item, userId: string, now = new Date()): ServiceCall {
  if (item.kind === "task") {
    return {
      domain: "grocy",
      service: "update_generic",
      data: {
        entity_type: "tasks",
        object_id: item.id,
        data: taskData(item, { assigned_to_user_id: userId }),
      },
    };
  }
  // Grocy only honours a one-off chore assignment alongside a rescheduled date.
  const rescheduled = parseGrocyDate(item.raw.rescheduled_date) ?? item.due ?? now;
  return {
    domain: "grocy",
    service: "update_generic",
    data: {
      entity_type: "chores",
      object_id: item.id,
      data: {
        rescheduled_date: toGrocyDateTime(rescheduled),
        rescheduled_next_execution_assigned_to_user_id: userId,
        next_execution_assigned_to_user_id: userId,
      },
    },
  };
}

export function createTaskCall(
  name: string,
  dueDate: string | null,
  userId: string,
): ServiceCall {
  const data: Record<string, unknown> = { name, assigned_to_user_id: userId };
  if (dueDate) data.due_date = dueDate;
  return { domain: "grocy", service: "add_generic", data: { entity_type: "tasks", data } };
}
