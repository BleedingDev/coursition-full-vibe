/**
 * Repair slide separators before Slidev reads the deck.
 *
 * Markdown formatters in this workspace insert a blank line between a slide
 * separator and the frontmatter block that follows it. Slidev then stops
 * treating the block as frontmatter, so every separator turns into an extra
 * empty slide. Normalising here keeps `slides.md` safe to reformat.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const FRONTMATTER_KEYS = ['theme', 'layout', 'kicker', 'title', 'lead', 'source', 'class'];

const file = join(import.meta.dirname, '..', 'slides.md');
const before = readFileSync(file, 'utf-8');
const after = before.replaceAll(
  new RegExp(`\\n---\\n\\n+(?=(?:${FRONTMATTER_KEYS.join('|')}):)`, 'g'),
  '\n---\n',
);

if (after !== before) {
  writeFileSync(file, after);
  console.log('normalize-slides: repaired slide separators');
}
