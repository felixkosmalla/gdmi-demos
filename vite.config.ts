import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import { decks, demos } from './src/demos.ts';
import { renderDemoList } from './src/landing.ts';

/** Must match the GitHub repository name (Pages URL https://<user>.github.io/gdmi-demos/). */
const BASE = '/gdmi-demos/';
const root = fileURLToPath(new URL('.', import.meta.url));
const demosDir = resolve(root, 'demos');
const RESERVED = new Set(['assets', 'src', 'demos', 'node_modules', 'public']);

/** Folders demos/<slug>/ that contain an index.html. Folders starting with "_" (the template) are skipped. */
function demoSlugs(): string[] {
  if (!existsSync(demosDir)) return [];
  return readdirSync(demosDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('_') && existsSync(resolve(demosDir, d.name, 'index.html')))
    .map((d) => {
      if (RESERVED.has(d.name)) throw new Error(`Demo folder name "${d.name}" is reserved`);
      return d.name;
    });
}

/**
 * - Fills the landing page's demo list from src/demos.ts.
 * - Serves demos/<slug>/ at <base><slug>/ (short, stable URLs for the slides):
 *   in dev via a URL rewrite, in the build by moving the emitted HTML files.
 *   This works because asset URLs in the HTML are absolute (base starts with "/").
 */
function gdmiPages(): Plugin {
  return {
    name: 'gdmi-pages',
    enforce: 'post',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        if (resolve(ctx.filename) !== resolve(root, 'index.html')) return html;
        return html.replace('<!-- demo-list -->', renderDemoList(decks, demos));
      },
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const m = /^([^?#]*)(.*)$/.exec(req.url ?? '');
        const path = m?.[1] ?? '';
        const query = m?.[2] ?? '';
        if (!path.startsWith(BASE)) return next();
        const [slug, ...rest] = path.slice(BASE.length).split('/');
        if (!slug || slug.startsWith('_') || RESERVED.has(slug) || !existsSync(resolve(demosDir, slug, 'index.html'))) {
          return next();
        }
        if (rest.length === 0) {
          res.statusCode = 301;
          res.setHeader('Location', `${BASE}${slug}/${query}`);
          res.end();
          return;
        }
        req.url = `${BASE}demos/${slug}/${rest.join('/')}${query}`;
        next();
      });
    },
    generateBundle(_options, bundle) {
      for (const [fileName, chunk] of Object.entries(bundle)) {
        const m = /^demos\/([^/]+)\/index\.html$/.exec(fileName);
        if (!m || chunk.type !== 'asset') continue;
        delete bundle[fileName];
        this.emitFile({ type: 'asset', fileName: `${m[1]}/index.html`, source: chunk.source });
      }
    },
  };
}

export default defineConfig({
  base: BASE,
  // multi-page app: unknown URLs give 404 in dev (like GitHub Pages) instead of the landing page
  appType: 'mpa',
  plugins: [gdmiPages()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(root, 'index.html'),
        ...Object.fromEntries(demoSlugs().map((slug) => [slug, resolve(demosDir, slug, 'index.html')])),
      },
    },
  },
});
