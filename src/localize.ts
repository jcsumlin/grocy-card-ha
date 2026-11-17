import type { HomeAssistant, Item } from "./types";

/**
 * English strings. Any key can be overridden with `custom_translation`, so
 * dashboards in other languages can translate the card without a code change.
 * `{n}` and `{name}` are placeholders.
 */
export const STRINGS = {
  title: "Chores",
  overdue: "Overdue",
  today: "Today",
  upcoming: "Upcoming",
  anytime: "Anytime",
  tomorrow: "Tomorrow",
  yesterday: "Yesterday",
  in_days: "In {n} days",
  days_overdue: "{n} days overdue",
  day_overdue: "1 day overdue",
  days_ago: "{n} days ago",
  no_due_date: "No due date",
  never_done: "Never done",
  due: "Due",
  last_done: "Last done",
  assigned: "Assigned",
  due_date: "Due date",
  by: "by {name}",
  unassigned: "Unassigned",
  task: "Task",
  all_done: "All caught up",
  all_done_sub: "Nothing due. Enjoy it.",
  more: "{n} more",
  less: "Show less",
  track: "Mark {name} as done",
  undo: "Undo",
  done_toast: "Done: {name}",
  skip: "Skip this time",
  reschedule: "Move to",
  assign_to_me: "Assign to me",
  add_task: "Add task",
  task_name: "New task…",
  add: "Add",
  cancel: "Cancel",
  failed: "Grocy didn't accept that: {error}",
  missing_entity: "Entity not found: {entity}",
  not_grocy: "{entity} has no chores or tasks attribute. Is it a Grocy sensor?",
  unavailable: "Grocy is unavailable",
} as const;

export type StringKey = keyof typeof STRINGS;

export class Localizer {
  private readonly lang: string;

  constructor(
    hass: HomeAssistant | undefined,
    private readonly overrides: Record<string, string> = {},
  ) {
    this.lang = hass?.locale?.language ?? hass?.language ?? navigator.language ?? "en";
  }

  t(key: StringKey, vars: Record<string, string | number> = {}): string {
    let s: string = this.overrides[key] ?? this.overrides[STRINGS[key]] ?? STRINGS[key];
    for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  }

  date(d: Date, opts: Intl.DateTimeFormatOptions): string {
    try {
      return new Intl.DateTimeFormat(this.lang, opts).format(d);
    } catch {
      return new Intl.DateTimeFormat("en", opts).format(d);
    }
  }

  time(d: Date): string {
    return this.date(d, { hour: "numeric", minute: "2-digit" });
  }

  /** "Today · 18:00", "Tomorrow", "In 3 days", "Fri, Nov 27", "2 days overdue". */
  dueLabel(item: Item, threshold: number): string {
    if (!item.due || item.dueDays === null) return this.t("no_due_date");
    const n = item.dueDays;
    let label: string;
    if (n < -1) label = this.t("days_overdue", { n: -n });
    else if (n === -1) label = this.t("day_overdue");
    else if (n === 0) label = this.t("today");
    else if (n === 1) label = this.t("tomorrow");
    else if (n < threshold) label = this.t("in_days", { n });
    else label = this.date(item.due, { weekday: "short", month: "short", day: "numeric" });
    return item.dueDateOnly ? label : `${label} · ${this.time(item.due)}`;
  }

  lastTrackedLabel(item: Item): string {
    if (!item.lastTracked || item.lastTrackedDays === null) return this.t("never_done");
    const ago = -item.lastTrackedDays;
    if (ago <= 0) return this.t("today");
    if (ago === 1) return this.t("yesterday");
    if (ago < 14) return this.t("days_ago", { n: ago });
    return this.date(item.lastTracked, { month: "short", day: "numeric", year: "numeric" });
  }
}
