/** The slice of Home Assistant's `hass` object this card relies on. */
export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
}

export interface HomeAssistant {
  states: Record<string, HassEntity>;
  user?: { id: string; name: string; is_admin?: boolean };
  locale?: { language: string; time_format?: string };
  language?: string;
  callService(
    domain: string,
    service: string,
    data?: Record<string, unknown>,
  ): Promise<unknown>;
}

export type UserIdConfig = number | string | Record<string, number | string>;
export type FilterUser = number | string | Array<number | string>;
export type SortKey = "due" | "name" | "assignee" | "last_tracked";

export interface CardConfig {
  type: string;
  entity: string | string[];
  title?: string;
  /** Grocy user id used as `done_by`; a number, or a map of HA user name → Grocy id (with `default`). */
  user_id?: UserIdConfig;

  // What to show
  show_quantity?: number;
  /** `N` → overdue + due within N days; `"a..b"` → only items due between a and b days from today. */
  show_days?: number | string;
  show_chores_without_due?: boolean;
  show_tasks_without_due?: boolean;
  filter?: string | string[];
  remove_filter?: boolean;
  filter_user?: FilterUser;
  show_unassigned?: boolean;
  filter_task_category?: number | string | Array<number | string>;

  // Presentation
  group_by_due?: boolean;
  sort_by?: SortKey;
  sort_order?: "asc" | "desc";
  show_header?: boolean;
  show_summary_bar?: boolean;
  show_due_date?: boolean;
  show_assigned?: boolean;
  show_last_tracked?: boolean;
  show_last_tracked_by?: boolean;
  show_description?: boolean;
  show_empty?: boolean;
  due_in_days_threshold?: number;

  // Actions
  show_track_button?: boolean;
  show_details?: boolean;
  show_skip?: boolean;
  show_reschedule?: boolean;
  show_assign_to_me?: boolean;
  show_create_task?: boolean;
  undo_seconds?: number;
  track_execution_now?: boolean;

  custom_translation?: Record<string, string>;
}

export type ItemKind = "chore" | "task";

/** A chore or task normalised from the Grocy integration's sensor attributes. */
export interface Item {
  /** Unique across all configured entities. */
  key: string;
  kind: ItemKind;
  id: string;
  entityId: string;
  name: string;
  description: string | null;
  due: Date | null;
  /** Calendar days from today until `due` (negative when overdue). */
  dueDays: number | null;
  /** True when the due timestamp carries no meaningful time of day. */
  dueDateOnly: boolean;
  lastTracked: Date | null;
  lastTrackedDays: number | null;
  lastTrackedBy: string | null;
  assignedId: string | null;
  assignedName: string | null;
  categoryId: string | null;
  /**
   * Changes whenever Grocy reports a new state for this item. Lets the card keep a
   * completed item hidden until the sensor catches up, and no longer.
   */
  signature: string;
  raw: Record<string, unknown>;
}

export type Bucket = "overdue" | "today" | "upcoming" | "anytime";
