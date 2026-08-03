#!/usr/bin/env node
/**
 * Confere o site gerado antes do deploy:
 * links internos quebrados, titles/descriptions duplicados,
 * paginas sem H1, paginas com pouco texto e cobertura do sitemap.
 *
 * Uso: node tools/validar-site.js
 */

const fs = require('fs');
const path = require('path');

const SITE = path.resolve(__dirname, '..');
const ORIGEM = 'https://www.mundogol.com.br';

if (!fs.existsSync(SITE)) {
  console.error('site/ nao existe. Rode antes: node tools/gerar-site.js');
  process.exit(1);
}

/* lista recursiva dos .html */
const htmls = [];
(function varre(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) varre(p);
    else if (e.name.endsWith('.html')) htmls.push(p);
  }
})(SITE);

const urlDe = (arquivo) => {
  const rel = path.relative(SITE, arquivo).split(path.sep).join('/');
  return rel === 'index.html' ? '/' : '/' + rel.replace(/index\.html$/, '');
};

const problemas = [];
const avisos = [];
const titles = new Map();
const descrs = new Map();
const urlsExistentes = new Set();
const arquivosExistentes = new Set();

for (const f of htmls) {
  urlsExistentes.add(urlDe(f));
  arquivosExistentes.add('/' + path.relative(SITE, f).split(path.sep).join('/'));
}
// arquivos nao-html tambem sao alvos validos de link
(function varreTudo(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) varreTudo(p);
    else arquivosExistentes.add('/' + path.relative(SITE, p).split(path.sep).join('/'));
  }
})(SITE);

let totalLinks = 0;

for (const f of htmls) {
  const url = urlDe(f);
  const html = fs.readFileSync(f, 'utf8');
  const semScript = html.replace(/<script[\s\S]*?<\/script>/g, '');

  /* title */
  const t = (html.match(/<title>([\s\S]*?)<\/title>/) || [])[1];
  if (!t) problemas.push(`${url} — sem <title>`);
  else {
    if (t.length > 65) avisos.push(`${url} — title com ${t.length} chars (ideal ate 60)`);
    if (!titles.has(t)) titles.set(t, []);
    titles.get(t).push(url);
  }

  /* description */
  const d = (html.match(/<meta name="description" content="([\s\S]*?)">/) || [])[1];
  if (!d) problemas.push(`${url} — sem meta description`);
  else {
    if (d.length < 70) avisos.push(`${url} — description curta (${d.length} chars)`);
    if (d.length > 165) avisos.push(`${url} — description com ${d.length} chars (ideal ate 160)`);
    if (!descrs.has(d)) descrs.set(d, []);
    descrs.get(d).push(url);
  }

  /* h1 unico */
  const h1s = semScript.match(/<h1[\s>]/g) || [];
  if (h1s.length === 0) problemas.push(`${url} — sem <h1>`);
  if (h1s.length > 1) problemas.push(`${url} — ${h1s.length} tags <h1> (deve haver 1)`);

  /* canonical */
  const can = (html.match(/<link rel="canonical" href="([^"]+)"/) || [])[1];
  if (!can) problemas.push(`${url} — sem canonical`);
  else if (can !== ORIGEM + url && url !== '/404.html') {
    problemas.push(`${url} — canonical aponta para ${can}`);
  }

  /* volume de texto visivel */
  const texto = semScript
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (url !== '/404.html' && texto.length < 1200) {
    avisos.push(`${url} — so ${texto.length} chars de texto`);
  }

  /* links internos */
  for (const m of html.matchAll(/href="([^"]+)"/g)) {
    const href = m[1];
    if (/^(https?:|mailto:|#)/.test(href)) continue;
    totalLinks++;
    const alvo = href.split('#')[0];
    if (!alvo) continue;
    const ok = urlsExistentes.has(alvo) || arquivosExistentes.has(alvo);
    if (!ok) problemas.push(`${url} — link quebrado para ${alvo}`);
  }
}

/* duplicados */
for (const [t, urls] of titles) if (urls.length > 1) problemas.push(`title duplicado (${urls.length}x): "${t}" em ${urls.slice(0, 4).join(', ')}`);
for (const [d, urls] of descrs) if (urls.length > 1) problemas.push(`description duplicada (${urls.length}x) em ${urls.slice(0, 4).join(', ')}`);

/* sitemap x paginas */
const sitemap = fs.readFileSync(path.join(SITE, 'sitemap.xml'), 'utf8');
const noSitemap = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(ORIGEM, '')));
for (const u of urlsExistentes) {
  if (u === '/404.html') continue;
  if (!noSitemap.has(u)) problemas.push(`fora do sitemap: ${u}`);
}
for (const u of noSitemap) {
  if (!urlsExistentes.has(u)) problemas.push(`sitemap aponta para pagina inexistente: ${u}`);
}

/* arquivos obrigatorios */
for (const req of ['robots.txt', 'sitemap.xml', 'ads.txt', '404.html', 'bundle.js',
  'assets/mundogol.css', 'assets/logo_mundo_gol.png',
  'sobre/index.html', 'contato/index.html',
  'politica-de-privacidade/index.html', 'termos-de-uso/index.html']) {
  if (!fs.existsSync(path.join(SITE, req))) problemas.push(`arquivo obrigatorio ausente: ${req}`);
}

/* ------------------------------------------------------------- relatorio */

console.log(`\npaginas HTML .......... ${htmls.length}`);
console.log(`links internos ........ ${totalLinks}`);
console.log(`URLs no sitemap ....... ${noSitemap.size}`);

console.log(`\nPROBLEMAS: ${problemas.length}`);
problemas.slice(0, 40).forEach((p) => console.log('  x ' + p));
if (problemas.length > 40) console.log(`  ... e mais ${problemas.length - 40}`);

console.log(`\nAVISOS: ${avisos.length}`);
avisos.slice(0, 25).forEach((a) => console.log('  ! ' + a));
if (avisos.length > 25) console.log(`  ... e mais ${avisos.length - 25}`);

console.log('');
process.exit(problemas.length ? 1 : 0);
