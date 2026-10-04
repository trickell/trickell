// Builds the dev.to pieces of the profile README:
//   - assets/devto-followers.svg : flickering neon follower sign
//   - assets/devto.json          : shields.io endpoint for the header badge
//   - README.md                  : badge grid between DEVTO-BADGES markers
//
// Env:
//   DEVTO_USERNAME (default "trickell")
//   DEVTO_API_KEY  (needed for the follower count — dev.to only exposes
//                   followers to the account owner's own key)

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { C, esc, flicker, inlineFont, glowFilter, panel, svg } from './neon.mjs';

const USER = process.env.DEVTO_USERNAME || 'trickell';
const API_KEY = process.env.DEVTO_API_KEY || '';
const README = 'README.md';
const UA = { 'User-Agent': `${USER}-profile-readme` };

// ---------------------------------------------------------------- data

async function getFollowerCount() {
  if (!API_KEY) {
    console.warn('DEVTO_API_KEY not set; follower count unavailable');
    return null;
  }
  let total = 0;
  for (let page = 1; page < 50; page++) {
    const res = await fetch(`https://dev.to/api/followers/users?per_page=1000&page=${page}`, {
      headers: { ...UA, 'api-key': API_KEY, accept: 'application/vnd.forem.api-v1+json' },
    });
    if (!res.ok) {
      console.warn(`followers API ${res.status}; follower count unavailable`);
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

// Keep the last known value if this run couldn't fetch one, so a missing
// or expired key never wipes the published count.
async function previousCount() {
  try {
    const m = JSON.parse(await readFile('assets/devto.json', 'utf8')).message.match(/^(\d+)/);
    return m ? Number(m[1]) : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- sign

async function buildSign(count) {
  const title = 'DEV.TO FOLLOWERS';
  const value = count == null ? 'FOLLOW >' : String(count).padStart(3, '0');
  const meta = `// @${USER} · NEON SIGNAL //`;
  const W = 540;
  const H = 150;
  const fx = flicker(title + value, { intensity: 4 });
  const p = panel(W, H);

  const fonts = (await inlineFont('Orbitron', 800, value)) + (await inlineFont('Share Tech Mono', 400, title + meta));

  return svg({
    W,
    H,
    label: `${title}: ${value}`,
    css: `${fonts}
.title{font:400 20px 'Share Tech Mono',ui-monospace,monospace;letter-spacing:6px;fill:${C.cyan}}
.value{font:800 54px 'Orbitron','Share Tech Mono',ui-monospace,monospace;letter-spacing:8px;fill:#fff}
.meta{font:400 11px 'Share Tech Mono',ui-monospace,monospace;letter-spacing:3px;fill:${C.violet};opacity:.75}
${p.css}
${fx.css}`,
    defs: `${p.defs}
  ${glowFilter('glowC')}
  ${glowFilter('glowM', C.magenta, 3, 10)}`,
    body: `${p.body}
<text class="title" x="${W / 2}" y="40" text-anchor="middle" filter="url(#glowC)">${fx.letters(title)}</text>
<text class="value" x="${W / 2}" y="104" text-anchor="middle" filter="url(#glowM)">${fx.letters(value)}</text>
<text class="meta" x="${W / 2}" y="${H - 18}" text-anchor="middle">${esc(meta)}</text>`,
  });
}

// shields.io endpoint schema: https://shields.io/badges/endpoint-badge
function badgeJson(count) {
  return (
    JSON.stringify(
      {
        schemaVersion: 1,
        label: 'DEV.to',
        message: count == null ? USER : `${count} follower${count === 1 ? '' : 's'}`,
        color: 'a855f7',
        labelColor: '0a0a12',
        namedLogo: 'devdotto',
        logoColor: 'white',
        style: 'for-the-badge',
        cacheSeconds: 3600,
      },
      null,
      2,
    ) + '\n'
  );
}

// ---------------------------------------------------------------- readme

function badgeGrid(badges) {
  if (!badges.length) return `<a href="https://dev.to/${USER}"><sub>No badges found — see dev.to/${USER}</sub></a>`;
  return badges
    .map(
      (b) =>
        `<a href="https://dev.to/${USER}" title="${esc(b.name)}"><img src="${esc(b.src)}" alt="${esc(b.name)}" title="${esc(b.name)}" width="72" height="72" /></a>`,
    )
    .join('\n');
}

async function main() {
  const [fetched, badges, prev] = await Promise.all([getFollowerCount(), getBadges(), previousCount()]);
  const count = fetched ?? prev;
  console.log(`followers=${count ?? 'n/a'}${fetched == null && prev != null ? ' (cached)' : ''} badges=${badges.length}`);

  await mkdir('assets', { recursive: true });
  await writeFile('assets/devto-followers.svg', await buildSign(count));
  await writeFile('assets/devto.json', badgeJson(count));

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
