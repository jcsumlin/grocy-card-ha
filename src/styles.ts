import { css } from "lit";

/*
 * Visual language: a household ledger of tear-off calendar stubs.
 * Every colour derives from the active Home Assistant theme, so the card sits
 * naturally in light, dark and custom themes. Override any --grocy-* variable
 * from a theme or card-mod to retune it.
 */
export const styles = css`
  :host {
    --gc-overdue: var(--grocy-overdue-color, var(--error-color, #d9443a));
    --gc-today: var(--grocy-today-color, var(--warning-color, #e8a10c));
    --gc-soon: var(--grocy-soon-color, var(--primary-color, #2f7bd8));
    --gc-later: var(--grocy-later-color, var(--secondary-text-color, #727272));
    --gc-done: var(--grocy-done-color, var(--success-color, #3c9a5f));
    --gc-text: var(--primary-text-color, #1c1c1c);
    --gc-muted: var(--secondary-text-color, #727272);
    --gc-line: var(--divider-color, rgba(127, 127, 127, 0.22));
    --gc-surface: var(--ha-card-background, var(--card-background-color, #fff));
    --gc-font: var(--grocy-font-family, inherit);
    --gc-ease: cubic-bezier(0.2, 0.75, 0.2, 1);
    display: block;
  }
  :host([hidden]) {
    display: none;
  }

  ha-card {
    font-family: var(--gc-font);
    color: var(--gc-text);
    overflow: hidden;
    container-type: inline-size;
    padding-bottom: 6px;
  }

  .icon {
    width: 1em;
    height: 1em;
    fill: currentColor;
    flex: none;
  }

  button {
    font: inherit;
    color: inherit;
    -webkit-tap-highlight-color: transparent;
  }
  button:focus-visible,
  .main:focus-visible,
  input:focus-visible {
    outline: 2px solid var(--gc-soon);
    outline-offset: 2px;
  }

  /* ---------------------------------------------------------- header */

  header {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 18px 16px 10px;
  }
  .heading {
    flex: 1;
    min-width: 0;
  }
  h1 {
    margin: 0;
    font-size: 1.375rem;
    font-weight: 650;
    letter-spacing: -0.02em;
    line-height: 1.15;
  }
  .tally {
    display: flex;
    flex-wrap: wrap;
    gap: 2px 12px;
    margin-top: 4px;
    font-size: 0.78rem;
    color: var(--gc-muted);
  }
  .tally b {
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    color: var(--gc-text);
  }
  .tally-overdue b {
    color: var(--gc-overdue);
  }
  .tally-today b {
    color: var(--gc-today);
  }

  .round {
    width: 36px;
    height: 36px;
    flex: none;
    display: grid;
    place-items: center;
    border-radius: 50%;
    border: 1px solid var(--gc-line);
    background: transparent;
    cursor: pointer;
    font-size: 20px;
    transition: transform 0.25s var(--gc-ease), background 0.2s;
  }
  .round.active {
    background: color-mix(in srgb, var(--gc-text) 8%, transparent);
    transform: rotate(90deg);
  }

  /* The urgency bar: a glanceable split of what's late, due and coming. */
  .pressure {
    display: flex;
    gap: 3px;
    height: 6px;
    margin: 2px 16px 8px;
  }
  .pressure i {
    flex-basis: 0;
    min-width: 6px;
    border-radius: 3px;
    transform-origin: left;
  }
  .seg-overdue {
    background: repeating-linear-gradient(
      -45deg,
      var(--gc-overdue) 0 4px,
      color-mix(in srgb, var(--gc-overdue) 65%, var(--gc-surface)) 4px 7px
    );
  }
  .seg-today {
    background: var(--gc-today);
  }
  .seg-upcoming {
    background: color-mix(in srgb, var(--gc-soon) 70%, var(--gc-surface));
  }
  .seg-anytime {
    background: var(--gc-line);
  }

  /* ----------------------------------------------------- add task form */

  .add {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 0 16px 12px;
    animation: reveal 0.28s var(--gc-ease) both;
  }
  .add input {
    height: 38px;
    box-sizing: border-box;
    border: 1px solid var(--gc-line);
    border-radius: 10px;
    padding: 0 12px;
    background: color-mix(in srgb, var(--gc-text) 3%, transparent);
    color: var(--gc-text);
    font: inherit;
    font-size: 0.9rem;
  }
  .add input[name="name"] {
    flex: 1 1 160px;
    min-width: 0;
  }
  .add .pill {
    height: 38px;
  }

  /* ---------------------------------------------------------- groups */

  .group + .group {
    margin-top: 4px;
  }
  h2 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 8px 16px 2px;
    font-size: 0.68rem;
    font-weight: 750;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--gc-muted);
  }
  h2::after {
    content: "";
    flex: 1;
    height: 1px;
    background: var(--gc-line);
  }
  h2 em {
    font-style: normal;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0;
    opacity: 0.75;
    order: 2;
  }
  .group-overdue h2 {
    color: var(--gc-overdue);
  }
  .group-today h2 {
    color: color-mix(in srgb, var(--gc-today) 80%, var(--gc-text));
  }

  /* ------------------------------------------------------------- rows */

  .row {
    --u: var(--gc-later);
    --u-ink: var(--gc-text);
    --u-band: color-mix(in srgb, var(--u) 28%, var(--gc-surface));
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    column-gap: 4px;
    padding: 0 10px 0 12px;
    max-height: 480px;
  }
  .u-overdue {
    --u: var(--gc-overdue);
    --u-ink: #fff;
    --u-band: var(--u);
  }
  .u-today {
    --u: var(--gc-today);
    --u-ink: rgba(0, 0, 0, 0.82);
    --u-band: var(--u);
  }
  .u-soon {
    --u: var(--gc-soon);
    --u-ink: var(--text-primary-color, #fff);
    --u-band: var(--u);
  }

  .main {
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr);
    gap: 12px;
    align-items: center;
    padding: 7px 4px;
    border-radius: 12px;
    transition: background 0.2s, opacity 0.25s;
  }
  .main.clickable {
    cursor: pointer;
  }
  @media (hover: hover) {
    .main.clickable:hover {
      background: color-mix(in srgb, var(--gc-text) 4%, transparent);
    }
  }
  .open .main {
    background: color-mix(in srgb, var(--gc-text) 4%, transparent);
  }

  /* Tear-off calendar stub */
  .stub {
    display: flex;
    flex-direction: column;
    height: 48px;
    border-radius: 9px;
    overflow: hidden;
    text-align: center;
    background: color-mix(in srgb, var(--u) 9%, var(--gc-surface));
    box-shadow:
      inset 0 0 0 1px color-mix(in srgb, var(--u) 30%, transparent),
      0 1px 0 color-mix(in srgb, var(--u) 22%, transparent);
  }
  .stub .mon {
    position: relative;
    padding: 2px 0 3px;
    font-size: 0.59rem;
    font-weight: 800;
    letter-spacing: 0.1em;
    line-height: 11px;
    text-transform: uppercase;
    background: var(--u-band);
    color: var(--u-ink);
  }
  /* perforation */
  .stub .mon::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    bottom: -1.5px;
    height: 3px;
    background: radial-gradient(circle, var(--gc-surface) 1.1px, transparent 1.5px) 1px 0 / 5px 3px
      repeat-x;
  }
  .stub .day {
    flex: 1;
    display: grid;
    place-items: center;
    font-size: 1.2rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.03em;
    color: color-mix(in srgb, var(--u) 70%, var(--gc-text));
  }
  .u-anytime .stub {
    background: transparent;
    box-shadow: inset 0 0 0 1px var(--gc-line);
    outline: 1px dashed var(--gc-line);
    outline-offset: -4px;
  }
  .u-anytime .stub .mon {
    background: transparent;
    color: var(--gc-muted);
    font-size: 0.8rem;
    letter-spacing: 0;
  }
  .u-anytime .stub .mon::after {
    display: none;
  }
  .u-anytime .stub .day {
    color: var(--gc-muted);
  }

  .body {
    min-width: 0;
  }
  .name {
    font-size: 0.95rem;
    font-weight: 560;
    line-height: 1.3;
    overflow-wrap: anywhere;
  }
  .label {
    background: linear-gradient(currentColor, currentColor) no-repeat 0 58% / 0% 1.5px;
    transition:
      background-size 0.3s var(--gc-ease),
      color 0.3s;
  }
  .kind {
    display: inline-block;
    margin-left: 6px;
    padding: 0 6px;
    border: 1px solid var(--gc-line);
    border-radius: 99px;
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    line-height: 15px;
    text-transform: uppercase;
    vertical-align: 2px;
    color: var(--gc-muted);
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 2px 12px;
    margin-top: 3px;
    font-size: 0.78rem;
    color: var(--gc-muted);
  }
  .meta > span {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
  }
  .u-overdue .due,
  .u-today .due {
    color: color-mix(in srgb, var(--u) 85%, var(--gc-text));
    font-weight: 650;
  }
  .avatar {
    display: inline-grid;
    place-items: center;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: hsl(var(--h) 42% 46%);
    color: #fff;
    font-size: 0.5rem;
    font-style: normal;
    font-weight: 750;
    letter-spacing: 0.02em;
  }
  .desc {
    margin: 4px 0 0;
    font-size: 0.8rem;
    line-height: 1.4;
    color: var(--gc-muted);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* ------------------------------------------------------ check button */

  .check {
    position: relative;
    width: 48px;
    height: 48px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: color-mix(in srgb, var(--u) 80%, var(--gc-text));
    cursor: pointer;
    transition: transform 0.15s var(--gc-ease);
  }
  .check:active {
    transform: scale(0.9);
  }
  .ring {
    position: absolute;
    inset: 4px;
    width: 40px;
    height: 40px;
    overflow: visible;
  }
  .ring-bg {
    fill: color-mix(in srgb, var(--u) 7%, transparent);
    stroke: color-mix(in srgb, var(--u) 55%, transparent);
    stroke-width: 2;
    transition:
      fill 0.25s,
      stroke 0.25s;
  }
  .ring-fg {
    fill: none;
    stroke: var(--gc-done);
    stroke-width: 3.5;
    stroke-linecap: round;
    stroke-dasharray: 100;
    stroke-dashoffset: 100;
    opacity: 0;
    transform: rotate(-90deg);
    transform-origin: center;
  }
  .glyph {
    position: absolute;
    inset: 0;
    margin: auto;
    width: 22px;
    height: 22px;
    opacity: 0.3;
    transition:
      opacity 0.2s,
      transform 0.3s var(--gc-ease);
  }
  @media (hover: hover) {
    .check:hover .glyph {
      opacity: 1;
    }
    .check:hover .ring-bg {
      fill: color-mix(in srgb, var(--u) 15%, transparent);
    }
  }

  /* Pending: the ring fills over the undo window; tap again to cancel. */
  .pending .check {
    color: var(--gc-done);
  }
  .pending .ring-bg {
    fill: color-mix(in srgb, var(--gc-done) 12%, transparent);
    stroke: color-mix(in srgb, var(--gc-done) 30%, transparent);
  }
  .pending .ring-fg {
    opacity: 1;
    animation: fill-ring var(--undo) linear forwards;
  }
  .pending .glyph {
    opacity: 1;
    transform: rotate(-20deg) scale(0.9);
  }
  .pending .label,
  .leaving .label {
    background-size: 100% 1.5px;
    color: var(--gc-muted);
  }
  .pending .main {
    opacity: 0.6;
  }

  /* Leaving: stamp it done, then fold the row away. */
  .leaving {
    animation: leave 0.42s var(--gc-ease) forwards;
    pointer-events: none;
  }
  .leaving .ring-bg {
    fill: var(--gc-done);
    stroke: var(--gc-done);
  }
  .leaving .glyph {
    opacity: 1;
    color: #fff;
    animation: stamp 0.3s var(--gc-ease);
  }

  /* --------------------------------------------------------- details */

  .details {
    grid-column: 1 / -1;
    padding: 6px 4px 12px 60px;
    animation: reveal 0.25s var(--gc-ease) both;
  }
  .details > .desc {
    -webkit-line-clamp: unset;
    margin: 0 0 10px;
    white-space: pre-line;
  }
  dl {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 20px;
    margin: 0;
  }
  dt {
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--gc-muted);
  }
  dd {
    margin: 1px 0 0;
    font-size: 0.82rem;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
  }
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 32px;
    box-sizing: border-box;
    padding: 0 12px;
    border: 1px solid var(--gc-line);
    border-radius: 99px;
    background: transparent;
    font-size: 0.8rem;
    font-weight: 560;
    cursor: pointer;
    white-space: nowrap;
    transition:
      border-color 0.2s,
      background 0.2s;
  }
  .pill .icon {
    font-size: 16px;
    color: var(--gc-muted);
  }
  @media (hover: hover) {
    .pill:hover {
      border-color: color-mix(in srgb, var(--gc-soon) 60%, transparent);
      background: color-mix(in srgb, var(--gc-soon) 7%, transparent);
    }
  }
  .pill.solid {
    border-color: transparent;
    background: var(--gc-soon);
    color: var(--text-primary-color, #fff);
  }
  .pill.solid .icon {
    color: inherit;
  }
  .pill.date input {
    border: none;
    background: transparent;
    color: var(--gc-text);
    font: inherit;
    padding: 0;
    min-width: 0;
    cursor: pointer;
  }

  /* ------------------------------------------------- overflow & states */

  .overflow {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: calc(100% - 32px);
    height: 34px;
    margin: 6px 16px 10px;
    border: 1px dashed var(--gc-line);
    border-radius: 10px;
    background: transparent;
    color: var(--gc-muted);
    font-size: 0.8rem;
    font-weight: 650;
    cursor: pointer;
  }
  @media (hover: hover) {
    .overflow:hover {
      color: var(--gc-text);
      border-style: solid;
    }
  }
  .chevron {
    font-size: 18px;
    transition: transform 0.25s var(--gc-ease);
  }
  .chevron.up {
    transform: rotate(180deg);
  }

  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 18px 16px 26px;
    text-align: center;
  }
  .empty .big {
    font-size: 40px;
    color: var(--gc-done);
    margin-bottom: 6px;
    animation: stamp 0.5s var(--gc-ease) both;
  }
  .empty strong {
    font-size: 1rem;
    font-weight: 650;
  }
  .empty span {
    font-size: 0.82rem;
    color: var(--gc-muted);
  }

  .problem {
    margin: 0 16px 12px;
    padding: 10px 12px;
    border-left: 3px solid var(--gc-overdue);
    border-radius: 4px 10px 10px 4px;
    background: color-mix(in srgb, var(--gc-overdue) 10%, transparent);
    font-size: 0.85rem;
  }

  @container (max-width: 340px) {
    .details {
      padding-left: 4px;
    }
    .add .pill {
      flex: 1;
      justify-content: center;
    }
  }

  /* -------------------------------------------------------- motion */

  .intro .row {
    animation: rise 0.5s var(--gc-ease) both;
    animation-delay: calc(var(--i) * 40ms + 80ms);
  }
  .intro .pressure i {
    animation: grow 0.7s var(--gc-ease) both;
  }
  .intro .pressure i:nth-child(2) {
    animation-delay: 60ms;
  }
  .intro .pressure i:nth-child(3) {
    animation-delay: 120ms;
  }
  .intro .pressure i:nth-child(4) {
    animation-delay: 180ms;
  }

  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
  }
  @keyframes grow {
    from {
      transform: scaleX(0);
    }
  }
  @keyframes reveal {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
  }
  @keyframes fill-ring {
    to {
      stroke-dashoffset: 0;
    }
  }
  @keyframes stamp {
    0% {
      transform: scale(0.4);
    }
    60% {
      transform: scale(1.15);
    }
  }
  @keyframes leave {
    0%,
    35% {
      opacity: 1;
      transform: none;
      max-height: 120px;
    }
    100% {
      opacity: 0;
      transform: translateX(16px);
      max-height: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 1ms !important;
      animation-delay: 0ms !important;
      transition-duration: 1ms !important;
    }
  }
`;
