# GdMI-Demos

Interaktive Web-Demos zur Vorlesung **Grundlagen der Medieninformatik (GdMI)**. Sie ersetzen die alten Java-Applets und Flash-Animationen, auf die die Folien verlinkt haben und die heute nicht mehr laufen.

**Live:** https://felixkosmalla.github.io/gdmi-demos/

Jede Demo hat oben einen Vorlesungsbereich (große Plots, nur die wichtigsten Regler, Vollbild-Knopf) und darunter eine Erklärung, Aufgaben zum Ausprobieren und die Quelle der ursprünglichen Demo. Alle Einstellungen stehen in der URL, sodass eine Folie direkt auf einen bestimmten Zustand verlinken kann (z. B. `abtastung/?fs=150`).

## Lokal ausführen

Voraussetzung: aktuelle Node-LTS.

```sh
npm install
npm run dev      # Entwicklungsserver, http://localhost:5173/gdmi-demos/
npm test         # Tests (vitest)
npm run build    # Typprüfung + Build nach dist/
npm run preview  # den Build lokal ansehen
```

Jeder Push auf `main` baut die Seite und veröffentlicht sie über GitHub Pages (`.github/workflows/deploy.yml`).

## Neue Demo hinzufügen

1. `demos/_template/` nach `demos/<slug>/` kopieren. Die Demo ist dann unter `/gdmi-demos/<slug>/` erreichbar (nicht unter `/demos/<slug>/`).
2. In `src/demos.ts` einen Eintrag ergänzen (Titel, Deck, Folie, ersetzte Demo). Das Feld `replaces` erscheint in der Demo als Zeile „Idee nach: …“ (`ideaCredit()`, siehe Vorlage). Sobald `ready: true` gesetzt ist, erscheint sie auf der Startseite.
3. Auf der Folie den alten Link durch die neue URL ersetzen und die Tabelle unten ergänzen.

Gemeinsame Bausteine liegen in `src/lib/` (Plots, URL-gebundene Regler, DSP, Audio, Layout). Für größere Vorhaben gibt es in [`planning/`](planning/) je eine Aufgabendatei pro Demo. [`planning/README.md`](planning/README.md) beschreibt Format, Seitendesign und Tech-Stack.

## Folien → Demos

| Deck | Folie | Titel | Neue Demo | Ersetzt | Status |
|------|-------|-------|-----------|---------|--------|
| d07 | 26 | Beispiel zum Abtasttheorem | [`/gdmi-demos/abtastung/?fs=150`](https://felixkosmalla.github.io/gdmi-demos/abtastung/?fs=150) | UH Glover Sampling-Applet | online |
| d07 | 27–28 | Aliasing / Audio-Aliasing | [`/gdmi-demos/audio-aliasing/`](https://felixkosmalla.github.io/gdmi-demos/audio-aliasing/) | Berkeley EECS20 Aliasing | online |
| d08 | 7 | Summieren von Schwingungen | [`/gdmi-demos/zeiger/`](https://felixkosmalla.github.io/gdmi-demos/zeiger/) | schulphysikwiki / JHU Phasoren | online |
| d09 | 9 | Beispiel: Rechteckfunktion | [`/gdmi-demos/fourier-reihe/?sig=rechteck`](https://felixkosmalla.github.io/gdmi-demos/fourier-reihe/?sig=rechteck) | JHU Fourier Series Applet | in Arbeit |
| d09 | 13 | Frequenzraum bei Bilddaten | [`/gdmi-demos/scanline-spektrum/`](https://felixkosmalla.github.io/gdmi-demos/scanline-spektrum/) | Brown 1D FFT Applet | in Arbeit |

Links mit Status „in Arbeit“ funktionieren erst, wenn die Demo fertig ist.

## Quellen der ursprünglichen Demos

Die Demos bauen die Lehridee dieser Originale nach, nicht deren Oberfläche:

- „An Introduction to Sampling Theory“, T. Zawistowski, P. Shah, University of Houston
- EECS20 „Aliasing“-Applet, E. A. Lee, P. Varaiya, UC Berkeley
- „Überlagerung von harmonischen Schwingungen“, schulphysikwiki; „Harmonic Phasors and Fourier Series“, W. J. Rugh, Johns Hopkins University
- „Fourier Series Approximation“, S. Crutchfield, H. C. Lee, Johns Hopkins University
- „1D Fast Fourier Transform“, A. van Dam, D. L. Gould, Brown University Exploratories

## Lizenz

Der Code steht unter der [MIT-Lizenz](LICENSE). Bilder und andere Medien in den Demo-Ordnern haben eigene Lizenzen, die jeweils in einer `LICENSE.md` neben der Datei stehen.
