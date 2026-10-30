import { describe, expect, it } from 'vitest';
import type { DemoInfo } from './demos';
import { renderDemoList } from './landing';

const base: DemoInfo = {
  slug: 'a',
  title: 'A',
  description: 'Beschreibung',
  deck: 'd07',
  slides: 'Folie 1',
  replaces: 'x',
  ready: true,
};
const decks = { d07: 'd07 – Sieben', d08: 'd08 – Acht' };

describe('renderDemoList', () => {
  it('lists only ready demos, grouped by deck in deck order', () => {
    const html = renderDemoList(decks, [
      { ...base, slug: 'b', title: 'B', deck: 'd08' },
      { ...base, slug: 'a', title: 'A' },
      { ...base, slug: 'hidden', title: 'Hidden', ready: false },
    ]);
    expect(html).toContain('href="./a/"');
    expect(html).toContain('href="./b/"');
    expect(html).not.toContain('hidden');
    expect(html.indexOf('d07 – Sieben')).toBeLessThan(html.indexOf('d08 – Acht'));
    expect(html).toContain('Folie 1');
  });

  it('escapes HTML and shows a note when nothing is ready', () => {
    expect(renderDemoList(decks, [{ ...base, title: '<b>&' }])).toContain('&#60;b&#62;&#38;');
    expect(renderDemoList(decks, [{ ...base, ready: false }])).toContain('in Arbeit');
  });
});
