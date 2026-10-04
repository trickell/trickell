// Builds the dev.to section of the profile README:
//   - assets/devto-followers.svg : flickering neon follower sign
//   - README.md                  : badge grid between DEVTO-BADGES markers
//
// Env:
//   DEVTO_USERNAME (default "trickell")
//   DEVTO_API_KEY  (optional; needed for the follower count — dev.to only
//                   exposes followers to the account owner's own key)

import { readFile, writeFile, mkdir } from 'node:fs/promises';

const USER = process.env.DEVTO_USERNAME || 'trickell';
const API_KEY = process.env.DEVTO_API_KEY || '';
const README = 'README.md';
const SIGN = 'assets/devto-followers.svg';
const UA = { 'User-Agent': `${USER}-profile-readme` };

const C = {
  void: '#05050a',
  panel: '#0a0a12',
  cyan: '#00f0e8',
  violet: '#a855f7',
  purple: '#8a1fad',
  matrix: '#00ff6a',
  magenta: '#ff2bd6',
  text: '#c9d1d9',
};

// ---------------------------------------------------------------- data

async function getFollowerCount() {
  if (!API_KEY) return null;
  let total = 0;
  for (let page = 1; page < 50; page++) {
    const res = await fetch(
      `https://dev.to/api/followers/users?per_page=1000&page=${page}`,
      { headers: { ...UA, 'api-key': API_KEY, accept: 'application/vnd.forem.api-v1+json' } },
    );
    if (!res.ok) {
      console.warn(`followers API ${res.status}; leaving count blank`);
      return null;
    }
    const batch = await res.json();
    total += batch.length;
    if (batch.length < 1000) break;
  }
  return total;
}

async function getBadges() {
  const res = await fetch(`https://dev.to/${USER}`, { headers: UA });
  if (!res.ok) throw new Error(`dev.to profile ${res.status}`);
  const html = await res.text();
  const re = /title="([^"]+)"\s+class="js-profile-badge[^"]*">\s*<img src="([^"]+)"/g;
  const seen = new Set();
  const badges = [];
  for (const [, title, src] of html.matchAll(re)) {
    const name = decode(title).trim();
    if (seen.has(name)) continue;
    seen.add(name);
    badges.push({ name, src: decode(src) });
  }
  return badges;
}

const decode = (s) =>
  s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Subset of a Google font containing only the glyphs we draw, inlined as
// base64 so it renders inside GitHub's <img> sandbox. Falls back to monospace.
async function inlineFont(family, weight, text) {
  try {
    const css = await (
      await fetch(
        `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:wght@${weight}&text=${encodeURIComponent(text)}`,
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

// ---------------------------------------------------------------- sign

// Deterministic PRNG so the SVG only changes when its text changes.
function rng(seed) {
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

async function buildSign(count) {
  const title = 'DEV.TO FOLLOWERS';
  const value = count == null ? 'FOLLOW >' : String(count).padStart(3, '0');
  const rand = rng(title + value);
  const W = 540;
  const H = 150;

  const meta = `// @${USER} · NEON SIGNAL //`;
  const fontCss =
    (await inlineFont('Orbitron', 800, value)) + (await inlineFont('Share Tech Mono', 400, title + meta));

  const keyframes = [];
  const letter = (ch, i, prefix, intensity) => {
    if (ch === ' ') return ' ';
    const name = `${prefix}${i}`;
    keyframes.push(flickerKeyframes(name, rand, intensity));
    const dur = (2.5 + rand() * 7).toFixed(2);
    const delay = (rand() * 4).toFixed(2);
    return `<tspan style="animation:${name} ${dur}s ${delay}s infinite steps(1,end)">${esc(ch)}</tspan>`;
  };

  const titleSpans = [...title].map((ch, i) => letter(ch, i, 't', 2)).join('');
  const valueSpans = [...value].map((ch, i) => letter(ch, i, 'v', 4)).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}: ${esc(value)}">
<title>${esc(title)}: ${esc(value)}</title>
<style>
${fontCss}
.title{font:400 20px 'Share Tech Mono',ui-monospace,monospace;letter-spacing:6px;fill:${C.cyan}}
.value{font:800 54px 'Orbitron','Share Tech Mono',ui-monospace,monospace;letter-spacing:8px;fill:#fff}
.meta{font:400 11px 'Share Tech Mono',ui-monospace,monospace;letter-spacing:3px;fill:${C.violet};opacity:.75}
.frame{animation:hum 7.3s infinite steps(1,end)}
.scan{animation:scan 5s linear infinite}
@keyframes hum{0%{opacity:1}41%{opacity:1}41.6%{opacity:.35}42.2%{opacity:1}77%{opacity:1}77.4%{opacity:.5}77.9%{opacity:1}100%{opacity:1}}
@keyframes scan{0%{transform:translateY(-20px)}100%{transform:translateY(${H + 20}px)}}
${keyframes.join('\n')}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}
</style>
<defs>
  <filter id="glowC" x="-20%" y="-50%" width="140%" height="200%">
    <feGaussianBlur stdDeviation="2.2" result="b1"/><feGaussianBlur stdDeviation="7" result="b2"/>
    <feMerge><feMergeNode in="b2"/><feMergeNode in="b1"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <filter id="glowM" x="-20%" y="-50%" width="140%" height="200%">
    <feFlood flood-color="${C.magenta}" result="c"/>
    <feComposite in="c" in2="SourceAlpha" operator="in" result="tint"/>
    <feGaussianBlur in="tint" stdDeviation="3" result="b1"/><feGaussianBlur in="tint" stdDeviation="10" result="b2"/>
    <feMerge><feMergeNode in="b2"/><feMergeNode in="b1"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <linearGradient id="scan" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${C.cyan}" stop-opacity="0"/><stop offset=".5" stop-color="${C.cyan}" stop-opacity=".12"/><stop offset="1" stop-color="${C.cyan}" stop-opacity="0"/>
  </linearGradient>
  <pattern id="lines" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="#ffffff" opacity=".035"/></pattern>
  <clipPath id="clip"><rect x="6" y="6" width="${W - 12}" height="${H - 12}" rx="12"/></clipPath>
</defs>
<rect width="${W}" height="${H}" rx="16" fill="${C.void}"/>
<g clip-path="url(#clip)">
  <rect width="${W}" height="${H}" fill="${C.panel}"/>
  <rect width="${W}" height="${H}" fill="url(#lines)"/>
  <rect class="scan" x="0" y="0" width="${W}" height="20" fill="url(#scan)"/>
</g>
<g class="frame" filter="url(#glowC)" fill="none" stroke-width="2">
  <rect x="6" y="6" width="${W - 12}" height="${H - 12}" rx="12" stroke="${C.purple}"/>
  <path d="M6 34 V18 Q6 6 18 6 H48" stroke="${C.cyan}"/>
  <path d="M${W - 6} ${H - 34} V${H - 18} Q${W - 6} ${H - 6} ${W - 18} ${H - 6} H${W - 48}" stroke="${C.cyan}"/>
</g>
<text class="title" x="${W / 2}" y="40" text-anchor="middle" filter="url(#glowC)">${titleSpans}</text>
<text class="value" x="${W / 2}" y="104" text-anchor="middle" filter="url(#glowM)">${valueSpans}</text>
<text class="meta" x="${W / 2}" y="${H - 18}" text-anchor="middle">${esc(meta)}</text>
</svg>
`;
}

// ---------------------------------------------------------------- readme

function badgeGrid(badges) {
  if (!badges.length) return `<a href="https://dev.to/${USER}"><sub>No badges found — see dev.to/${USER}</sub></a>`;
  const cells = badges.map(
    (b) =>
      `<a href="https://dev.to/${USER}" title="${esc(b.name)}"><img src="${esc(b.src)}" alt="${esc(b.name)}" title="${esc(b.name)}" width="72" height="72" /></a>`,
  );
  return cells.join('\n');
}

async function main() {
  const [count, badges] = await Promise.all([getFollowerCount(), getBadges()]);
  console.log(`followers=${count ?? 'n/a'} badges=${badges.length}`);

  await mkdir('assets', { recursive: true });
  await writeFile(SIGN, await buildSign(count));

  const readme = await readFile(README, 'utf8');
  const start = '<!-- DEVTO-BADGES:START -->';
  const end = '<!-- DEVTO-BADGES:END -->';
  const i = readme.indexOf(start);
  const j = readme.indexOf(end);
  if (i === -1 || j === -1) throw new Error('DEVTO-BADGES markers missing from README');
  const next = `${readme.slice(0, i + start.length)}\n${badgeGrid(badges)}\n${readme.slice(j)}`;
  if (next !== readme) await writeFile(README, next);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
