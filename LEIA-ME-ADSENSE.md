# MundoGol — correções para a reprovação do AdSense

Motivo da reprovação: **"Conteúdo de baixo valor"**.
As alterações já estão aplicadas **nesta pasta** (branch `gh-pages`), que é o que
o GitHub Pages publica em `www.mundogol.com.br`.

---

## 1. O que o Google via no site

O HTML que o robô recebia era este, na íntegra (está preservado em
`index.html.original`):

```html
<!doctype html><html lang="pt-br"><head>…<title>MundoGol</title>…</head>
<body><div id="root"></div><script src="bundle.js"></script></body></html>
```

Ou seja: **página sem uma única linha de conteúdo**. Tudo era montado por
JavaScript depois. Os problemas concretos:

| # | Problema | Situação anterior |
|---|---|---|
| 1 | Conteúdo só existia via JS | HTML entregue tinha ~500 bytes e zero texto |
| 2 | Site com **uma única URL** | Nenhuma outra página no domínio inteiro |
| 3 | Zero links internos | `document.querySelectorAll('a').length === 0` |
| 4 | Sem Política de Privacidade | **Exigência obrigatória do AdSense** (LGPD + cookies) |
| 5 | Sem páginas Sobre e Contato | O Google checa quem responde pelo site |
| 6 | Sem `<h1>` e sem meta description | Nenhum sinal de tema para o robô |
| 7 | `robots.txt`, `sitemap.xml`, `ads.txt` | Todos retornavam **404** |
| 8 | Sem canonical | apex e `www.` disputando a mesma página |
| 9 | 207 curiosidades duplicadas | Conteúdo repetido dentro do próprio acervo |
| 10 | **5 textos corrompidos** | Ver seção 3 |
| 11 | `bundle.js` carregado 2× | Uma vez no `<head>` e outra no `<body>` |

Só os itens 1 a 5 já bastam para a reprovação: para o revisor, o site era uma
página em branco sem responsável identificável.

---

## 2. O que foi feito

**184 páginas HTML** geradas na raiz desta pasta, todas com conteúdo real já no
HTML entregue ao robô:

```
./
├── index.html                    home: jogo + conteúdo estático (25 mil chars)
├── curiosidades/                 índice geral do acervo
├── times/        (56 páginas)    Flamengo, Real Madrid, Corinthians…
├── paises/       (28 páginas)    Brasil, Argentina, Espanha…
├── campeonatos/  (30 páginas)    Copa do Mundo, Brasileirão, Champions…
├── jogadores/    (44 páginas)    Messi, Pelé, Cristiano Ronaldo…
├── decadas/      (14 páginas)    de 1890 a 2020
├── sobre/                        projeto, responsável e critério editorial
├── contato/                      canais e assuntos
├── politica-de-privacidade/      LGPD + cláusulas exigidas pelo AdSense
├── termos-de-uso/
├── 404.html
├── robots.txt · sitemap.xml · ads.txt · .nojekyll
└── bundle.js + assets/           o jogo continua funcionando igual
```

Cada página de conteúdo tem `<h1>`, `<title>` e meta description exclusivos
(validado: 0 duplicados), texto de abertura gerado a partir dos próprios dados,
curiosidades agrupadas por década com `<h2>`, links de contexto em cada fato,
bloco "Explore também" montado por co-ocorrência real, breadcrumbs, canonical,
Open Graph e JSON-LD.

Volume real: a página do Flamengo tem **19.607 caracteres** e 106 fatos. Nenhuma
página ficou abaixo de 1.200 caracteres.

**Arquivos que NÃO foram tocados:** `bundle.js.LICENSE.txt`, `CNAME`,
`323/567/637.bundle.js`, `assets/`, `icone_mundo_gol.ico`, `data.json`.

**Backups criados:** `index.html.original` e `bundle.js.original`.

---

## 3. Correção de conteúdo — importante

Comparando o `data.json` desta pasta (3.683 registros) com os 4.025 embutidos no
`bundle.js` publicado, encontrei **5 textos corrompidos** por um "substituir
tudo" de nomes de clube que pegou nomes de **cidade** por engano:

| id | Estava | Corrigido para |
|---|---|---|
| 91 | Grêmio fundado "em **FC Porto** Alegre" | em Porto Alegre |
| 302 | "São José de **FC Porto** Alegre" | São José de Porto Alegre |
| 1993 | "Internacional de **FC Porto** Alegre" | Internacional de Porto Alegre |
| 2001 | "Internacional de **FC Porto** Alegre" | Internacional de Porto Alegre |
| 287 | "Vila Nova-**MG**-GO" | Vila Nova-GO |

A correção foi aplicada **nas páginas e também dentro do `bundle.js`**, então o
jogo mostra o texto certo. Rode `node tools/corrigir-textos.js` se precisar
repetir.

> **Cuidado com esse tipo de substituição no futuro.** O mesmo processo trocou
> corretamente "Liga dos Campeões" por "Champions League" (23×) e "de Munique"
> por "München" (8×), mas quando o nome do clube também é nome de cidade
> ("Porto", "Vila Nova"), ele estraga o texto. Sempre limite a substituição aos
> campos `time`/`campeonato`, nunca ao campo `texto`.

### Sobre o `data.json`

Ele tem 3.683 registros e **não é lido pelo site** — o `bundle.js` traz os dados
embutidos. Deixei o arquivo intacto. Se ele for a sua base de trabalho, ela está
342 registros atrás do que está no ar; nesse caso me avise que eu sincronizo.
A base corrigida e completa está em `tools/curiosidades.json`.

---

## 4. Ferramentas

```bash
node tools/corrigir-textos.js   # corrige textos danificados (dataset + bundle)
node tools/gerar-site.js        # regera as 184 páginas
node tools/validar-site.js      # confere links, títulos, h1, sitemap, arquivos
```

O validador está passando com **0 problemas** em 34.540 links internos e 1 aviso
cosmético (um título de campeonato com 67 caracteres).

A pasta `tools/` pode ser apagada antes do deploy se você preferir não publicá-la
— ela não é usada pelo site em execução.

---

## 5. O que você precisa fazer

### 5.1 Obrigatório — dados de contato reais

O AdSense verifica se existe um responsável identificável. No topo de
`tools/gerar-site.js`:

```js
const CFG = {
  email: 'contato@mundogol.com.br',   // <-- precisa ser um e-mail que você lê
  responsavel: 'Samuel Oliveira',     // <-- confirme o nome
};
```

Depois rode `node tools/gerar-site.js` de novo. **Não deixe o placeholder** — se
o Google escrever e voltar erro, a revisão é reprovada de novo. Qualquer e-mail
seu que funcione serve.

### 5.2 Publicar

Commit e push desta pasta na branch `gh-pages`. Verifique antes que você está no
repositório certo (`git remote -v` deve apontar para o repositório do MundoGol).

### 5.3 Depois de publicar, confira

- [ ] `https://www.mundogol.com.br/robots.txt` responde 200
- [ ] `https://www.mundogol.com.br/sitemap.xml` responde 200
- [ ] `https://www.mundogol.com.br/ads.txt` responde 200
- [ ] `https://www.mundogol.com.br/politica-de-privacidade/` abre
- [ ] "Ver código-fonte" da home mostra o texto (não só a `<div id="root">`)

### 5.4 Search Console — antes de pedir a revisão

1. Envie o `sitemap.xml` no Google Search Console.
2. Use "Inspeção de URL" em 3 ou 4 páginas novas e clique em **Solicitar indexação**.
3. **Espere as páginas serem indexadas** antes de marcar "Confirmo que corrigi os
   problemas" no AdSense. Pedir revisão com o site ainda não rastreado costuma
   resultar em nova reprovação — e cada reprovação aumenta a espera da seguinte.

Uma semana de intervalo é um prazo razoável.

---

## 6. Riscos que continuam de pé

**Exatidão dos fatos.** As 5 corrupções que achei foram por comparação entre duas
versões do dataset — esse método só enxerga registros que existem nos dois. Nos
541 registros que só existem na versão nova não tenho com o que comparar. Se parte
do acervo foi gerada por IA sem conferência, há risco real: conteúdo não confiável
é exatamente o que a política de "conteúdo de baixo valor" mira. Vale amostrar
umas 30 curiosidades ao acaso e conferir antes de pedir revisão.

**Páginas geradas em massa.** Criar centenas de páginas a partir de um banco de
dados pode ser lido como "conteúdo programático raso". Por isso usei corte mínimo
de 15 registros por página, agrupamento por década, textos de abertura derivados
dos dados e blocos de links relacionados. Ainda assim, quanto mais texto editorial
escrito à mão nas páginas dos times maiores, mais sólido fica o caso.
