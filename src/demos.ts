/**
 * Registry of all demos. The landing page is generated from this list at
 * build time (see src/landing.ts and vite.config.ts). Adding a demo = copy
 * demos/_template/ to demos/<slug>/ and add one entry here.
 */

export interface DemoInfo {
  /** Folder name under demos/; the demo is served at /gdmi-demos/<slug>/. */
  slug: string;
  /** German title. */
  title: string;
  /** One line, German. */
  description: string;
  /** Deck id, a key of `decks`, e.g. 'd07'. */
  deck: string;
  /** e.g. 'Folie 27–28'. */
  slides: string;
  /** Credit for the original demo this one replaces. */
  replaces: string;
  /** Only ready demos are listed on the landing page. */
  ready: boolean;
}

/** Deck ids → German deck titles, in display order. */
export const decks: Record<string, string> = {
  d07: 'd07 – Digitale Codierung, Digitalisierung',
  d08: 'd08 – Signalverarbeitung: Grundbegriffe',
  d09: 'd09 – Frequenzspektren, Fourier-Transformation',
};

export const demos: DemoInfo[] = [
  {
    slug: 'abtastung',
    title: 'Abtastung & Rekonstruktion',
    description: 'Ein Signal aus 28, 84 und 140 Hz abtasten: Rekonstruktion, Spektrum und Alias-Frequenzen.',
    deck: 'd07',
    slides: 'Folie 26',
    replaces: '„An Introduction to Sampling Theory“ (T. Zawistowski, P. Shah, University of Houston)',
    ready: true,
  },
  {
    slug: 'audio-aliasing',
    title: 'Aliasing hören',
    description: 'Ein Sinus bei 8 kHz Abtastrate: Über 4 kHz sinkt die hörbare Frequenz wieder.',
    deck: 'd07',
    slides: 'Folie 27–28',
    replaces: 'EECS20 „Aliasing“-Applet (E. A. Lee, P. Varaiya, UC Berkeley)',
    ready: true,
  },
  {
    slug: 'zeiger',
    title: 'Schwingungen als Zeiger addieren',
    description: 'Drehende Zeiger aneinanderhängen: gleiche Frequenz, Oberschwingung und Schwebung.',
    deck: 'd08',
    slides: 'Folie 7',
    replaces: 'schulphysikwiki „Überlagerung von harmonischen Schwingungen“; „Harmonic Phasors and Fourier Series“ (W. J. Rugh, Johns Hopkins University)',
    ready: false,
  },
  {
    slug: 'fourier-reihe',
    title: 'Fourier-Reihe: Annäherung & Spektrum',
    description: 'Rechteck, Dreieck, Sägezahn oder eine eigene Zeichnung durch Harmonische annähern – mit Betrags- und Phasenspektrum.',
    deck: 'd09',
    slides: 'Folie 9',
    replaces: '„Fourier Series Approximation“ (S. Crutchfield, H. C. Lee, Johns Hopkins University)',
    ready: false,
  },
  {
    slug: 'scanline-spektrum',
    title: 'Frequenzraum bei Bilddaten',
    description: 'Helligkeitsverlauf entlang einer Bildzeile und sein Frequenzspektrum.',
    deck: 'd09',
    slides: 'Folie 13',
    replaces: '„1D Fast Fourier Transform“ (A. van Dam, D. L. Gould, Brown University Exploratories)',
    ready: false,
  },
];
