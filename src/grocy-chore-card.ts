import { LitElement, html, nothing, svg, type PropertyValues, type TemplateResult } from "lit";
import { repeat } from "lit/directives/repeat.js";
import {
  mdiAccountArrowLeftOutline,
  mdiCalendarArrowRight,
  mdiCheck,
  mdiChevronDown,
  mdiClose,
  mdiHistory,
  mdiPartyPopper,
  mdiPlus,
  mdiSkipNext,
  mdiUndoVariant,
} from "@mdi/js";
import {
  assignCall,
  bucketOf,
  countBuckets,
  createTaskCall,
  displayName,
  entityIds,
  filterItems,
  groupItems,
  itemsFromEntity,
  rescheduleCall,
  resolveUserId,
  skipCall,
  sortItems,
  toDateString,
  trackCall,
  type ServiceCall,
} from "./logic";
import { Localizer } from "./localize";
import { styles } from "./styles";
import { configForm } from "./editor";
import type { Bucket, CardConfig, HomeAssistant, Item } from "./types";

declare const __VERSION__: string;

const CARD = "grocy-chore-card";
/** How long a finished item stays hidden if the sensor never reflects the change. */
const HIDE_FALLBACK_MS = 120_000;
const LEAVE_MS = 420;

type Urgency = "overdue" | "today" | "soon" | "later" | "anytime";

const icon = (path: string, cls = "icon") =>
  html`<svg class=${cls} viewBox="0 0 24 24" aria-hidden="true"><path d=${path}></path></svg>`;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

function hue(name: string): number {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

export class GrocyChoreCard extends LitElement {
  static override styles = styles;

  static override properties = {
    hass: { attribute: false },
    _config: { state: true },
    _expanded: { state: true },
    _showAll: { state: true },
    _adding: { state: true },
  };

  declare hass?: HomeAssistant;
  declare _config?: CardConfig;
  declare _expanded: string | null;
  declare _showAll: boolean;
  declare _adding: boolean;

  /** Items counting down to completion; tapping again before the timer fires undoes. */
  private _pending = new Map<string, ReturnType<typeof setTimeout>>();
  /** Items animating out of the list. */
  private _leaving = new Set<string>();
  /** Finished items hidden until Grocy reports their new state. */
  private _hidden = new Map<string, { signature: string; at: number }>();
  private _pendingItems = new Map<string, Item>();
  private _firstPaint = true;

  constructor() {
    super();
    this._expanded = null;
    this._showAll = false;
    this._adding = false;
  }

  /* ------------------------------------------------------------ HA hooks */

  static getConfigForm() {
    return configForm;
  }

  static getStubConfig(hass: HomeAssistant): Partial<CardConfig> {
    const ids = Object.keys(hass.states);
    const chores = ids.find((id) => Array.isArray(hass.states[id].attributes.chores));
    const tasks = ids.find((id) => Array.isArray(hass.states[id].attributes.tasks));
    return { entity: [chores ?? "sensor.grocy_chores", ...(tasks ? [tasks] : [])] };
  }

  setConfig(config: CardConfig): void {
    if (!config || !entityIds(config).length) {
      throw new Error("Set `entity` to a Grocy chores and/or tasks sensor.");
    }
    if (this._config && JSON.stringify(this._config) !== JSON.stringify(config)) {
      this._showAll = false;
    }
    this._config = config;
  }

  getCardSize(): number {
    return 2 + Math.min(this._visible().items.length, this._config?.show_quantity ?? 8);
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6, min_rows: 2 };
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    // Leaving the view shouldn't silently drop a completion the user asked for.
    for (const key of [...this._pending.keys()]) this._commitTrack(key);
  }

  protected override shouldUpdate(changed: PropertyValues<this>): boolean {
    if (!changed.has("hass") || changed.size > 1 || !this._config) return true;
    const old = changed.get("hass") as HomeAssistant | undefined;
    if (!old || !this.hass) return true;
    if (old.user?.id !== this.hass.user?.id || old.locale !== this.hass.locale) return true;
    return entityIds(this._config).some((id) => old.states[id] !== this.hass!.states[id]);
  }

  protected override updated(): void {
    // Keep the intro class until the entrance animation has played out, so a
    // quick follow-up render doesn't cut it short.
    if (this._firstPaint && this._config && this.hass && !this._introTimer) {
      this._introTimer = setTimeout(() => (this._firstPaint = false), 1500);
    }
  }
  private _introTimer?: ReturnType<typeof setTimeout>;

  /* --------------------------------------------------------------- data */

  private get _l(): Localizer {
    return new Localizer(this.hass, this._config?.custom_translation);
  }

  private _visible(): { items: Item[]; problems: string[] } {
    const config = this._config;
    const hass = this.hass;
    if (!config || !hass) return { items: [], problems: [] };
    const l = this._l;
    const problems: string[] = [];
    const now = new Date();
    let all: Item[] = [];
    let unavailable = 0;
    const ids = entityIds(config);
    for (const id of ids) {
      const entity = hass.states[id];
      if (!entity) {
        problems.push(l.t("missing_entity", { entity: id }));
        continue;
      }
      if (entity.state === "unavailable" || entity.state === "unknown") {
        unavailable++;
        continue;
      }
      if (!Array.isArray(entity.attributes.chores) && !Array.isArray(entity.attributes.tasks)) {
        problems.push(l.t("not_grocy", { entity: id }));
        continue;
      }
      all = all.concat(itemsFromEntity(entity, now));
    }
    if (unavailable && unavailable === ids.length) problems.push(l.t("unavailable"));

    // Release hidden items once the sensor reflects the change (or never will).
    const byKey = new Map(all.map((i) => [i.key, i]));
    for (const [key, h] of this._hidden) {
      const current = byKey.get(key);
      if (!current || current.signature !== h.signature || Date.now() - h.at > HIDE_FALLBACK_MS) {
        this._hidden.delete(key);
      }
    }

    const shown = all.filter((i) => !this._hidden.has(i.key));
    return { items: sortItems(filterItems(shown, config, hass), config), problems };
  }

  private _urgency(item: Item): Urgency {
    const b = bucketOf(item);
    if (b !== "upcoming") return b;
    return item.dueDays! < (this._config?.due_in_days_threshold ?? 7) ? "soon" : "later";
  }

  /* ------------------------------------------------------------ actions */

  private async _call(call: ServiceCall): Promise<boolean> {
    if (!this.hass) return false;
    try {
      await this.hass.callService(call.domain, call.service, call.data);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String((err as { message?: string })?.message ?? err);
      this._toast(this._l.t("failed", { error: message }));
      return false;
    }
  }

  private _refresh(entityId: string): void {
    // The Grocy coordinator refreshes on its own schedule; nudge it so the list settles quickly.
    this.hass
      ?.callService("homeassistant", "update_entity", { entity_id: entityId })
      .catch(() => undefined);
  }

  private _toast(message: string): void {
    this.dispatchEvent(
      new CustomEvent("hass-notification", { detail: { message }, bubbles: true, composed: true }),
    );
  }

  private _haptic(kind: "success" | "selection" | "failure" = "success"): void {
    this.dispatchEvent(new CustomEvent("haptic", { detail: kind, bubbles: true, composed: true }));
  }

  private _userId(): string {
    return resolveUserId(this._config!, this.hass);
  }

  private _onCheck(e: Event, item: Item): void {
    e.stopPropagation();
    const timer = this._pending.get(item.key);
    if (timer !== undefined) {
      clearTimeout(timer);
      this._pending.delete(item.key);
      this._pendingItems.delete(item.key);
      this._haptic("selection");
      this.requestUpdate();
      return;
    }
    this._haptic("success");
    const delay = Math.max(0, this._config?.undo_seconds ?? 3) * 1000;
    this._pendingItems.set(item.key, item);
    if (delay === 0) {
      this._commitTrack(item.key);
      return;
    }
    this._pending.set(
      item.key,
      setTimeout(() => this._commitTrack(item.key), delay),
    );
    this.requestUpdate();
  }

  private _commitTrack(key: string): void {
    const item = this._pendingItems.get(key);
    clearTimeout(this._pending.get(key));
    this._pending.delete(key);
    this._pendingItems.delete(key);
    if (!item) return;
    void this._finish(item, trackCall(item, this._userId(), this._config!));
  }

  /** Runs a call that removes the item from the list (track / skip), animating it out. */
  private async _finish(item: Item, call: ServiceCall): Promise<void> {
    this._leaving.add(item.key);
    if (this._expanded === item.key) this._expanded = null;
    this.requestUpdate();
    const [ok] = await Promise.all([
      this._call(call),
      new Promise((r) => setTimeout(r, LEAVE_MS)),
    ]);
    this._leaving.delete(item.key);
    if (ok) {
      this._hidden.set(item.key, { signature: item.signature, at: Date.now() });
      this._refresh(item.entityId);
    } else {
      this._haptic("failure");
    }
    this.requestUpdate();
  }

  private _onSkip(item: Item): void {
    void this._finish(item, skipCall(item, this._userId()));
  }

  private async _onReschedule(item: Item, value: string): Promise<void> {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!m) return;
    const date = new Date(+m[1], +m[2] - 1, +m[3]);
    this._expanded = null;
    if (await this._call(rescheduleCall(item, date))) {
      this._haptic("success");
      this._refresh(item.entityId);
    }
  }

  private async _onAssign(item: Item): Promise<void> {
    if (await this._call(assignCall(item, this._userId()))) {
      this._haptic("success");
      this._refresh(item.entityId);
    }
  }

  private async _onAddTask(e: SubmitEvent): Promise<void> {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const data = new FormData(form);
    const name = String(data.get("name") ?? "").trim();
    if (!name) return;
    const due = String(data.get("due") ?? "") || null;
    if (await this._call(createTaskCall(name, due, this._userId()))) {
      this._haptic("success");
      form.reset();
      this._adding = false;
      for (const id of entityIds(this._config!)) {
        if (this.hass?.states[id] && Array.isArray(this.hass.states[id].attributes.tasks)) this._refresh(id);
      }
    }
  }

  private _toggle(item: Item): void {
    if (this._config?.show_details === false) return;
    this._expanded = this._expanded === item.key ? null : item.key;
  }

  private _onRowKey(e: KeyboardEvent, item: Item): void {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      this._toggle(item);
    }
  }

  /* ------------------------------------------------------------- render */

  protected override render(): TemplateResult | typeof nothing {
    const config = this._config;
    if (!config || !this.hass) return nothing;
    const l = this._l;
    const { items, problems } = this._visible();
    const showEmpty = config.show_empty !== false;

    this.toggleAttribute("hidden", !items.length && !problems.length && !showEmpty && !this._adding);
    if (this.hasAttribute("hidden")) return nothing;

    const limit = config.show_quantity && config.show_quantity > 0 ? config.show_quantity : Infinity;
    const shown = this._showAll ? items : items.slice(0, limit);
    const overflow = items.length - Math.min(items.length, limit);
    const counts = countBuckets(items);

    return html`
      <ha-card class=${this._firstPaint ? "intro" : ""}>
        ${config.show_header === false ? nothing : this._renderHeader(items.length, counts)}
        ${this._adding ? this._renderAddForm() : nothing}
        ${problems.map((p) => html`<div class="problem" role="alert">${p}</div>`)}
        ${items.length
          ? html`<div class="list">${this._renderList(shown)}</div>`
          : problems.length
            ? nothing
            : this._renderEmpty()}
        ${overflow > 0
          ? html`<button class="overflow" @click=${() => (this._showAll = !this._showAll)} aria-expanded=${this._showAll}>
              <span>${this._showAll ? l.t("less") : l.t("more", { n: overflow })}</span>
              ${icon(mdiChevronDown, `icon chevron ${this._showAll ? "up" : ""}`)}
            </button>`
          : nothing}
      </ha-card>
    `;
  }

  private _renderHeader(total: number, counts: Record<Bucket, number>): TemplateResult {
    const config = this._config!;
    const l = this._l;
    const tally = (["overdue", "today", "upcoming", "anytime"] as Bucket[])
      .filter((b) => counts[b])
      .map((b) => html`<span class="tally-${b}"><b>${counts[b]}</b> ${l.t(b).toLowerCase()}</span>`);

    return html`
      <header>
        <div class="heading">
          <h1>${config.title ?? l.t("title")}</h1>
          ${total ? html`<div class="tally">${tally}</div>` : nothing}
        </div>
        ${config.show_create_task
          ? html`<button
              class="round ${this._adding ? "active" : ""}"
              @click=${() => (this._adding = !this._adding)}
              aria-label=${this._adding ? l.t("cancel") : l.t("add_task")}
              title=${this._adding ? l.t("cancel") : l.t("add_task")}
            >
              ${icon(this._adding ? mdiClose : mdiPlus)}
            </button>`
          : nothing}
      </header>
      ${config.show_summary_bar !== false && total
        ? html`<div class="pressure" role="img" aria-label=${tally.length ? `${total}` : ""}>
            ${(["overdue", "today", "upcoming", "anytime"] as Bucket[]).map((b) =>
              counts[b] ? html`<i class="seg-${b}" style="flex-grow:${counts[b]}"></i>` : nothing,
            )}
          </div>`
        : nothing}
    `;
  }

  private _renderAddForm(): TemplateResult {
    const l = this._l;
    return html`
      <form class="add" @submit=${this._onAddTask}>
        <input name="name" placeholder=${l.t("task_name")} aria-label=${l.t("task_name")} required autocomplete="off" />
        <input name="due" type="date" aria-label=${l.t("due_date")} />
        <button type="submit" class="pill solid">${icon(mdiPlus)}${l.t("add")}</button>
      </form>
    `;
  }

  private _renderList(items: Item[]): TemplateResult {
    const config = this._config!;
    const l = this._l;
    let index = 0;
    if (config.group_by_due === false) {
      return html`${repeat(items, (i) => i.key, (i) => this._renderRow(i, index++))}`;
    }
    return html`${repeat(
      groupItems(items),
      (g) => g.bucket,
      (g) => html`
        <section class="group group-${g.bucket}">
          <h2><span>${l.t(g.bucket)}</span><em>${g.items.length}</em></h2>
          ${repeat(g.items, (i) => i.key, (i) => this._renderRow(i, index++))}
        </section>
      `,
    )}`;
  }

  private _renderStub(item: Item): TemplateResult {
    const l = this._l;
    if (!item.due) {
      return html`<div class="stub" aria-hidden="true"><span class="mon">∞</span><span class="day">–</span></div>`;
    }
    return html`<div class="stub" aria-hidden="true">
      <span class="mon">${l.date(item.due, { month: "short" }).replace(".", "")}</span>
      <span class="day">${item.due.getDate()}</span>
    </div>`;
  }

  private _renderRow(item: Item, index: number): TemplateResult {
    const config = this._config!;
    const l = this._l;
    const pending = this._pending.has(item.key);
    const leaving = this._leaving.has(item.key);
    const open = this._expanded === item.key;
    const name = displayName(item, config);
    const undo = Math.max(0, config.undo_seconds ?? 3);
    const showTrack = config.show_track_button !== false;
    const detailsEnabled = config.show_details !== false;

    const meta: TemplateResult[] = [];
    if (config.show_due_date !== false) {
      meta.push(html`<span class="due">${l.dueLabel(item, config.due_in_days_threshold ?? 7)}</span>`);
    }
    if (config.show_assigned !== false && item.assignedName) {
      meta.push(html`<span class="who">
        <i class="avatar" style="--h:${hue(item.assignedName)}">${initials(item.assignedName)}</i>${item.assignedName}
      </span>`);
    }
    if (config.show_last_tracked !== false && item.kind === "chore" && item.lastTracked) {
      meta.push(html`<span class="last">${icon(mdiHistory)}${l.lastTrackedLabel(item)}${
        config.show_last_tracked_by !== false && item.lastTrackedBy ? ` · ${item.lastTrackedBy}` : ""
      }</span>`);
    }

    return html`
      <div
        class="row u-${this._urgency(item)} ${pending ? "pending" : ""} ${leaving ? "leaving" : ""} ${open ? "open" : ""}"
        style="--i:${Math.min(index, 12)}; --undo:${undo}s"
      >
        <div
          class="main ${detailsEnabled ? "clickable" : ""}"
          role=${detailsEnabled ? "button" : nothing}
          tabindex=${detailsEnabled ? 0 : nothing}
          aria-expanded=${detailsEnabled ? String(open) : nothing}
          @click=${() => this._toggle(item)}
          @keydown=${(e: KeyboardEvent) => this._onRowKey(e, item)}
        >
          ${this._renderStub(item)}
          <div class="body">
            <div class="name">
              <span class="label">${name}</span>
              ${item.kind === "task" ? html`<span class="kind">${l.t("task")}</span>` : nothing}
            </div>
            ${meta.length ? html`<div class="meta">${meta}</div>` : nothing}
            ${config.show_description && item.description
              ? html`<div class="desc">${item.description}</div>`
              : nothing}
          </div>
        </div>
        ${showTrack
          ? html`<button
              class="check"
              @click=${(e: Event) => this._onCheck(e, item)}
              aria-label=${pending ? l.t("undo") : l.t("track", { name })}
              title=${pending ? l.t("undo") : l.t("track", { name })}
              ?disabled=${leaving}
            >
              ${svg`<svg class="ring" viewBox="0 0 48 48" aria-hidden="true">
                <circle class="ring-bg" cx="24" cy="24" r="21"></circle>
                <circle class="ring-fg" cx="24" cy="24" r="21" pathLength="100"></circle>
              </svg>`}
              ${icon(pending ? mdiUndoVariant : mdiCheck, "icon glyph")}
            </button>`
          : nothing}
        ${open ? this._renderDetails(item) : nothing}
      </div>
    `;
  }

  private _renderDetails(item: Item): TemplateResult {
    const config = this._config!;
    const l = this._l;
    const me = this._userId();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const defaultDate = toDateString(item.due && item.dueDays! > 0 ? item.due : tomorrow);

    return html`
      <div class="details">
        ${!config.show_description && item.description ? html`<p class="desc">${item.description}</p>` : nothing}
        <dl>
          ${item.due
            ? html`<div><dt>${l.t("due")}</dt><dd>${l.date(item.due, {
                weekday: "long",
                month: "long",
                day: "numeric",
                ...(item.dueDateOnly ? {} : { hour: "numeric", minute: "2-digit" }),
              })}</dd></div>`
            : nothing}
          ${item.kind === "chore"
            ? html`<div><dt>${l.t("last_done")}</dt><dd>${l.lastTrackedLabel(item)}${
                item.lastTrackedBy ? ` ${l.t("by", { name: item.lastTrackedBy })}` : ""
              }</dd></div>`
            : nothing}
          <div><dt>${l.t("assigned")}</dt><dd>${item.assignedName ?? l.t("unassigned")}</dd></div>
        </dl>
        <div class="actions">
          ${item.kind === "chore" && config.show_skip !== false
            ? html`<button class="pill" @click=${() => this._onSkip(item)}>${icon(mdiSkipNext)}${l.t("skip")}</button>`
            : nothing}
          ${config.show_reschedule !== false
            ? html`<label class="pill date">
                ${icon(mdiCalendarArrowRight)}<span>${l.t("reschedule")}</span>
                <input
                  type="date"
                  .value=${defaultDate}
                  @change=${(e: Event) => this._onReschedule(item, (e.target as HTMLInputElement).value)}
                />
              </label>`
            : nothing}
          ${config.show_assign_to_me !== false && item.assignedId !== me
            ? html`<button class="pill" @click=${() => this._onAssign(item)}>
                ${icon(mdiAccountArrowLeftOutline)}${l.t("assign_to_me")}
              </button>`
            : nothing}
        </div>
      </div>
    `;
  }

  private _renderEmpty(): TemplateResult {
    const l = this._l;
    return html`<div class="empty">
      ${icon(mdiPartyPopper, "icon big")}
      <strong>${l.t("all_done")}</strong>
      <span>${l.t("all_done_sub")}</span>
    </div>`;
  }
}

if (!customElements.get(CARD)) {
  customElements.define(CARD, GrocyChoreCard);
}

declare global {
  interface Window {
    customCards?: Array<Record<string, unknown>>;
  }
}

window.customCards = window.customCards ?? [];
if (!window.customCards.some((c) => c.type === CARD)) {
  window.customCards.push({
    type: CARD,
    name: "Grocy Chore Card",
    description: "Track Grocy chores and tasks, and mark them done.",
    preview: true,
    documentationURL: "https://github.com/jcsumlin/grocy-card-ha",
  });
}

console.info(`%c GROCY-CHORE-CARD %c ${__VERSION__} `, "background:#1f3a2e;color:#f4ecd8;font-weight:700", "background:#f4ecd8;color:#1f3a2e");
