#!/usr/bin/env node
/**
 * Gerador do site estatico do MundoGol.
 *
 * Le tools/curiosidades.json e escreve em site/ um site completo e rastreavel:
 * home com conteudo em HTML, hubs e paginas por time/pais/campeonato/jogador/decada,
 * paginas institucionais, robots.txt, sitemap.xml e ads.txt.
 *
 * Uso: node tools/gerar-site.js
 */

const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
// esta e a branch gh-pages: o site e publicado a partir da propria raiz
const SAIDA = RAIZ;

const CFG = {
  origem: 'https://www.mundogol.com.br',
  nome: 'MundoGol',
  pubId: 'ca-pub-3295153480455197',
  // minimo de curiosidades para uma entidade ganhar pagina propria.
  // abaixo disso ela so aparece listada no hub, para nao gerar pagina rasa.
  minItens: 15,
  email: 'varjao.samueloliveira@gmail.com',
  responsavel: 'Samuel Oliveira',
};

const HOJE = new Date().toISOString().slice(0, 10);

/* ---------------------------------------------------------------- utilidades */

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const slug = (s) => String(s)
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const escreve = (rel, conteudo) => {
  const destino = path.join(SAIDA, rel);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, conteudo, 'utf8');
};

/** "1930s" -> "decada de 1930" */
const rotuloDecada = (d) => `década de ${String(d).replace(/s$/, '')}`;

/** lista em portugues: [a,b,c] -> "a, b e c" */
const listar = (arr) => {
  if (arr.length === 0) return '';
  if (arr.length === 1) return arr[0];
  return arr.slice(0, -1).join(', ') + ' e ' + arr[arr.length - 1];
};

const plural = (n, sing, plur) => (n === 1 ? sing : plur);

/* ------------------------------------------------------------ carga dos dados */

const bruto = JSON.parse(fs.readFileSync(path.join(__dirname, 'curiosidades.json'), 'utf8'));

// remove textos exatamente repetidos: conteudo duplicado pesa contra na avaliacao
const vistos = new Set();
const DADOS = [];
for (const item of bruto) {
  const texto = String(item.texto || '').trim();
  if (!texto) continue;
  const chave = texto.toLowerCase().replace(/\s+/g, ' ');
  if (vistos.has(chave)) continue;
  vistos.add(chave);
  DADOS.push({
    id: item.id,
    texto,
    pais: String(item.pais || '').trim(),
    time: String(item.time || '').trim(),
    campeonato: String(item.campeonato || '').trim(),
    jogador: String(item.jogador || '').trim(),
    decada: String(item.decada || '').trim(),
    cidade: String(item.cidade || '').trim(),
  });
}

/* --------------------------------------------------- agrupamento por dimensao */

/**
 * Agrupa por slug (nao pelo rotulo bruto). Isso funde variacoes de grafia
 * do mesmo clube/competicao — "Al Nassr"/"Al-Nassr", "Atletico Paranaense"/
 * "Athletico Paranaense" — em uma unica entidade. O rotulo exibido e a
 * variacao mais frequente.
 */
function agrupar(campo) {
  const mapa = new Map();
  for (const item of DADOS) {
    const valor = item[campo];
    if (!valor) continue;
    const s = slug(valor);
    if (!s) continue;
    if (!mapa.has(s)) mapa.set(s, { slug: s, rotulos: new Map(), itens: [] });
    const ent = mapa.get(s);
    ent.rotulos.set(valor, (ent.rotulos.get(valor) || 0) + 1);
    ent.itens.push(item);
  }
  for (const ent of mapa.values()) {
    ent.rotulo = [...ent.rotulos.entries()].sort((a, b) => b[1] - a[1])[0][0];
    ent.total = ent.itens.length;
  }
  return [...mapa.values()].sort((a, b) => b.total - a.total || a.rotulo.localeCompare(b.rotulo, 'pt'));
}

const DIMENSOES = [
  { campo: 'time', base: 'times', titulo: 'Times', singular: 'time', icone: '⚽',
    descricaoHub: 'Clubes e seleções com curiosidades registradas no acervo.' },
  { campo: 'pais', base: 'paises', titulo: 'Países', singular: 'país', icone: '🌍',
    descricaoHub: 'O futebol de cada país, contado em fatos verificáveis.' },
  { campo: 'campeonato', base: 'campeonatos', titulo: 'Campeonatos', singular: 'campeonato', icone: '🏆',
    descricaoHub: 'Competições nacionais, continentais e mundiais.' },
  { campo: 'jogador', base: 'jogadores', titulo: 'Jogadores', singular: 'jogador', icone: '👤',
    descricaoHub: 'Craques, ídolos e revelações citados no acervo.' },
  { campo: 'decada', base: 'decadas', titulo: 'Décadas', singular: 'década', icone: '📅',
    descricaoHub: 'Uma linha do tempo do futebol, década a década.' },
];

for (const d of DIMENSOES) {
  d.entidades = agrupar(d.campo);
  if (d.campo === 'decada') {
    // decada tem poucos valores e ordem cronologica faz mais sentido
    d.entidades.sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt'));
    d.comPagina = d.entidades.filter((e) => e.total >= CFG.minItens);
  } else {
    d.comPagina = d.entidades.filter((e) => e.total >= CFG.minItens);
  }
  d.semPagina = d.entidades.filter((e) => !d.comPagina.includes(e));
  d.porSlug = new Map(d.comPagina.map((e) => [e.slug, e]));
}

const dimPorCampo = Object.fromEntries(DIMENSOES.map((d) => [d.campo, d]));

/**
 * Um mesmo nome pode existir em duas dimensoes — "Internacional" e clube e
 * tambem uma categoria de competicao. Nesses casos o titulo recebe a secao
 * entre parenteses, para que cada pagina tenha titulo unico.
 */
const ocorrenciasPorSlug = new Map();
for (const d of DIMENSOES) {
  for (const e of d.comPagina) {
    if (!ocorrenciasPorSlug.has(e.slug)) ocorrenciasPorSlug.set(e.slug, []);
    ocorrenciasPorSlug.get(e.slug).push(d);
  }
}
const precisaQualificar = (dim, ent) => (ocorrenciasPorSlug.get(ent.slug) || []).length > 1;
/** "Times" -> "time", para o qualificador ficar no singular */
const qualificador = (dim) => (dim.campo === 'pais' ? 'país' : dim.singular);

/* ------------------------------------------------------------------- template */

const NAV = DIMENSOES.map((d) => `<a href="/${d.base}/">${d.titulo}</a>`).join('\n        ');

function pagina({ url, titulo, tituloAba, descricao, migalhas = [], conteudo, jsonLd = [], antesDoMain = '' }) {
  const canonica = CFG.origem + url;
  const migalhasHtml = migalhas.length
    ? `<nav class="mg-migalhas" aria-label="Você está em"><ol>
        ${['<li><a href="/">Início</a></li>']
          .concat(migalhas.map((m, i) =>
            i === migalhas.length - 1
              ? `<li aria-current="page">${esc(m.nome)}</li>`
              : `<li><a href="${m.url}">${esc(m.nome)}</a></li>`))
          .join('\n        ')}
      </ol></nav>`
    : '';

  const ld = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [{ nome: 'Início', url: '/' }]
        .concat(migalhas.map((m) => ({ nome: m.nome, url: m.url })))
        .map((m, i) => ({
          '@type': 'ListItem', position: i + 1, name: m.nome, item: CFG.origem + m.url,
        })),
    },
    ...jsonLd,
  ];

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(tituloAba || titulo)}</title>
<meta name="description" content="${esc(descricao)}">
<link rel="canonical" href="${esc(canonica)}">
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(CFG.nome)}">
<meta property="og:locale" content="pt_BR">
<meta property="og:title" content="${esc(tituloAba || titulo)}">
<meta property="og:description" content="${esc(descricao)}">
<meta property="og:url" content="${esc(canonica)}">
<meta property="og:image" content="${CFG.origem}/assets/logo_mundo_gol.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/assets/icone_mundo_gol.ico">
<link rel="stylesheet" href="/assets/mundogol.css">
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CFG.pubId}" crossorigin="anonymous"></script>
<script type="application/ld+json">${JSON.stringify(ld)}</script>
</head>
<body>
<a class="mg-pular" href="#conteudo">Pular para o conteúdo</a>

<header class="mg-topo">
  <div class="mg-container mg-topo-int">
    <a class="mg-marca" href="/" aria-label="MundoGol — página inicial">
      <img src="/assets/logo_mundo_gol.png" alt="MundoGol" width="843" height="296">
    </a>
    <nav class="mg-nav" aria-label="Seções do acervo">
      <a href="/curiosidades/">Acervo</a>
        ${NAV}
    </nav>
  </div>
</header>
${antesDoMain}
<main class="mg-container" id="conteudo">
${migalhasHtml}
${conteudo}
</main>

<footer class="mg-rodape">
  <div class="mg-container">
    <div class="mg-rodape-cols">
      <div>
        <strong>MundoGol</strong>
        <p>Acervo de curiosidades do futebol mundial, organizado por time, país, campeonato, jogador e década.</p>
      </div>
      <div>
        <strong>Acervo</strong>
        <ul>
          <li><a href="/curiosidades/">Todas as seções</a></li>
          ${DIMENSOES.map((d) => `<li><a href="/${d.base}/">${d.titulo}</a></li>`).join('\n          ')}
        </ul>
      </div>
      <div>
        <strong>Institucional</strong>
        <ul>
          <li><a href="/sobre/">Sobre o site</a></li>
          <li><a href="/contato/">Contato</a></li>
          <li><a href="/politica-de-privacidade/">Política de Privacidade</a></li>
          <li><a href="/termos-de-uso/">Termos de Uso</a></li>
        </ul>
      </div>
    </div>
    <p class="mg-copy">© ${new Date().getFullYear()} MundoGol · Conteúdo editorial independente, sem vínculo com clubes, ligas, CBF ou FIFA.</p>
  </div>
</footer>
</body>
</html>
`;
}

/* --------------------------------------------------- blocos de conteudo */

/** uma curiosidade renderizada com seu contexto */
function itemHtml(item, ocultar = []) {
  const metas = [];
  const add = (campo, prefixo) => {
    if (ocultar.includes(campo)) return;
    const valor = item[campo];
    if (!valor) return;
    const dim = dimPorCampo[campo];
    const ent = dim && dim.porSlug.get(slug(valor));
    const rotulo = campo === 'decada' ? rotuloDecada(valor) : valor;
    metas.push(ent
      ? `<a href="/${dim.base}/${ent.slug}/">${esc(rotulo)}</a>`
      : `<span>${esc(rotulo)}</span>`);
    void prefixo;
  };
  add('time');
  add('pais');
  add('campeonato');
  add('jogador');
  add('decada');

  return `<li class="mg-item">
      <p>${esc(item.texto)}</p>
      ${metas.length ? `<p class="mg-item-meta">${metas.join(' · ')}</p>` : ''}
    </li>`;
}

/** agrupa os itens de uma pagina por decada, com subtitulos */
function corpoPorDecada(itens, ocultar) {
  const porDecada = new Map();
  const sem = [];
  for (const it of itens) {
    if (!it.decada) { sem.push(it); continue; }
    if (!porDecada.has(it.decada)) porDecada.set(it.decada, []);
    porDecada.get(it.decada).push(it);
  }
  const chaves = [...porDecada.keys()].sort();
  const blocos = chaves.map((d) => `<section class="mg-bloco">
      <h2>${esc(rotuloDecada(d).replace(/^d/, 'D'))}</h2>
      <ul class="mg-lista">
        ${porDecada.get(d).map((i) => itemHtml(i, ocultar)).join('\n        ')}
      </ul>
    </section>`);
  if (sem.length) {
    blocos.push(`<section class="mg-bloco">
      <h2>Sem década definida</h2>
      <ul class="mg-lista">
        ${sem.map((i) => itemHtml(i, ocultar)).join('\n        ')}
      </ul>
    </section>`);
  }
  return blocos.join('\n');
}

/** os N valores mais frequentes de um campo dentro de um conjunto de itens */
function topDe(itens, campo, n) {
  const c = new Map();
  for (const i of itens) {
    const v = i[campo];
    if (v) c.set(v, (c.get(v) || 0) + 1);
  }
  return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([v]) => v);
}

/**
 * Texto de abertura da pagina, derivado dos proprios dados: quantidade,
 * intervalo temporal coberto, competicoes e nomes recorrentes.
 */
function introducao(dim, ent) {
  const itens = ent.itens;
  const decadas = [...new Set(itens.map((i) => i.decada).filter(Boolean))].sort();
  const frases = [];

  if (dim.campo === 'decada') {
    const anos = ent.rotulo.replace(/s$/, '');
    frases.push(`Esta página reúne ${itens.length} ${plural(itens.length, 'curiosidade', 'curiosidades')} do futebol registradas na ${rotuloDecada(ent.rotulo)}, ou seja, entre ${anos} e ${Number(anos) + 9}.`);
  } else {
    // construcao sem artigo antes do nome proprio: em portugues o artigo varia
    // com genero e com o proprio nome ("o Flamengo", "a Espanha", "Messi"),
    // e acertar isso para 500+ entidades levaria a erros de concordancia.
    frases.push(`No acervo do MundoGol, ${ent.rotulo} aparece em ${itens.length} ${plural(itens.length, 'curiosidade', 'curiosidades')}.`);
    if (decadas.length > 1) {
      frases.push(`Os registros vão da ${rotuloDecada(decadas[0])} até a ${rotuloDecada(decadas[decadas.length - 1])}.`);
    } else if (decadas.length === 1) {
      frases.push(`Os registros se concentram na ${rotuloDecada(decadas[0])}.`);
    }
  }

  if (dim.campo !== 'campeonato') {
    const comps = topDe(itens, 'campeonato', 3);
    if (comps.length) frases.push(`As competições mais presentes são ${listar(comps)}.`);
  }
  if (dim.campo !== 'jogador') {
    const nomes = topDe(itens, 'jogador', 3);
    if (nomes.length) frases.push(`Entre os nomes que mais aparecem estão ${listar(nomes)}.`);
  }
  if (dim.campo === 'campeonato' || dim.campo === 'decada' || dim.campo === 'jogador') {
    const times = topDe(itens, 'time', 3);
    if (times.length) frases.push(`Os clubes e seleções mais citados são ${listar(times)}.`);
  }
  if (dim.campo === 'decada' || dim.campo === 'campeonato') {
    const paises = topDe(itens, 'pais', 3);
    if (paises.length) frases.push(`Os países mais representados são ${listar(paises)}.`);
  }

  frases.push('Cada fato abaixo está organizado por década e traz o contexto de time, país, competição e jogador quando essa informação existe no registro.');
  return frases.join(' ');
}

/** links para entidades relacionadas, a partir da co-ocorrencia real nos itens */
function relacionados(dim, ent) {
  const grupos = [];
  for (const outra of DIMENSOES) {
    if (outra.campo === dim.campo) continue;
    const contagem = new Map();
    for (const it of ent.itens) {
      const v = it[outra.campo];
      if (!v) continue;
      const s = slug(v);
      const alvo = outra.porSlug.get(s);
      if (!alvo || alvo.slug === ent.slug) continue;
      contagem.set(alvo, (contagem.get(alvo) || 0) + 1);
    }
    const lista = [...contagem.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([e]) => e);
    if (lista.length) {
      grupos.push(`<div>
        <h3>${outra.titulo}</h3>
        <ul class="mg-tags">
          ${lista.map((e) => `<li><a href="/${outra.base}/${e.slug}/">${esc(outra.campo === 'decada' ? rotuloDecada(e.rotulo) : e.rotulo)}</a></li>`).join('\n          ')}
        </ul>
      </div>`);
    }
  }
  if (!grupos.length) return '';
  return `<section class="mg-relacionados">
    <h2>Explore também</h2>
    <div class="mg-relacionados-grid">
      ${grupos.join('\n      ')}
    </div>
  </section>`;
}

/* ------------------------------------------------------- paginas de entidade */

let contadorPaginas = 0;
const urlsSitemap = [];

const registraUrl = (url, prioridade, freq) => urlsSitemap.push({ url, prioridade, freq });

for (const dim of DIMENSOES) {
  for (const ent of dim.comPagina) {
    const nomeExib = dim.campo === 'decada' ? rotuloDecada(ent.rotulo).replace(/^d/, 'D') : ent.rotulo;
    const sufixo = precisaQualificar(dim, ent) ? ` (${qualificador(dim)})` : '';
    const url = `/${dim.base}/${ent.slug}/`;
    const titulo = dim.campo === 'decada'
      ? `Curiosidades do futebol na ${rotuloDecada(ent.rotulo)}`
      : `Curiosidades sobre ${nomeExib}${sufixo}`;
    const descricao = dim.campo === 'decada'
      ? `${ent.total} curiosidades do futebol na ${rotuloDecada(ent.rotulo)}, organizadas por time, país e competição.`
      : `${ent.total} curiosidades sobre ${nomeExib}${sufixo}, organizadas por década, com contexto de competição e jogadores.`;

    const conteudo = `<article class="mg-artigo">
    <h1>${esc(titulo)}</h1>
    <p class="mg-intro">${esc(introducao(dim, ent))}</p>
    ${corpoPorDecada(ent.itens, dim.campo === 'decada' ? ['decada'] : [dim.campo])}
    ${relacionados(dim, ent)}
    <p class="mg-cta">Quer descobrir esses fatos em formato de jogo? <a href="/">Abra o baralho do MundoGol</a> e sorteie curiosidades filtrando por ${esc(nomeExib)}.</p>
  </article>`;

    escreve(path.join(dim.base, ent.slug, 'index.html'), pagina({
      url,
      titulo,
      tituloAba: `${titulo} | MundoGol`,
      descricao,
      migalhas: [{ nome: dim.titulo, url: `/${dim.base}/` }, { nome: nomeExib, url }],
      conteudo,
      jsonLd: [{
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: titulo,
        description: descricao,
        inLanguage: 'pt-BR',
        url: CFG.origem + url,
        isPartOf: { '@type': 'WebSite', name: CFG.nome, url: CFG.origem },
      }],
    }));
    registraUrl(url, '0.8', 'monthly');
    contadorPaginas++;
  }

  /* ------------------------------------------------------------- hub da dimensao */
  const url = `/${dim.base}/`;
  const totalItens = dim.entidades.reduce((a, e) => a + e.total, 0);
  const titulo = `Curiosidades do futebol por ${dim.singular}`;

  const cards = dim.comPagina.map((e) => `<li>
        <a href="/${dim.base}/${e.slug}/">
          <span class="mg-card-nome">${esc(dim.campo === 'decada' ? rotuloDecada(e.rotulo).replace(/^d/, 'D') : e.rotulo)}</span>
          <span class="mg-card-num">${e.total} ${plural(e.total, 'curiosidade', 'curiosidades')}</span>
        </a>
      </li>`).join('\n      ');

  const resto = dim.semPagina.length
    ? `<section class="mg-bloco">
      <h2>Outros registros do acervo</h2>
      <p>Estes ${dim.singular === 'país' ? 'países' : dim.singular + 's'} aparecem no acervo com menos de ${CFG.minItens} curiosidades e ainda não têm página própria. Eles continuam disponíveis nos filtros do jogo e ganharão página assim que o acervo crescer.</p>
      <p class="mg-resto">${dim.semPagina.map((e) => `${esc(dim.campo === 'decada' ? rotuloDecada(e.rotulo) : e.rotulo)} <span>(${e.total})</span>`).join(' · ')}</p>
    </section>`
    : '';

  const conteudo = `<article class="mg-artigo">
    <h1>${esc(dim.icone)} ${esc(titulo)}</h1>
    <p class="mg-intro">${esc(dim.descricaoHub)} O acervo tem ${totalItens} ${plural(totalItens, 'registro', 'registros')} associados a ${dim.entidades.length} ${dim.singular === 'país' ? 'países' : dim.singular + 's'}, ${dim.comPagina.length} ${plural(dim.comPagina.length, 'deles com página própria', 'deles com página própria')}. As páginas abaixo estão ordenadas pelo volume de curiosidades.</p>
    <ul class="mg-cards">
      ${cards}
    </ul>
    ${resto}
    <p class="mg-cta">Prefere descobrir os fatos aos poucos? <a href="/">Jogue o MundoGol</a> e filtre o baralho por ${esc(dim.singular)}.</p>
  </article>`;

  escreve(path.join(dim.base, 'index.html'), pagina({
    url,
    titulo,
    tituloAba: `${dim.titulo} — curiosidades do futebol | MundoGol`,
    descricao: `${dim.descricaoHub} ${dim.comPagina.length} páginas com ${totalItens} curiosidades do futebol organizadas por ${dim.singular}.`,
    migalhas: [{ nome: dim.titulo, url }],
    conteudo,
  }));
  registraUrl(url, '0.9', 'weekly');
  contadorPaginas++;
}

/* ---------------------------------------------------------- indice do acervo */
{
  const url = '/curiosidades/';
  const conteudo = `<article class="mg-artigo">
    <h1>Acervo de curiosidades do futebol</h1>
    <p class="mg-intro">O MundoGol mantém ${DADOS.length} curiosidades do futebol mundial, cada uma classificada por time, país, campeonato, jogador e década. Esta página é o índice geral: a partir dela você chega a todas as seções do acervo.</p>

    <section class="mg-bloco">
      <h2>Como o acervo está organizado</h2>
      <p>Cada registro é um fato curto e verificável — um recorde, uma fundação de clube, uma decisão de campeonato, uma marca individual. Em vez de deixar tudo em uma lista única, agrupamos os registros em cinco recortes que respondem às perguntas mais comuns de quem gosta de futebol: de qual time, de qual país, em qual competição, com qual jogador e em que época.</p>
      <p>Dentro de cada página, os fatos aparecem em ordem cronológica, separados por década, para que dê para acompanhar a evolução de um clube ou de uma competição ao longo do tempo.</p>
    </section>

    <ul class="mg-cards mg-cards-grande">
      ${DIMENSOES.map((d) => `<li>
        <a href="/${d.base}/">
          <span class="mg-card-nome">${esc(d.icone)} ${esc(d.titulo)}</span>
          <span class="mg-card-num">${d.comPagina.length} páginas · ${d.entidades.length} ${d.singular === 'país' ? 'países' : d.singular + 's'}</span>
        </a>
      </li>`).join('\n      ')}
    </ul>

    <section class="mg-bloco">
      <h2>Páginas com mais curiosidades</h2>
      <p>Se você está chegando agora, estes são os pontos de partida mais completos do acervo:</p>
      <ul class="mg-tags">
        ${DIMENSOES.flatMap((d) => d.comPagina.slice(0, 8).map((e) =>
          `<li><a href="/${d.base}/${e.slug}/">${esc(d.campo === 'decada' ? rotuloDecada(e.rotulo) : e.rotulo)}</a></li>`)).join('\n        ')}
      </ul>
    </section>

    <p class="mg-cta">Também dá para explorar tudo em formato de jogo: <a href="/">abra o baralho do MundoGol</a>.</p>
  </article>`;

  escreve(path.join('curiosidades', 'index.html'), pagina({
    url,
    titulo: 'Acervo de curiosidades do futebol',
    tituloAba: 'Acervo de curiosidades do futebol | MundoGol',
    descricao: `Índice geral do acervo do MundoGol: ${DADOS.length} curiosidades do futebol organizadas por time, país, campeonato, jogador e década.`,
    migalhas: [{ nome: 'Acervo', url }],
    conteudo,
  }));
  registraUrl(url, '0.9', 'weekly');
  contadorPaginas++;
}

/* ------------------------------------------------------------------- home */
{
  const destaques = DADOS.filter((i) => i.texto.length > 110).slice(0, 8);

  // o jogo fica fora do <main> para ocupar a largura inteira da hero
  const hero = `<div class="mg-jogo">
  <div id="root"></div>
</div>`;

  const conteudo = `<article class="mg-artigo">
    <h1>MundoGol — curiosidades do futebol mundial</h1>
    <p class="mg-intro">Um baralho de ${DADOS.length} fatos sobre o futebol: recordes, fundações de clubes, decisões de campeonato e marcas individuais. Sorteie uma carta ao acaso no jogo acima ou navegue pelo acervo por time, país, campeonato, jogador e década.</p>

    <section class="mg-bloco">
      <h2>O que é o MundoGol</h2>
      <p>O MundoGol nasceu de uma pergunta simples: por que as histórias mais interessantes do futebol ficam espalhadas em notas de rodapé, threads e almanaques fora de catálogo? A proposta do site é reunir essas histórias em registros curtos, cada um com o contexto necessário para que o leitor saiba de que time, de que país, de que competição e de que época o fato veio.</p>
      <p>São ${DADOS.length} curiosidades classificadas em cinco recortes. O jogo acima embaralha o acervo e entrega um fato por vez — é o jeito mais divertido de navegar. Já as páginas do acervo servem para quem quer ler tudo sobre um clube, uma seleção ou uma competição de uma vez só.</p>
    </section>

    <section class="mg-bloco">
      <h2>Navegue pelo acervo</h2>
      <ul class="mg-cards mg-cards-grande">
        ${DIMENSOES.map((d) => `<li>
          <a href="/${d.base}/">
            <span class="mg-card-nome">${esc(d.icone)} ${esc(d.titulo)}</span>
            <span class="mg-card-num">${d.comPagina.length} páginas</span>
          </a>
        </li>`).join('\n        ')}
      </ul>
    </section>

    <section class="mg-bloco">
      <h2>Algumas curiosidades do acervo</h2>
      <ul class="mg-lista">
        ${destaques.map((i) => itemHtml(i)).join('\n        ')}
      </ul>
      <p><a href="/curiosidades/">Ver o índice completo do acervo →</a></p>
    </section>

    <section class="mg-bloco">
      <h2>Times mais procurados</h2>
      <ul class="mg-tags">
        ${dimPorCampo.time.comPagina.slice(0, 20).map((e) => `<li><a href="/times/${e.slug}/">${esc(e.rotulo)}</a></li>`).join('\n        ')}
      </ul>
      <h2>Competições em destaque</h2>
      <ul class="mg-tags">
        ${dimPorCampo.campeonato.comPagina.slice(0, 16).map((e) => `<li><a href="/campeonatos/${e.slug}/">${esc(e.rotulo)}</a></li>`).join('\n        ')}
      </ul>
    </section>

    <section class="mg-bloco">
      <h2>De onde vêm as informações</h2>
      <p>Os registros são compilados a partir de súmulas, almanaques, sites oficiais de clubes e federações e da imprensa esportiva. Erros acontecem: se você encontrar um dado incorreto, use a <a href="/contato/">página de contato</a> para avisar — correções são aplicadas e o registro é revisado.</p>
      <p>Saiba mais <a href="/sobre/">sobre o projeto e o critério editorial</a>.</p>
    </section>
  </article>`;

  const html = pagina({
    url: '/',
    titulo: 'MundoGol',
    tituloAba: `MundoGol — ${DADOS.length} curiosidades do futebol mundial`,
    descricao: `Acervo com ${DADOS.length} curiosidades do futebol mundial em formato de jogo. Sorteie fatos e navegue por time, país, campeonato, jogador e década.`,
    conteudo,
    antesDoMain: hero,
    jsonLd: [{
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: CFG.nome,
      url: CFG.origem,
      inLanguage: 'pt-BR',
      description: `Acervo de ${DADOS.length} curiosidades do futebol mundial.`,
    }],
  })
    // o bundle so manipula #root; carrega uma unica vez, com defer
    .replace('</head>', '<script defer src="/bundle.js"></script>\n</head>');

  escreve('index.html', html);
  registraUrl('/', '1.0', 'weekly');
  contadorPaginas++;
}

/* --------------------------------------------------- paginas institucionais */

const institucionais = [
  {
    dir: 'sobre',
    titulo: 'Sobre o MundoGol',
    descricao: 'Quem mantém o MundoGol, como o acervo de curiosidades do futebol é montado e qual é o critério editorial do site.',
    corpo: `
    <section class="mg-bloco">
      <h2>O projeto</h2>
      <p>O MundoGol é um projeto independente que reúne curiosidades do futebol mundial em um formato de consulta rápida. A ideia surgiu da dificuldade de encontrar, em um só lugar, fatos bem contextualizados sobre clubes menores, competições regionais e jogadores que não aparecem nas manchetes — informação que costuma estar dispersa em almanaques, arquivos de federações e reportagens antigas.</p>
      <p>Hoje o acervo tem ${DADOS.length} registros, classificados por time, país, campeonato, jogador e década. O site oferece duas formas de uso: um jogo que sorteia curiosidades ao acaso, com filtros, e um conjunto de páginas de leitura organizadas por tema.</p>
    </section>

    <section class="mg-bloco">
      <h2>Quem mantém</h2>
      <p>O site é mantido por ${esc(CFG.responsavel)}, desenvolvedor web. O MundoGol não tem vínculo, patrocínio ou representação de nenhum clube, liga, federação, CBF ou FIFA. Nomes, marcas e escudos citados pertencem a seus respectivos titulares e são mencionados em caráter informativo.</p>
    </section>

    <section class="mg-bloco">
      <h2>Critério editorial</h2>
      <p>Cada registro do acervo segue três regras:</p>
      <ul class="mg-bullets">
        <li><strong>Ser verificável.</strong> Só entram fatos que podem ser conferidos em súmulas, registros oficiais de clubes e federações, almanaques ou imprensa esportiva. Boatos, lendas urbanas e "dizem que" ficam de fora.</li>
        <li><strong>Ser específico.</strong> Um registro precisa dizer o quê, quem e quando. Afirmações vagas não são aproveitadas.</li>
        <li><strong>Ser contextualizado.</strong> Sempre que a informação existe, o registro é classificado por time, país, competição, jogador e década, para que o leitor saiba onde aquele fato se encaixa.</li>
      </ul>
      <p>Registros duplicados são removidos e entidades com grafias diferentes são unificadas, para que o mesmo clube não apareça repartido em duas páginas.</p>
    </section>

    <section class="mg-bloco">
      <h2>Correções</h2>
      <p>Este é um acervo em construção e erros são possíveis. Se você identificar um dado incorreto, incompleto ou desatualizado, escreva pela <a href="/contato/">página de contato</a> indicando o registro e, se possível, a fonte correta. Toda correção recebida é verificada antes de ser aplicada.</p>
    </section>

    <section class="mg-bloco">
      <h2>Como o site se sustenta</h2>
      <p>O MundoGol é gratuito e se mantém com publicidade exibida em algumas páginas. Os anúncios são identificados como tal e não interferem no conteúdo editorial: nenhum registro do acervo é incluído, alterado ou removido em função de anunciantes. Detalhes sobre cookies e dados usados pela publicidade estão na <a href="/politica-de-privacidade/">Política de Privacidade</a>.</p>
    </section>`,
  },
  {
    dir: 'contato',
    titulo: 'Contato',
    descricao: 'Canais de contato do MundoGol para correções de conteúdo, dúvidas, parcerias e solicitações relacionadas a dados pessoais.',
    corpo: `
    <section class="mg-bloco">
      <h2>Fale com a gente</h2>
      <p>O MundoGol é mantido por uma pessoa só, então as respostas não são imediatas — mas todas as mensagens são lidas. O prazo médio de retorno é de até 5 dias úteis.</p>
      <p class="mg-destaque">E-mail: <a href="mailto:${esc(CFG.email)}">${esc(CFG.email)}</a></p>
      <p>Responsável: ${esc(CFG.responsavel)} · Brasil</p>
    </section>

    <section class="mg-bloco">
      <h2>Para que serve cada assunto</h2>
      <ul class="mg-bullets">
        <li><strong>Correção de conteúdo.</strong> Encontrou um dado errado? Escreva com o assunto "Correção", cite o texto do registro e, se puder, indique a fonte correta. Esse é o tipo de mensagem mais útil que podemos receber.</li>
        <li><strong>Sugestão de curiosidade.</strong> Envie o fato e a fonte. Sugestões sem fonte verificável não entram no acervo.</li>
        <li><strong>Direitos autorais.</strong> Se você entende que algum conteúdo publicado viola direitos seus, escreva com o assunto "Direitos autorais" descrevendo o material e a base da reclamação. Conteúdo contestado é analisado e, quando pertinente, removido.</li>
        <li><strong>Privacidade e dados pessoais.</strong> Pedidos de acesso, correção ou exclusão de dados previstos na LGPD devem usar o assunto "Privacidade". Veja também a <a href="/politica-de-privacidade/">Política de Privacidade</a>.</li>
        <li><strong>Publicidade e parcerias.</strong> Propostas comerciais pelo mesmo e-mail, com o assunto "Parceria".</li>
      </ul>
    </section>`,
  },
  {
    dir: 'politica-de-privacidade',
    titulo: 'Política de Privacidade',
    descricao: 'Como o MundoGol trata dados pessoais, cookies e publicidade, conforme a LGPD (Lei 13.709/2018).',
    corpo: `
    <p class="mg-intro">Esta política descreve como o MundoGol (${esc(CFG.origem)}) trata informações de quem visita o site. Ela se aplica a todas as páginas do domínio e está alinhada à Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018).</p>
    <p><strong>Última atualização:</strong> ${HOJE.split('-').reverse().join('/')}</p>

    <section class="mg-bloco">
      <h2>1. Quem é o responsável</h2>
      <p>O tratamento de dados descrito aqui é de responsabilidade de ${esc(CFG.responsavel)}, que opera o MundoGol. Contato para assuntos de privacidade: <a href="mailto:${esc(CFG.email)}">${esc(CFG.email)}</a>.</p>
    </section>

    <section class="mg-bloco">
      <h2>2. Que dados coletamos</h2>
      <p>O MundoGol <strong>não exige cadastro e não pede nome, e-mail, CPF ou qualquer dado pessoal para que você use o site</strong>. As curiosidades e os filtros funcionam sem identificação.</p>
      <p>Os dados tratados se limitam a:</p>
      <ul class="mg-bullets">
        <li><strong>Dados técnicos de navegação</strong>, coletados automaticamente pelos serviços descritos abaixo: endereço IP, tipo e versão do navegador, sistema operacional, idioma, páginas visitadas, data e hora do acesso e site de origem.</li>
        <li><strong>Preferências do jogo</strong>, guardadas no seu próprio navegador (armazenamento local) para lembrar filtros e cartas já exibidas. Essa informação não sai do seu dispositivo e não é enviada a nós.</li>
        <li><strong>Dados que você envia voluntariamente</strong>, se decidir nos escrever por e-mail: o endereço de e-mail e o conteúdo da mensagem.</li>
      </ul>
    </section>

    <section class="mg-bloco">
      <h2>3. Cookies e tecnologias semelhantes</h2>
      <p>Cookies são pequenos arquivos gravados no navegador. O MundoGol utiliza:</p>
      <ul class="mg-bullets">
        <li><strong>Cookies necessários</strong>, ligados ao funcionamento básico e à segurança do site.</li>
        <li><strong>Cookies de publicidade</strong>, definidos por parceiros de anúncios para exibir e medir campanhas.</li>
      </ul>
      <p>Você pode bloquear ou apagar cookies nas configurações do seu navegador. O site continua funcionando com os cookies desativados; apenas os anúncios ficam menos relevantes.</p>
    </section>

    <section class="mg-bloco">
      <h2>4. Publicidade — Google AdSense</h2>
      <p>Este site exibe anúncios fornecidos pelo Google AdSense. A respeito disso:</p>
      <ul class="mg-bullets">
        <li>O Google, como fornecedor terceirizado, utiliza cookies para veicular anúncios no MundoGol.</li>
        <li>O uso do cookie DART pelo Google permite veicular anúncios com base em visitas anteriores a este e a outros sites na internet.</li>
        <li>Você pode desativar a publicidade personalizada nas <a href="https://www.google.com/settings/ads" rel="nofollow noopener" target="_blank">Configurações de anúncios do Google</a>.</li>
        <li>Alternativamente, é possível desativar o uso de cookies por outros fornecedores em <a href="https://www.aboutads.info/choices/" rel="nofollow noopener" target="_blank">aboutads.info/choices</a>.</li>
        <li>As práticas de privacidade do Google estão descritas na <a href="https://policies.google.com/technologies/ads" rel="nofollow noopener" target="_blank">Política de Privacidade e Termos do Google</a>.</li>
      </ul>
      <p>Terceiros que anunciam no site podem usar cookies e web beacons próprios para medir a eficácia de suas campanhas. O MundoGol não tem acesso nem controle sobre esses cookies.</p>
    </section>

    <section class="mg-bloco">
      <h2>5. Medição de audiência</h2>
      <p>Podemos usar ferramentas de estatística de acesso para entender quais páginas são mais visitadas e melhorar o acervo. Esses dados são analisados de forma agregada e não são usados para identificar visitantes individualmente.</p>
    </section>

    <section class="mg-bloco">
      <h2>6. Para que usamos os dados e com que base legal</h2>
      <ul class="mg-bullets">
        <li><strong>Manter o site no ar, seguro e funcionando</strong> — legítimo interesse (art. 7º, IX, da LGPD).</li>
        <li><strong>Exibir e medir publicidade</strong> — consentimento, manifestado nas preferências de anúncio e de cookies do seu navegador.</li>
        <li><strong>Responder mensagens que você nos envia</strong> — legítimo interesse e execução do próprio pedido.</li>
      </ul>
      <p>Não vendemos dados pessoais e não usamos os dados coletados para tomar decisões automatizadas sobre você.</p>
    </section>

    <section class="mg-bloco">
      <h2>7. Compartilhamento</h2>
      <p>Os dados técnicos de navegação são tratados pelos parceiros necessários ao funcionamento do site: o Google (publicidade) e o provedor de hospedagem, que registra logs de acesso. Fora esses casos e as hipóteses de obrigação legal ou ordem judicial, não compartilhamos informações com terceiros. Parte desse tratamento ocorre em servidores fora do Brasil, conforme as políticas dos respectivos fornecedores.</p>
    </section>

    <section class="mg-bloco">
      <h2>8. Por quanto tempo guardamos</h2>
      <p>Logs de acesso são mantidos pelo período técnico necessário e depois descartados. Mensagens enviadas por e-mail são mantidas enquanto o assunto estiver em aberto. Cookies têm prazos próprios, definidos por quem os cria, e podem ser apagados por você a qualquer momento.</p>
    </section>

    <section class="mg-bloco">
      <h2>9. Seus direitos</h2>
      <p>A LGPD garante a você o direito de confirmar a existência de tratamento, acessar seus dados, corrigir dados incompletos ou desatualizados, solicitar anonimização, bloqueio ou eliminação, pedir portabilidade, obter informação sobre compartilhamentos e revogar o consentimento. Para exercer qualquer um desses direitos, escreva para <a href="mailto:${esc(CFG.email)}">${esc(CFG.email)}</a> com o assunto "Privacidade". Responderemos em até 15 dias.</p>
    </section>

    <section class="mg-bloco">
      <h2>10. Crianças e adolescentes</h2>
      <p>O MundoGol é um site de conteúdo informativo sobre futebol, adequado a todos os públicos, mas não é direcionado a crianças e não coleta conscientemente dados de menores de 13 anos.</p>
    </section>

    <section class="mg-bloco">
      <h2>11. Links para outros sites</h2>
      <p>Algumas páginas trazem links para sites externos. Ao seguir esses links, você passa a estar sujeito às políticas de privacidade desses sites, sobre as quais não temos controle.</p>
    </section>

    <section class="mg-bloco">
      <h2>12. Alterações desta política</h2>
      <p>Esta política pode ser atualizada para refletir mudanças no site ou na legislação. A data de última atualização no topo sempre indica a versão vigente. Mudanças relevantes serão sinalizadas na página inicial.</p>
    </section>`,
  },
  {
    dir: 'termos-de-uso',
    titulo: 'Termos de Uso',
    descricao: 'Condições de uso do site MundoGol: conteúdo, propriedade intelectual, limitações de responsabilidade e contato.',
    corpo: `
    <p class="mg-intro">Ao acessar o MundoGol (${esc(CFG.origem)}), você concorda com as condições abaixo. Se não concordar com algum ponto, recomendamos não utilizar o site.</p>
    <p><strong>Última atualização:</strong> ${HOJE.split('-').reverse().join('/')}</p>

    <section class="mg-bloco">
      <h2>1. Objeto</h2>
      <p>O MundoGol é um site informativo e gratuito que reúne curiosidades sobre futebol, apresentadas em formato de jogo e em páginas de leitura. O acesso não exige cadastro nem pagamento.</p>
    </section>

    <section class="mg-bloco">
      <h2>2. Conteúdo e exatidão</h2>
      <p>As informações são compiladas de fontes públicas — registros de clubes e federações, almanaques e imprensa esportiva — e revisadas antes da publicação. Ainda assim, o conteúdo é oferecido "no estado em que se encontra", sem garantia de exatidão absoluta ou de atualização permanente. Não nos responsabilizamos por decisões tomadas exclusivamente com base no que é publicado aqui. Erros identificados podem ser comunicados pela <a href="/contato/">página de contato</a> e são corrigidos após verificação.</p>
    </section>

    <section class="mg-bloco">
      <h2>3. Propriedade intelectual</h2>
      <p>Os textos, a organização do acervo, o layout e o código do MundoGol são de titularidade do responsável pelo site. Nomes de clubes, competições, escudos e marcas citados pertencem a seus respectivos titulares e aparecem apenas em caráter informativo e referencial, sem qualquer vínculo, patrocínio ou representação.</p>
      <p>É permitido citar trechos do site com indicação da fonte e link para a página de origem. A reprodução integral ou substancial do acervo, por qualquer meio, depende de autorização prévia.</p>
    </section>

    <section class="mg-bloco">
      <h2>4. Uso adequado</h2>
      <p>Ao usar o site, você se compromete a não tentar comprometer sua segurança ou disponibilidade, não realizar coleta automatizada em massa do conteúdo (raspagem) sem autorização e não utilizar o material para fins ilícitos.</p>
    </section>

    <section class="mg-bloco">
      <h2>5. Publicidade e links externos</h2>
      <p>O site exibe anúncios de terceiros para custear sua manutenção. O MundoGol não endossa e não se responsabiliza por produtos, serviços ou conteúdos de anunciantes e de sites externos vinculados por links.</p>
    </section>

    <section class="mg-bloco">
      <h2>6. Disponibilidade</h2>
      <p>Trabalhamos para manter o site sempre acessível, mas ele pode ficar temporariamente indisponível por manutenção, falha técnica ou motivos alheios ao nosso controle, sem que isso gere direito a indenização.</p>
    </section>

    <section class="mg-bloco">
      <h2>7. Privacidade</h2>
      <p>O tratamento de dados pessoais e o uso de cookies estão descritos na <a href="/politica-de-privacidade/">Política de Privacidade</a>, que integra estes Termos.</p>
    </section>

    <section class="mg-bloco">
      <h2>8. Alterações e foro</h2>
      <p>Estes Termos podem ser atualizados a qualquer momento, com indicação da nova data de vigência. Aplica-se a legislação brasileira, ficando eleito o foro do domicílio do usuário para dirimir eventuais controvérsias.</p>
    </section>

    <section class="mg-bloco">
      <h2>9. Contato</h2>
      <p>Dúvidas sobre estes Termos: <a href="mailto:${esc(CFG.email)}">${esc(CFG.email)}</a>.</p>
    </section>`,
  },
];

for (const p of institucionais) {
  const url = `/${p.dir}/`;
  escreve(path.join(p.dir, 'index.html'), pagina({
    url,
    titulo: p.titulo,
    tituloAba: `${p.titulo} | MundoGol`,
    descricao: p.descricao,
    migalhas: [{ nome: p.titulo, url }],
    conteudo: `<article class="mg-artigo mg-texto">
    <h1>${esc(p.titulo)}</h1>
    ${p.corpo}
  </article>`,
  }));
  registraUrl(url, '0.5', 'yearly');
  contadorPaginas++;
}

/* ------------------------------------------------------------------- 404 */
escreve('404.html', pagina({
  url: '/404.html',
  titulo: 'Página não encontrada',
  tituloAba: 'Página não encontrada | MundoGol',
  descricao: 'A página procurada não existe ou mudou de endereço. Volte ao início do MundoGol ou use o índice do acervo de curiosidades do futebol.',
  conteudo: `<article class="mg-artigo mg-texto">
    <h1>Essa bola saiu pela linha de fundo</h1>
    <p class="mg-intro">A página que você procurou não existe ou mudou de endereço. Alguns caminhos para voltar ao jogo:</p>
    <ul class="mg-bullets">
      <li><a href="/">Página inicial e baralho de curiosidades</a></li>
      <li><a href="/curiosidades/">Índice completo do acervo</a></li>
      ${DIMENSOES.map((d) => `<li><a href="/${d.base}/">Curiosidades por ${esc(d.singular)}</a></li>`).join('\n      ')}
    </ul>
  </article>`,
}));

/* --------------------------------------------------- robots, sitemap, ads */

escreve('robots.txt', `User-agent: *
Allow: /

User-agent: Mediapartners-Google
Allow: /

Sitemap: ${CFG.origem}/sitemap.xml
`);

escreve('ads.txt', `google.com, pub-${CFG.pubId.replace('ca-pub-', '')}, DIRECT, f08c47fec0942fa0
`);

escreve('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlsSitemap.map((u) => `  <url>
    <loc>${CFG.origem}${u.url}</loc>
    <lastmod>${HOJE}</lastmod>
    <changefreq>${u.freq}</changefreq>
    <priority>${u.prioridade}</priority>
  </url>`).join('\n')}
</urlset>
`);

/* ------------------------------------------------------------------- css */
escreve('assets/mundogol.css', fs.readFileSync(path.join(__dirname, 'mundogol.css'), 'utf8'));

/* ---------------------------------------------------------------- relatorio */

console.log(`\nSite gerado em ${SAIDA}`);
console.log(`  curiosidades no acervo : ${DADOS.length} (${bruto.length - DADOS.length} duplicadas removidas)`);
console.log(`  paginas HTML           : ${contadorPaginas + 1} (inclui 404)`);
console.log(`  URLs no sitemap        : ${urlsSitemap.length}`);
for (const d of DIMENSOES) {
  console.log(`  ${d.base.padEnd(12)} : ${d.comPagina.length} paginas / ${d.entidades.length} entidades`);
}
console.log('');
