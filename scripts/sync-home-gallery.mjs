#!/usr/bin/env node
// The homepage's "Humbled to share" gallery leads with the newest finished films in the
// Cutting Room. This writes those cards into index.html, between the two markers, from
// src/cutting-room/catalog.json. The cards after the end marker are hand-picked and stay.
//
//   node scripts/sync-home-gallery.mjs           rewrite index.html if the catalog moved on
//   node scripts/sync-home-gallery.mjs --check   exit 1 if index.html is behind the catalog
//
// `npm run build` and scripts/publish-to-cutting-room.mjs both run it, so a published film
// reaches the homepage with the next deploy and nobody edits the cards by hand.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {fmt, kindOf} from '../src/cutting-room/taxonomy.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const HOME = path.join(ROOT, 'index.html');
export const CATALOG = path.join(ROOT, 'src/cutting-room/catalog.json');
export const START = '<!-- cutting-room:latest:start (written by scripts/sync-home-gallery.mjs) -->';
export const END = '<!-- cutting-room:latest:end -->';
export const HOME_FILMS = 6;

const escape = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;'}[c]));
// "Welcome to the Office — V6" is the library's name for a cut. The public title has no cut name.
export const publicTitle = title => String(title).split(' — ')[0].trim();

// Finished films only, the current edit of each, newest first. Records from before `added`
// existed have no date: they follow the dated ones in catalog order (newest on top).
export function latestFilms(assets, n = HOME_FILMS) {
  return assets.map((a, i) => [a, i])
    .filter(([a]) => kindOf(a) === 'video' && a.category === 'Finished films' && a.status === 'Current edit' && !a.replacedBy)
    .sort(([a, i], [b, j]) => (b.added || '').localeCompare(a.added || '') || i - j)
    .slice(0, n).map(([a]) => a);
}

export function cardHTML(a) {
  const title = escape(publicTitle(a.title));
  return `<a class="film-card film-open" href="${escape(a.src)}" data-film="${escape(a.id)}" data-title="${title}"><div class="film-image"><img src="${escape(a.poster)}" alt="${title} film poster" loading="lazy"><span class="film-type">FILM · ${fmt(a.duration)}</span><span class="play-disc">▶</span></div><div class="film-caption"><strong>${title}</strong><small>WATCH THE FILM ↗</small></div></a>`;
}

export function render(html, catalog) {
  const start = html.indexOf(START), end = html.indexOf(END);
  if (start < 0 || end < start) throw new Error('index.html has lost its cutting-room:latest markers');
  const films = latestFilms(catalog.assets);
  if (!films.length) throw new Error('the catalog has no current finished film');
  for (const a of films) {
    if (!fs.existsSync(path.join(ROOT, 'public', a.poster))) throw new Error(`${a.id} has no poster at public${a.poster}`);
  }
  const out = html.slice(0, start) + START + '\n' + films.map(cardHTML).join('\n') + '\n' + html.slice(end);
  // The counter under the gallery counts every card, hand-picked ones included.
  const gallery = out.slice(out.indexOf('id="gallery"'), out.indexOf('class="gallery-controls"'));
  const total = String((gallery.match(/class="film-card/g) || []).length).padStart(2, '0');
  return out.replace(/(id="galleryPosition">01 \/ )\d+/, `$1${total}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const html = fs.readFileSync(HOME, 'utf8');
  const next = render(html, JSON.parse(fs.readFileSync(CATALOG, 'utf8')));
  const titles = latestFilms(JSON.parse(fs.readFileSync(CATALOG, 'utf8')).assets).map(a => publicTitle(a.title)).join(', ');
  if (next === html) console.log(`sync-home-gallery: up to date (${titles})`);
  else if (process.argv.includes('--check')) {
    console.error('FAIL index.html is behind the Cutting Room: run node scripts/sync-home-gallery.mjs');
    process.exit(1);
  } else { fs.writeFileSync(HOME, next); console.log(`sync-home-gallery: homepage now leads with ${titles}`); }
}
