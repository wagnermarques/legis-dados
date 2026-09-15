#!/usr/bin/env node
// Lê um snapshot já capturado do Código Penal compilado (Planalto) e
// escreve norma.json/estrutura.json/dispositivos.json em dados/, mais uma
// entrada em dados/indice.json. Só a Parte Geral por enquanto — ver
// pipeline/parser-parte-geral.mjs.
//
// Uso: node pipeline/importar-parte-geral.mjs [caminho-do-snapshot.html]
// Sem argumento, usa o snapshot mais recente em
// snapshots/br/federal/decreto-lei/1940-2848/planalto/.
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { parseParteGeral } from './parser-parte-geral.mjs'

const CAMINHO_NORMA = 'br/federal/decreto-lei/1940-2848'
const DIR_SNAPSHOTS = resolve(`snapshots/${CAMINHO_NORMA}/planalto`)
const DIR_DADOS = resolve(`dados/${CAMINHO_NORMA}`)

function snapshotMaisRecente() {
  const arquivos = readdirSync(DIR_SNAPSHOTS).filter((f) => f.endsWith('.html'))
  if (!arquivos.length) throw new Error(`Nenhum snapshot em ${DIR_SNAPSHOTS}`)
  return join(DIR_SNAPSHOTS, arquivos.sort().at(-1))
}

const caminhoSnapshot = resolve(process.argv[2] ?? snapshotMaisRecente())
const capturadoEm = caminhoSnapshot.match(/(\d{4}-\d{2}-\d{2})\.html$/)?.[1]
if (!capturadoEm) {
  throw new Error(`Não consegui extrair a data do nome do snapshot: ${caminhoSnapshot}`)
}

const html = readFileSync(caminhoSnapshot, 'utf-8')
const dataPublicacaoNorma = '1940-12-31'
const { estrutura, dispositivos, avisos } = parseParteGeral(html, { capturadoEm, dataPublicacaoNorma })

if (avisos.length) {
  console.warn(`${avisos.length} aviso(s) do parser — revisar antes de confiar no resultado:`)
  for (const aviso of avisos) console.warn(` - ${aviso}`)
}

const norma = {
  urn: 'urn:lex:br:federal:decreto.lei:1940-12-07;2848',
  nome: 'Código Penal',
  ementa: 'Institui o Código Penal.',
  dataPublicacao: dataPublicacaoNorma,
  fonte: 'planalto',
  urlFonte: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del2848compilado.htm',
  capturadoEm,
}

mkdirSync(DIR_DADOS, { recursive: true })
writeFileSync(join(DIR_DADOS, 'norma.json'), JSON.stringify(norma, null, 2) + '\n')
writeFileSync(join(DIR_DADOS, 'estrutura.json'), JSON.stringify(estrutura, null, 2) + '\n')
writeFileSync(join(DIR_DADOS, 'dispositivos.json'), JSON.stringify(dispositivos, null, 2) + '\n')

const caminhoIndice = resolve('dados/indice.json')
let indice = []
try {
  indice = JSON.parse(readFileSync(caminhoIndice, 'utf-8'))
} catch {
  // primeiro import — dados/indice.json ainda não existe.
}
indice = indice.filter((n) => n.urn !== norma.urn)
indice.push({ urn: norma.urn, nome: norma.nome, caminho: CAMINHO_NORMA })
writeFileSync(caminhoIndice, JSON.stringify(indice, null, 2) + '\n')

console.log(`OK: ${dispositivos.length} dispositivos (Parte Geral) escritos em dados/${CAMINHO_NORMA}/`)
