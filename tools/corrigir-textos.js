#!/usr/bin/env node
/**
 * Corrige textos danificados por um "substituir tudo" de nomes de clube que
 * pegou nomes de cidade por engano — "Porto Alegre" virou "FC Porto Alegre",
 * "Vila Nova-GO" virou "Vila Nova-MG-GO".
 *
 * Aplica as correcoes em tools/curiosidades.json e tambem no bundle.js
 * publicado, onde os mesmos textos estao embutidos como literais.
 *
 * Uso: node tools/corrigir-textos.js
 */

const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');

/** trechos literais errados e sua forma correta */
const CORRECOES = [
  ['FC Porto Alegre', 'Porto Alegre'],
  ['Vila Nova-MG-GO', 'Vila Nova-GO'],
];

/* ------------------------------------------------------ curiosidades.json */

const arqDados = path.join(__dirname, 'curiosidades.json');
const dados = JSON.parse(fs.readFileSync(arqDados, 'utf8'));

let registrosAlterados = 0;
const detalhes = [];
for (const item of dados) {
  const antes = item.texto;
  let depois = antes;
  for (const [de, para] of CORRECOES) depois = depois.split(de).join(para);
  if (depois !== antes) {
    item.texto = depois;
    registrosAlterados++;
    detalhes.push(`  id ${item.id} (${item.time || item.pais})`);
  }
}

if (registrosAlterados) {
  fs.writeFileSync(arqDados, JSON.stringify(dados, null, 1), 'utf8');
}
console.log(`curiosidades.json: ${registrosAlterados} registros corrigidos`);
detalhes.forEach((d) => console.log(d));

/* ---------------------------------------------------------------- bundle */

const arqBundle = path.join(RAIZ, 'bundle.js');
if (fs.existsSync(arqBundle)) {
  let bundle = fs.readFileSync(arqBundle, 'utf8');
  let ocorrencias = 0;
  for (const [de, para] of CORRECOES) {
    const partes = bundle.split(de);
    ocorrencias += partes.length - 1;
    bundle = partes.join(para);
  }
  if (ocorrencias) {
    // guarda o original uma unica vez, para dar pra voltar atras
    const backup = arqBundle + '.original';
    if (!fs.existsSync(backup)) fs.copyFileSync(arqBundle, backup);
    fs.writeFileSync(arqBundle, bundle, 'utf8');
  }
  console.log(`bundle.js: ${ocorrencias} ocorrencias corrigidas` +
    (ocorrencias ? ' (original salvo em bundle.js.original)' : ''));
} else {
  console.log('bundle.js nao encontrado — pulei');
}

/* --------------------------------------------------------- conferencia */

const restantes = [];
for (const [de] of CORRECOES) {
  const n = dados.filter((d) => d.texto.includes(de)).length;
  if (n) restantes.push(`${de}: ${n}`);
}
console.log(restantes.length ? `\nAINDA HA OCORRENCIAS: ${restantes.join(', ')}` : '\nNenhuma ocorrencia restante.');
