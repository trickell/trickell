// Shared neon-sign toolkit: palette, deterministic flicker, glow filters,
// and inlined Google-font subsets (so text renders inside GitHub's <img>).

export const C = {
  void: '#05050a',
  panel: '#0a0a12',
  cyan: '#00f0e8',
  violet: '#a855f7',
  purple: '#8a1fad',
  matrix: '#00ff6a',
  magenta: '#ff2bd6',
  text: '#c9d1d9',
  dim: '#8b8ba7',
};

export const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Deterministic PRNG so an SVG only changes when its text changes.
export function rng(seed) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

// Irregular keyframes: mostly lit, with a few short buzzing dropouts at
// random points in the cycle — like a failing neon tube.
function flickerKeyframes(name, rand, intensity) {
  const frames = { 0: 1 };
  const drops = 1 + Math.floor(rand() * intensity);
  for (let i = 0; i < drops; i++) {
    const at = 5 + rand() * 85;
    const buzz = 1 + Math.floor(rand() * 3);
    for (let b = 0; b < buzz; b++) {
      const t = at + b * 1.2;
      frames[t.toFixed(1)] = (0.08 + rand() * 0.25).toFixed(2);
      frames[(t + 0.6).toFixed(1)] = 1;
    }
  }
  frames[100] = 1;
  const body = Object.keys(frames)
    .map(Number)
    .sort((a, b) => a - b)
    .map((k) => `${k}%{opacity:${frames[k]}}`)
    .join('');
  return `@keyframes ${name}{${body}}`;
}

// A flicker engine for one SVG. Each call to `style()` hands out one of a
// pool of keyframe sets with its own duration and delay, so every tube
// buzzes on a different, non-repeating-looking schedule.
export function flicker(seed, { pool = 12, intensity = 3 } = {}) {
  const rand = rng(seed);
  const keyframes = Array.from({ length: pool }, (_, i) => flickerKeyframes(`f${i}`, rand, intensity));
  return {
    rand,
    css: keyframes.join('\n'),
    style(minDur = 2.5, spread = 7) {
      const name = `f${Math.floor(rand() * pool)}`;
      const dur = (minDur + rand() * spread).toFixed(2);
      const delay = (rand() * 4).toFixed(2);
      return `animation:${name} ${dur}s ${delay}s infinite steps(1,end)`;
    },
    // Wraps each character in its own flickering tspan.
    letters(text, opts) {
      return [...text].map((ch) => (ch === ' ' ? ' ' : `<tspan style="${this.style(...(opts || []))}">${esc(ch)}</tspan>`)).join('');
    },
  };
}

// Subset of a Google font containing only the glyphs we draw, inlined as
// base64. Falls back to the CSS font stack if the fetch fails.
export async function inlineFont(family, weight, text) {
  try {
    const chars = [...new Set(text)].join('');
    const css = await (
      await fetch(
        `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:wght@${weight}&text=${encodeURIComponent(chars)}`,
        { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120 Safari/537.36' } },
      )
    ).text();
    const url = css.match(/url\((https:[^)]+)\)/)?.[1];
    if (!url) return '';
    const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
    return `@font-face{font-family:'${family}';font-weight:${weight};src:url(data:font/woff2;base64,${buf.toString('base64')}) format('woff2');}`;
  } catch (e) {
    console.warn(`font ${family} unavailable: ${e.message}`);
    return '';
  }
}

// Glow filter that tints the blur with `color` while keeping the source fill.
export function glowFilter(id, color, inner = 2.2, outer = 8) {
  const tint = color
    ? `<feFlood flood-color="${color}" result="c"/><feComposite in="c" in2="SourceAlpha" operator="in" result="t"/>`
    : '';
  const src = color ? 't' : 'SourceGraphic';
  return `<filter id="${id}" x="-20%" y="-60%" width="140%" height="220%">${tint}<feGaussianBlur in="${src}" stdDeviation="${inner}" result="b1"/><feGaussianBlur in="${src}" stdDeviation="${outer}" result="b2"/><feMerge><feMergeNode in="b2"/><feMergeNode in="b1"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
}

// Dark panel with scanlines, a sweeping scan bar, and a humming neon frame
// with cyan corner accents.
export function panel(W, H, { r = 16 } = {}) {
  const defs = `
  ${glowFilter('frameGlow')}
  <linearGradient id="scanG" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${C.cyan}" stop-opacity="0"/><stop offset=".5" stop-color="${C.cyan}" stop-opacity=".10"/><stop offset="1" stop-color="${C.cyan}" stop-opacity="0"/>
  </linearGradient>
  <pattern id="lines" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="#ffffff" opacity=".035"/></pattern>
  <clipPath id="clip"><rect x="6" y="6" width="${W - 12}" height="${H - 12}" rx="${r - 4}"/></clipPath>`;
  const body = `
<rect width="${W}" height="${H}" rx="${r}" fill="${C.void}"/>
<g clip-path="url(#clip)">
  <rect width="${W}" height="${H}" fill="${C.panel}"/>
  <rect width="${W}" height="${H}" fill="url(#lines)"/>
  <rect class="scan" x="0" y="0" width="${W}" height="24" fill="url(#scanG)"/>
</g>
<g class="hum" filter="url(#frameGlow)" fill="none" stroke-width="2">
  <rect x="6" y="6" width="${W - 12}" height="${H - 12}" rx="${r - 4}" stroke="${C.purple}"/>
  <path d="M6 40 V${r + 2} Q6 6 ${r + 2} 6 H64" stroke="${C.cyan}"/>
  <path d="M${W - 6} ${H - 40} V${H - r - 2} Q${W - 6} ${H - 6} ${W - r - 2} ${H - 6} H${W - 64}" stroke="${C.cyan}"/>
</g>`;
  const css = `
.hum{animation:hum 7.3s infinite steps(1,end)}
.scan{animation:scan 6s linear infinite}
@keyframes hum{0%{opacity:1}41%{opacity:1}41.6%{opacity:.35}42.2%{opacity:1}77%{opacity:1}77.4%{opacity:.5}77.9%{opacity:1}100%{opacity:1}}
@keyframes scan{0%{transform:translateY(-24px)}100%{transform:translateY(${H + 24}px)}}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}`;
  return { defs, body, css };
}

export function svg({ W, H, label, css, defs, body }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">
<title>${esc(label)}</title>
<style>
${css}
</style>
<defs>${defs}
</defs>${body}
</svg>
`;
}
