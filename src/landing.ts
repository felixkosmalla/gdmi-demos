/**
 * Renders the demo list of the landing page as static HTML. Called at build
 * and dev time by the `gdmi-pages` plugin in vite.config.ts, which replaces the
 * `<!-- demo-list -->` marker in index.html, so the landing page needs no JS.
 * Pure function without DOM access (unit-tested in landing.test.ts).
 */
import type { DemoInfo } from './demos.ts';

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** HTML for all ready demos, grouped by deck (in the order of `decks`). Links are relative (`./<slug>/`). */
export function renderDemoList(decks: Record<string, string>, demos: readonly DemoInfo[]): string {
  const ready = demos.filter((d) => d.ready);
  if (ready.length === 0) {
    return '<p class="empty">Die Demos sind in Arbeit und erscheinen hier, sobald sie fertig sind.</p>';
  }
  const deckIds = [...Object.keys(decks), ...new Set(ready.map((d) => d.deck).filter((id) => !(id in decks)))];
  const sections: string[] = [];
  for (const id of deckIds) {
    const list = ready.filter((d) => d.deck === id);
    if (list.length === 0) continue;
    const cards = list
      .map(
        (d) => `      <li>
        <a class="card" href="./${encodeURIComponent(d.slug)}/">
          <h3>${esc(d.title)}</h3>
          <p>${esc(d.description)}</p>
          <p class="meta">${esc(id)}, ${esc(d.slides)}</p>
        </a>
      </li>`,
      )
      .join('\n');
    sections.push(`<section class="deck" aria-labelledby="deck-${esc(id)}">
    <h2 id="deck-${esc(id)}">${esc(decks[id] ?? id)}</h2>
    <ul class="cards">
${cards}
    </ul>
  </section>`);
  }
  return sections.join('\n  ');
}
