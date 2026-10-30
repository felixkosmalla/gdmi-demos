# 07 – Publish to GitHub Pages

## Goal

Put the repository on GitHub and serve the site via GitHub Pages, so the slides can link to stable URLs. Also write the root README that explains the project, how to add a demo, and which slide links to which demo.

## Depends on

01 (the workflow file and build exist). Can be done right after 01 with only the landing page, and simply repeated (push) as demos become ready.

## ⚠️ Before you start

This task **publishes the repository publicly**. Confirm with the user in the session before creating the repo and pushing. Double-check that `slides/` is ignored and that nothing private is committed (`git status`, `git ls-files`).

## Steps

1. **Root `README.md`** (German or English; German fits the audience):
   - What this is (GdMI interactive demos, replacing old Java applets) and the live URL.
   - Run locally: `npm install`, `npm run dev`, `npm test`, `npm run build`.
   - **"Neue Demo hinzufügen":** copy `demos/_template/` to `demos/<slug>/`, add an entry in `src/demos.ts`, link it from the slide. Point to `planning/` for the task format.
   - **Table slide → demo URL** with all demos (deck, slide no., slide title, new URL incl. recommended query params, old link replaced). Initial rows:

     | Deck | Folie | Titel | Neue Demo | Ersetzt |
     |------|-------|-------|-----------|---------|
     | d07 | 26 | Beispiel zum Abtasttheorem | `/gdmi-demos/abtastung/?fs=150` | UH Glover Sampling-Applet |
     | d07 | 27–28 | Aliasing / Audio-Aliasing | `/gdmi-demos/audio-aliasing/` | Berkeley EECS20 Aliasing |
     | d08 | 7 | Summieren von Schwingungen | `/gdmi-demos/zeiger/` | schulphysikwiki / JHU Phasoren |
     | d09 | 9 | Beispiel: Rechteckfunktion | `/gdmi-demos/fourier-reihe/?sig=rechteck` | JHU Fourier Series Applet |
     | d09 | 13 | Frequenzraum bei Bilddaten | `/gdmi-demos/scanline-spektrum/` | Brown 1D FFT Applet |

   - Credits for the original demos.
   - License for the code (ask the user; MIT is a sensible default). The CC0 photo license stays as noted in its folder.
2. **Commit** everything (`slides/` excluded).
3. **Create the repo:** `gh repo create gdmi-demos --public --source . --push` on the user's personal account (check `gh auth status` first).
4. **Enable Pages** with source "GitHub Actions": in the repo settings, or `gh api -X POST repos/{owner}/gdmi-demos/pages -f build_type=workflow`.
5. Wait for the `deploy` workflow and check it.

## Acceptance criteria

- `git ls-files` contains nothing under `slides/`.
- The deploy workflow run is green.
- `https://<user>.github.io/gdmi-demos/` shows the landing page. Every demo marked `ready` loads at `/<slug>/` with working assets (no 404s in the network tab, which would point to a wrong `base`).
- The README table's URLs work.

## Notes / open points

- If the repo name or account changes, update `base` in `vite.config.ts` and the README URLs.
- A custom domain (e.g. a university subdomain) is possible later via a `CNAME` file. Not planned now.

### Result (session 07, done)

- Repo: https://github.com/felixkosmalla/gdmi-demos (public), live at https://felixkosmalla.github.io/gdmi-demos/. Code license MIT (`LICENSE`, `package.json`).
- Pages source is "GitHub Actions". The first deploy run failed at `configure-pages` because it ran before Pages was enabled; a rerun was green. From now on, every push to `main` deploys.
- The README slide table has a "Status" column. When a demo becomes `ready`, switch its row from "in Arbeit" to "online" in the same commit.
