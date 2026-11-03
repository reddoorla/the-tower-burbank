import type { Page } from "@playwright/test";

// Narrow excuse for one console error class on the dev-fixture gates only.
//
// Svelte 5 (5.57.3, node_modules/svelte/src/compiler/phases/3-transform/server/
// visitors/shared/element.js:289) emits `onload="this.__e=event"` and
// `onerror="this.__e=event"` on every SSR <img> that captures load events, so
// the production CSP logs "Executing inline event handler violates ..." for
// each one (it blocks inline handlers; hashes do not cover them). Svelte's
// replay of pre-hydration image events is blocked as a result. Follow-up issue:
// filed by the operator (CSP vs. Svelte image replay on catalog-rendered routes).
//
// The excuse applies only when, after hydration, every element's on* attributes
// are exactly that replay handler. Any other inline handler, on any element,
// means the errors count. Blocked scripts ("Loading the script ... violates")
// never match the prefix and are never excused.
export const CSP_INLINE_PREFIX =
  "Executing inline event handler violates the following Content Security Policy";

export async function onlySvelteImageReplayHandlers(page: Page): Promise<boolean> {
  return page.evaluate(() =>
    [...document.querySelectorAll("*")].every((el) =>
      [...el.attributes].every(
        (a) =>
          !a.name.startsWith("on") ||
          ((a.name === "onload" || a.name === "onerror") && a.value === "this.__e=event"),
      ),
    ),
  );
}

// `errors` entries are "[console.error] <text>..." or "[pageerror] ..." lines.
export function uncoveredErrors(errors: string[], replayOnly: boolean): string[] {
  if (!replayOnly) return errors;
  return errors.filter((e) => !e.startsWith(`[console.error] ${CSP_INLINE_PREFIX}`));
}
