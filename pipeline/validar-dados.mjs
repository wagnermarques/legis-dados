#!/usr/bin/env node
// Valida todo arquivo em dados/ contra o schema correspondente
// (schema/*.schema.json). Rodado no CI a cada PR — nenhum dado entra em
// main sem passar por aqui primeiro.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'

// strictRequired desligado só porque estrutura.schema.json usa if/then pra
// exigir "id" apenas quando tipo=artigo — "id" já está em "properties" no
// nível do objeto todo, mas o Ajv em modo estrito não enxerga isso através
// do allOf. O resto do modo estrito continua ligado.
const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false })
addFormats(ajv)

const SCHEMAS_POR_ARQUIVO = {
  'norma.json': 'schema/norma.schema.json',
  'estrutura.json': 'schema/estrutura.schema.json',
  'dispositivos.json': 'schema/dispositivo.schema.json',
  'indice.json': 'schema/indice.schema.json',
}

const validadores = Object.fromEntries(
  Object.entries(SCHEMAS_POR_ARQUIVO).map(([arquivo, caminhoSchema]) => [
    arquivo,
    ajv.compile(JSON.parse(readFileSync(caminhoSchema, 'utf-8'))),
  ]),
)

function* caminhosJson(dir) {
  for (const entrada of readdirSync(dir)) {
    const caminho = join(dir, entrada)
    if (statSync(caminho).isDirectory()) yield* caminhosJson(caminho)
    else if (caminho.endsWith('.json')) yield caminho
  }
}

let tudoValido = true
let algumArquivoEncontrado = false

for (const caminho of caminhosJson('dados')) {
  const nomeArquivo = caminho.split('/').pop()
  const validar = validadores[nomeArquivo]
  if (!validar) {
    console.warn(`? ${caminho} — nenhum schema conhecido para "${nomeArquivo}", pulando`)
    continue
  }

  algumArquivoEncontrado = true
  const dados = JSON.parse(readFileSync(caminho, 'utf-8'))
  if (validar(dados)) {
    console.log(`✓ ${caminho}`)
  } else {
    tudoValido = false
    console.error(`✗ ${caminho}`)
    for (const erro of validar.errors) {
      console.error(`  ${erro.instancePath || '/'} ${erro.message}`)
    }
  }
}

if (!algumArquivoEncontrado) {
  console.log('Nenhum arquivo de dados em dados/ ainda (esperado antes do D2) — nada para validar.')
}
if (!tudoValido) {
  process.exit(1)
}
