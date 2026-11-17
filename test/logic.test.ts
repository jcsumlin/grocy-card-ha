import { describe, expect, it } from "vitest";
import {
  assignCall,
  calendarDaysFrom,
  displayName,
  filterItems,
  groupItems,
  itemsFromEntity,
  parseGrocyDate,

  rescheduleCall,
  resolveUserId,
  skipCall,
  sortItems,
  trackCall,
} from "../src/logic";
import { Localizer } from "../src/localize";
import type { CardConfig, HassEntity, HomeAssistant } from "../src/types";

const NOW = new Date(2026, 10, 16, 9, 30); // Mon 16 Nov 2026, 09:30 local
const base: CardConfig = { type: "custom:grocy-chore-card", entity: "sensor.grocy_chores" };

const choresEntity: HassEntity = {
  entity_id: "sensor.grocy_chores",
  state: "4",
  attributes: {
    chores: [
      {
        id: 1,
        name: "Vacuum living room",
        next_estimated_execution_time: "2026-11-14T00:00:00",
        last_tracked_time: "2026-11-07T10:00:00",
        track_date_only: true,
        next_execution_assigned_user: { id: 1, display_name: "Alex" },
        last_done_by: { id: 2, display_name: "Sam" },
      },
      {
        id: 2,
        name: "Water plants",
        next_estimated_execution_time: "2026-11-16 18:00:00",
        track_date_only: false,
        next_execution_assigned_user: { id: 2, display_name: "Sam" },
      },
      { id: 3, name: "Descale kettle", next_estimated_execution_time: "2026-11-20T00:00:00" },
      { id: 4, name: "Clean gutters", next_estimated_execution_time: null },
      { id: 5, name: "Never", next_estimated_execution_time: "2999-12-31 23:59:59" },
    ],
  },
};

const tasksEntity: HassEntity = {
  entity_id: "sensor.grocy_tasks",
  state: "2",
  attributes: {
    tasks: [
      { id: 10, name: "Buy filters", due_date: "2026-11-17", category: { id: 3, name: "Errands" }, assigned_to_user_id: 1 },
      { id: 11, name: "Done already", due_date: "2026-11-10", done: 1 },
      { id: 12, name: "Fix shelf", due_date: null, category_id: null },
    ],
  },
};

const chores = () => itemsFromEntity(choresEntity, NOW);
const tasks = () => itemsFromEntity(tasksEntity, NOW);

describe("dates", () => {
  it("parses date-only strings as local midnight", () => {
    const d = parseGrocyDate("2026-11-17")!;
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 10, 17, 0]);
  });
  it("parses Grocy's space-separated datetimes", () => {
    expect(parseGrocyDate("2026-11-16 18:00:00")!.getHours()).toBe(18);
  });
  it("treats empty values and the 2999 sentinel as no date", () => {
    expect(parseGrocyDate(null)).toBeNull();
    expect(parseGrocyDate("")).toBeNull();
    expect(parseGrocyDate("2999-12-31 23:59:59")).toBeNull();
    expect(parseGrocyDate("garbage")).toBeNull();
  });
  it("counts calendar days, not 24h periods", () => {
    expect(calendarDaysFrom(new Date(2026, 10, 16, 23, 0), new Date(2026, 10, 17, 1, 0))).toBe(1);
    expect(calendarDaysFrom(NOW, new Date(2026, 10, 14))).toBe(-2);
  });
});

describe("normalising sensor attributes", () => {
  it("reads chores with due, assignee and last-tracked info", () => {
    const [vacuum, water] = chores();
    expect(vacuum).toMatchObject({
      kind: "chore",
      id: "1",
      dueDays: -2,
      dueDateOnly: true,
      assignedId: "1",
      assignedName: "Alex",
      lastTrackedBy: "Sam",
      lastTrackedDays: -9,
    });
    expect(water.dueDays).toBe(0);
    expect(water.dueDateOnly).toBe(false);
  });
  it("reads tasks, skips completed ones and handles missing categories", () => {
    const t = tasks();
    expect(t.map((i) => i.id)).toEqual(["10", "12"]);
    expect(t[0]).toMatchObject({ kind: "task", dueDays: 1, categoryId: "3", assignedId: "1" });
    expect(t[1]).toMatchObject({ due: null, categoryId: null });
  });
  it("makes keys unique per entity", () => {
    const keys = [...chores(), ...tasks()].map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("filtering", () => {
  it("show_days N keeps overdue and items due within N days", () => {
    const names = filterItems(chores(), { ...base, show_days: 0 }).map((i) => i.name);
    expect(names).toEqual(["Vacuum living room", "Water plants", "Clean gutters", "Never"]);
  });
  it("show_days a..b keeps only the window", () => {
    const names = filterItems(chores(), { ...base, show_days: "1..7" }).map((i) => i.id);
    expect(names).toEqual(["3", "4", "5"]);
  });
  it("can drop items without a due date", () => {
    const names = filterItems(chores(), { ...base, show_chores_without_due: false }).map((i) => i.id);
    expect(names).toEqual(["1", "2", "3"]);
  });
  it("name filters are case-insensitive and OR-ed", () => {
    expect(filterItems(chores(), { ...base, filter: ["VACUUM", "kettle"] }).map((i) => i.id)).toEqual(["1", "3"]);
  });
  it("filter_user keeps that user's items, and unassigned only on request", () => {
    expect(filterItems(chores(), { ...base, filter_user: 2 }).map((i) => i.id)).toEqual(["2"]);
    expect(filterItems(chores(), { ...base, filter_user: 2, show_unassigned: true }).map((i) => i.id)).toEqual([
      "2",
      "3",
      "4",
      "5",
    ]);
  });
  it('filter_user "current" resolves through user_id', () => {
    const hass = { user: { id: "x", name: "Sam" } } as HomeAssistant;
    const config = { ...base, filter_user: "current", user_id: { Sam: 2, default: 1 } };
    expect(filterItems(chores(), config, hass).map((i) => i.id)).toEqual(["2"]);
  });
  it("filters task categories by loose id match", () => {
    const config = { ...base, filter_task_category: 3 };
    expect(filterItems([...tasks(), ...chores()], config).map((i) => i.id)).toEqual(["10", "1", "2", "3", "4", "5"]);
  });
});

describe("sorting and grouping", () => {
  it("sorts by due date with undated items last", () => {
    expect(sortItems([...tasks(), ...chores()], base).map((i) => i.id)).toEqual([
      "1",
      "2",
      "10",
      "3",
      "4",
      "12",
      "5",
    ]);
  });
  it("sorts by name descending", () => {
    const ids = sortItems(chores(), { ...base, sort_by: "name", sort_order: "desc" }).map((i) => i.name);
    expect(ids[0]).toBe("Water plants");
  });
  it("groups into buckets in urgency order", () => {
    const groups = groupItems(sortItems(chores(), base));
    expect(groups.map((g) => [g.bucket, g.items.length])).toEqual([
      ["overdue", 1],
      ["today", 1],
      ["upcoming", 1],
      ["anytime", 2],
    ]);
  });
});

describe("users and names", () => {
  it("resolves user_id maps by HA user name with a default", () => {
    const hass = (name: string) => ({ user: { id: "x", name } }) as HomeAssistant;
    const config = { ...base, user_id: { Alex: 1, Sam: 2, default: 3 } };
    expect(resolveUserId(config, hass("Sam"))).toBe("2");
    expect(resolveUserId(config, hass("Guest"))).toBe("3");
    expect(resolveUserId(base)).toBe("1");
  });
  it("remove_filter strips the filter text", () => {
    const [vacuum] = chores();
    expect(displayName(vacuum, { ...base, filter: "vacuum", remove_filter: true })).toBe("living room");
  });
});

describe("service calls", () => {
  const [vacuum] = chores();
  const [filters] = tasks();
  it("tracks chores as the configured user", () => {
    expect(trackCall(vacuum, "2", base)).toEqual({
      domain: "grocy",
      service: "execute_chore",
      data: { chore_id: "1", done_by: "2" },
    });
    expect(trackCall(vacuum, "2", { ...base, track_execution_now: true }).data.track_execution_now).toBe(true);
  });
  it("completes tasks", () => {
    expect(trackCall(filters, "1", base)).toEqual({
      domain: "grocy",
      service: "complete_task",
      data: { task_id: "10" },
    });
  });
  it("skips chores", () => {
    expect(skipCall(vacuum, "1").data).toEqual({ chore_id: "1", done_by: "1", skipped: true });
  });
  it("reschedules chores keeping the time of day", () => {
    const water = chores()[1];
    const call = rescheduleCall(water, new Date(2026, 10, 20));
    expect(call.data).toEqual({
      entity_type: "chores",
      object_id: "2",
      data: { rescheduled_date: "2026-11-20 18:00:00", rescheduled_next_execution_assigned_to_user_id: "2" },
    });
  });
  it("reschedules tasks without blanking other fields", () => {
    const call = rescheduleCall(filters, new Date(2026, 10, 25));
    expect(call.data).toEqual({
      entity_type: "tasks",
      object_id: "10",
      data: { name: "Buy filters", description: "", category_id: 3, assigned_to_user_id: 1, due_date: "2026-11-25" },
    });
  });
  it("assigns chores via a one-off rescheduled assignment", () => {
    const data = assignCall(vacuum, "2").data.data as Record<string, unknown>;
    expect(data).toEqual({
      rescheduled_date: "2026-11-14 00:00:00",
      rescheduled_next_execution_assigned_to_user_id: "2",
      next_execution_assigned_to_user_id: "2",
    });
  });
});

describe("labels", () => {
  const l = new Localizer({ locale: { language: "en-US" } } as HomeAssistant);
  it("describes due dates relative to today", () => {
    const [vacuum, water, kettle, gutters] = chores();
    expect(l.dueLabel(vacuum, 7)).toBe("2 days overdue");
    expect(l.dueLabel(water, 7)).toMatch(/^Today · 6:00\sPM$/);
    expect(l.dueLabel(kettle, 7)).toBe("In 4 days");
    expect(l.dueLabel(kettle, 3)).toBe("Fri, Nov 20");
    expect(l.dueLabel(gutters, 7)).toBe("No due date");
  });
  it("applies custom translations by key or by English text", () => {
    const de = new Localizer(undefined, { today: "Heute", "Tomorrow": "Morgen" });
    expect(de.t("today")).toBe("Heute");
    expect(de.t("tomorrow")).toBe("Morgen");
  });
});
