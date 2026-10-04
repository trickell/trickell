// Builds the static neon signs for the profile README:
//   - assets/neon-header.svg : name + tagline marquee
//   - assets/neon-about.svg  : "About Me" terminal panel
// Edit the text below and re-run `node .github/scripts/signs.mjs`.

import { writeFile, mkdir } from 'node:fs/promises';
import { C, esc, flicker, inlineFont, glowFilter, panel, svg } from './neon.mjs';

const MONO = "'Share Tech Mono',ui-monospace,SFMono-Regular,Menlo,monospace";
const DISPLAY = "'Orbitron','Share Tech Mono',ui-monospace,monospace";

// ---------------------------------------------------------------- header

const HEADER = {
  status: 'SYS://TRICKELL · ONLINE',
  name: 'JOHN A MADRIGAL',
  tagline: '// CURIOUS & ADAPTIVE CODER WITH AN EYE FOR ART //',
  tags: ['DESIGNER', 'ENGINEER', 'ARTIST'],
};

async function header() {
  const W = 900;
  const H = 240;
  const fx = flicker(JSON.stringify(HEADER), { intensity: 4 });
  const p = panel(W, H, { r: 18 });
  const tagLine = HEADER.tags.join('  ▸  ');

  const fonts =
    (await inlineFont('Orbitron', 900, HEADER.name)) +
    (await inlineFont('Share Tech Mono', 400, HEADER.status + HEADER.tagline + tagLine + '●'));

  const body = `${p.body}
<text class="meta" x="34" y="40"><tspan fill="${C.matrix}" style="${fx.style(1.5, 3)}">●</tspan> ${esc(HEADER.status)}</text>
<text class="meta" x="${W - 34}" y="40" text-anchor="end">v2.0 · NEON BUILD</text>
<text class="name" x="${W / 2}" y="122" text-anchor="middle" filter="url(#glowM)">${fx.letters(HEADER.name)}</text>
<text class="tag" x="${W / 2}" y="164" text-anchor="middle" filter="url(#glowC)">${fx.letters(HEADER.tagline, [3, 9])}</text>
<text class="tags" x="${W / 2}" y="204" text-anchor="middle" filter="url(#glowV)">${fx.letters(tagLine, [4, 8])}</text>`;

  return svg({
    W,
    H,
    label: `${HEADER.name} — ${HEADER.tagline}`,
    css: `${fonts}
.name{font:900 58px ${DISPLAY};letter-spacing:5px;fill:#fff}
.tag{font:400 18px ${MONO};letter-spacing:3px;fill:${C.cyan}}
.tags{font:400 15px ${MONO};letter-spacing:5px;fill:${C.violet}}
.meta{font:400 12px ${MONO};letter-spacing:3px;fill:${C.dim}}
${p.css}
${fx.css}`,
    defs: `${p.defs}
  ${glowFilter('glowM', C.magenta, 3, 12)}
  ${glowFilter('glowC', C.cyan, 1.6, 6)}
  ${glowFilter('glowV', C.purple, 1.6, 6)}`,
    body,
  });
}

// ---------------------------------------------------------------- about

// Each line is a list of [text, kind] segments.
//   prompt : green, every letter flickers
//   key    : magenta, every letter flickers
//   text   : steady, with the odd word buzzing
//   quote  : cyan, steady with the odd word buzzing
const ABOUT = [
  [['> whoami', 'prompt']],
  [['  Designer-turned-engineer. I build things that look as good as they work.', 'text']],
  [],
  [['> current_focus', 'prompt']],
  [['  ▸ Microcart        ', 'key'], ['— a miniature Shopify, rebuilt in Next.js', 'text']],
  [['  ▸ AI assistants    ', 'key'], ['— local-first voice HUDs, RAG knowledge bases', 'text']],
  [['  ▸ madrigal.design  ', 'key'], ['— portfolio v2, rebuilt in React', 'text']],
  [],
  [['> ask_me_about', 'prompt']],
  [['  AI models · API design · data scraping & structuring', 'text']],
  [],
  [['> fun_fact', 'prompt']],
  [['  "The world is beyond our comprehension, but science tethers close to it."', 'quote']],
];

async function about() {
  const W = 900;
  const LINE = 27;
  const TOP = 96;
  const H = TOP + ABOUT.length * LINE + 30;
  const fx = flicker(JSON.stringify(ABOUT), { intensity: 3 });
  const p = panel(W, H, { r: 18 });

  const allText = ABOUT.flat().map(([t]) => t).join('') + 'ABOUT_ME●ONLINE whoami.exe';
  const fonts = (await inlineFont('Orbitron', 900, 'ABOUT_ME')) + (await inlineFont('Share Tech Mono', 400, allText));

  // Words buzz occasionally; spacing is kept so columns stay aligned.
  const words = (t, odds) =>
    t
      .split(/(\s+)/)
      .map((w) => (!w.trim() || fx.rand() > odds ? esc(w) : `<tspan style="${fx.style(3, 9)}">${esc(w)}</tspan>`))
      .join('');

  const seg = ([t, kind]) => {
    switch (kind) {
      case 'prompt':
        return `<tspan class="prompt">${fx.letters(t, [2.5, 6])}</tspan>`;
      case 'key':
        return `<tspan class="key">${fx.letters(t, [3, 8])}</tspan>`;
      case 'quote':
        return `<tspan class="quote">${words(t, 0.2)}</tspan>`;
      default:
        return `<tspan class="text">${words(t, 0.15)}</tspan>`;
    }
  };

  const lines = ABOUT.map((segs, i) =>
    segs.length ? `<text x="40" y="${TOP + i * LINE}" xml:space="preserve">${segs.map(seg).join('')}</text>` : '',
  ).join('\n');

  const body = `${p.body}
<text class="title" x="40" y="58" filter="url(#glowC)">${fx.letters('ABOUT_ME')}</text>
<text class="meta" x="${W - 40}" y="54" text-anchor="end"><tspan fill="${C.matrix}" style="${fx.style(1.5, 3)}">●</tspan> whoami.exe · ONLINE</text>
<line x1="40" y1="72" x2="${W - 40}" y2="72" stroke="${C.purple}" stroke-width="1" opacity=".6" filter="url(#glowV)"/>
<g class="term" filter="url(#glowSoft)">
${lines}
</g>`;

  return svg({
    W,
    H,
    label: 'About Me — ' + ABOUT.flat().map(([t]) => t.trim()).join(' '),
    css: `${fonts}
.title{font:900 26px ${DISPLAY};letter-spacing:6px;fill:${C.cyan}}
.meta{font:400 12px ${MONO};letter-spacing:3px;fill:${C.dim}}
.term text{font:400 17px ${MONO};white-space:pre}
.prompt{fill:${C.matrix}}
.key{fill:${C.magenta}}
.text{fill:#e6edf3}
.quote{fill:${C.cyan};font-style:italic}
${p.css}
${fx.css}`,
    defs: `${p.defs}
  ${glowFilter('glowC', C.cyan, 1.6, 7)}
  ${glowFilter('glowV', C.purple, 1.5, 4)}
  ${glowFilter('glowSoft', null, 0.8, 3)}`,
    body,
  });
}

// ---------------------------------------------------------------- main

await mkdir('assets', { recursive: true });
await writeFile('assets/neon-header.svg', await header());
await writeFile('assets/neon-about.svg', await about());
console.log('wrote assets/neon-header.svg, assets/neon-about.svg');
