import type { CardConfig } from "./types";

/**
 * Schema for Home Assistant's built-in card editor (`getConfigForm`).
 * Options the form can't represent (per-user `user_id` maps, lists of filters,
 * translations) still work in YAML; `assertConfig` sends those configs to the
 * code editor instead of silently mangling them.
 */
const bool = (name: string) => ({ name, selector: { boolean: {} } });

const LABELS: Record<string, string> = {
  entity: "Grocy sensors (chores and/or tasks)",
  title: "Title",
  user_id: "Grocy user id to record completions as",
  show_days: "Only show items due within N days (blank = all)",
  show_quantity: "Max items before “N more” (blank = all)",
  filter: "Only items whose name contains",
  filter_user: "Only items assigned to Grocy user id",
  undo_seconds: "Undo window after tapping ✓ (seconds, 0 = instant)",
  due_in_days_threshold: "Say “in N days” below this many days, dates after",
  sort_by: "Sort by",
  sort_order: "Order",
  group_by_due: "Group into Overdue / Today / Upcoming / Anytime",
  show_header: "Show header",
  show_summary_bar: "Show urgency bar",
  show_assigned: "Show assignee",
  show_last_tracked: "Show when last done",
  show_last_tracked_by: "Show who did it last",
  show_description: "Show descriptions inline",
  show_due_date: "Show due date",
  show_chores_without_due: "Include chores with no due date",
  show_tasks_without_due: "Include tasks with no due date",
  show_unassigned: "Include unassigned items when filtering by user",
  show_empty: "Show card when nothing is due",
  show_track_button: "Show ✓ button",
  show_details: "Tap a row for details and actions",
  show_skip: "Allow skipping a chore",
  show_reschedule: "Allow rescheduling",
  show_assign_to_me: "Allow “Assign to me”",
  show_create_task: "Allow adding tasks",
  track_execution_now: "Record completion at the current time (not the scheduled time)",
};

export const configForm = {
  schema: [
    {
      name: "entity",
      required: true,
      selector: { entity: { multiple: true, filter: { domain: "sensor" } } },
    },
    { name: "title", selector: { text: {} } },
    {
      type: "grid",
      name: "",
      schema: [
        { name: "user_id", selector: { number: { min: 1, mode: "box" } } },
        { name: "undo_seconds", selector: { number: { min: 0, max: 30, mode: "box" } } },
      ],
    },
    {
      type: "expandable",
      name: "",
      title: "Filtering",
      schema: [
        {
          type: "grid",
          name: "",
          schema: [
            { name: "show_days", selector: { number: { min: 0, mode: "box" } } },
            { name: "show_quantity", selector: { number: { min: 0, mode: "box" } } },
            { name: "filter", selector: { text: {} } },
            { name: "filter_user", selector: { number: { min: 1, mode: "box" } } },
          ],
        },
        bool("show_unassigned"),
        bool("show_chores_without_due"),
        bool("show_tasks_without_due"),
      ],
    },
    {
      type: "expandable",
      name: "",
      title: "Layout",
      schema: [
        {
          type: "grid",
          name: "",
          schema: [
            {
              name: "sort_by",
              selector: {
                select: {
                  mode: "dropdown",
                  options: [
                    { value: "due", label: "Due date" },
                    { value: "name", label: "Name" },
                    { value: "assignee", label: "Assignee" },
                    { value: "last_tracked", label: "Last done" },
                  ],
                },
              },
            },
            {
              name: "sort_order",
              selector: {
                select: {
                  mode: "dropdown",
                  options: [
                    { value: "asc", label: "Ascending" },
                    { value: "desc", label: "Descending" },
                  ],
                },
              },
            },
          ],
        },
        { name: "due_in_days_threshold", selector: { number: { min: 0, mode: "box" } } },
        bool("group_by_due"),
        bool("show_header"),
        bool("show_summary_bar"),
        bool("show_due_date"),
        bool("show_assigned"),
        bool("show_last_tracked"),
        bool("show_last_tracked_by"),
        bool("show_description"),
        bool("show_empty"),
      ],
    },
    {
      type: "expandable",
      name: "",
      title: "Actions",
      schema: [
        bool("show_track_button"),
        bool("show_details"),
        bool("show_skip"),
        bool("show_reschedule"),
        bool("show_assign_to_me"),
        bool("show_create_task"),
        bool("track_execution_now"),
      ],
    },
  ],
  computeLabel: (s: { name: string }) => LABELS[s.name] ?? s.name,
  assertConfig: (config: CardConfig) => {
    const yamlOnly: Array<[keyof CardConfig, boolean]> = [
      // The multi-entity picker needs a list; `entity: sensor.x` is valid YAML-only shorthand.
      ["entity", typeof config.entity === "string"],
      ["user_id", typeof config.user_id === "object" && config.user_id !== null],
      ["filter", Array.isArray(config.filter)],
      ["filter_user", Array.isArray(config.filter_user) || typeof config.filter_user === "string"],
      ["show_days", typeof config.show_days === "string"],
      ["filter_task_category", config.filter_task_category !== undefined],
      ["custom_translation", config.custom_translation !== undefined],
    ];
    const hit = yamlOnly.find(([, bad]) => bad);
    if (hit) throw new Error(`\`${hit[0]}\` uses a form only the YAML editor supports.`);
  },
};
