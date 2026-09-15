import { readFileSync } from 'node:fs'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { describe, expect, it } from 'vitest'
import { parseParteGeral } from './parser-parte-geral.mjs'

// Snapshot fixo real do Planalto (2026-09-15) — testes golden sobre ele,
// não sobre a rede. Reprocessar este mesmo arquivo tem que sempre dar o
// mesmo resultado.
const SNAPSHOT = readFileSync(
  new URL('../snapshots/br/federal/decreto-lei/1940-2848/planalto/2026-09-15.html', import.meta.url),
  'utf-8',
)
const OPCOES = { capturadoEm: '2026-09-15', dataPublicacaoNorma: '1940-12-31' }

function validarComSchema(schemaFile, dados) {
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false })
  addFormats(ajv)
  const caminho = new URL(`../schema/${schemaFile}`, import.meta.url)
  const validate = ajv.compile(JSON.parse(readFileSync(caminho, 'utf-8')))
  const ok = validate(dados)
  return { ok, errors: validate.errors }
}

describe('parseParteGeral', () => {
  it('não emite avisos (nenhum trecho não reconhecido)', () => {
    const { avisos } = parseParteGeral(SNAPSHOT, OPCOES)
    expect(avisos).toEqual([])
  })

  it('encontra os 121 artigos da Parte Geral (120 numerados + o 91-A)', () => {
    const { dispositivos } = parseParteGeral(SNAPSHOT, OPCOES)
    const artigos = dispositivos.filter((d) => d.tipo === 'artigo')
    expect(artigos).toHaveLength(121)
  })

  it('contagem por tipo bate com a conferência manual desta captura', () => {
    const { dispositivos } = parseParteGeral(SNAPSHOT, OPCOES)
    const porTipo = dispositivos.reduce((acc, d) => ({ ...acc, [d.tipo]: (acc[d.tipo] ?? 0) + 1 }), {})
    expect(porTipo).toEqual({ artigo: 121, paragrafo: 105, inciso: 111, alinea: 56 })
  })

  it('para na fronteira certa: art. 120 dentro, art. 121 fora (Parte Especial)', () => {
    const { dispositivos } = parseParteGeral(SNAPSHOT, OPCOES)
    const ids = new Set(dispositivos.map((d) => d.id))
    expect(ids.has('art120')).toBe(true)
    expect(ids.has('art121')).toBe(false)
  })

  it('artigo com letra ganha id e rótulo próprios (art. 91-A)', () => {
    const { dispositivos } = parseParteGeral(SNAPSHOT, OPCOES)
    const art91a = dispositivos.find((d) => d.id === 'art91-a')
    expect(art91a).toMatchObject({ tipo: 'artigo', rotulo: 'Art. 91-A', pai: null })
  })

  it('artigos 1º a 9º levam o ordinal no rótulo; a partir do 10, não', () => {
    const { dispositivos } = parseParteGeral(SNAPSHOT, OPCOES)
    const by = (id) => dispositivos.find((d) => d.id === id)
    expect(by('art1').rotulo).toBe('Art. 1º')
    expect(by('art9').rotulo).toBe('Art. 9º')
    expect(by('art10').rotulo).toBe('Art. 10')
  })

  it('texto do art. 1º é o texto limpo, sem a nota de alteração', () => {
    const { dispositivos } = parseParteGeral(SNAPSHOT, OPCOES)
    const art1 = dispositivos.find((d) => d.id === 'art1')
    expect(art1.versoes[0].texto).toBe('Não há crime sem lei anterior que o defina. Não há pena sem prévia cominação legal.')
    expect(art1.versoes[0]).toMatchObject({
      evento: 'redacao-dada',
      origem: 'urn:lex:br:federal:lei:1984-07-11;7209',
    })
    expect(art1.rubrica).toBe('Anterioridade da Lei')
  })

  it('dispositivos totalmente revogados (sem texto residual) recebem o marcador "(Revogado)"', () => {
    const { dispositivos } = parseParteGeral(SNAPSHOT, OPCOES)
    for (const id of ['art51_par1', 'art51_par2', 'art107_inc7', 'art107_inc8']) {
      const d = dispositivos.find((d) => d.id === id)
      expect(d.versoes[0].evento).toBe('revogado')
      expect(d.versoes[0].texto).toBe('(Revogado)')
    }
  })

  it('dispositivo incluído por lei mas vetado pela Presidência vira evento "vetado", não "incluido"', () => {
    const { dispositivos } = parseParteGeral(SNAPSHOT, OPCOES)
    for (const id of ['art44_par1', 'art45_par4']) {
      const d = dispositivos.find((d) => d.id === id)
      expect(d.versoes[0].evento).toBe('vetado')
      expect(d.versoes[0].texto).toBe('(Vetado)')
    }
  })

  it('ids são únicos em todo o documento', () => {
    const { dispositivos } = parseParteGeral(SNAPSHOT, OPCOES)
    const ids = dispositivos.map((d) => d.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('só "artigo" tem pai nulo; todo o resto referencia um id existente', () => {
    const { dispositivos } = parseParteGeral(SNAPSHOT, OPCOES)
    const ids = new Set(dispositivos.map((d) => d.id))
    for (const d of dispositivos) {
      if (d.tipo === 'artigo') expect(d.pai).toBeNull()
      else {
        expect(d.pai).not.toBeNull()
        expect(ids.has(d.pai)).toBe(true)
      }
    }
  })

  it('a árvore de estrutura tem as 8 divisões de Título conhecidas da Parte Geral', () => {
    const { estrutura } = parseParteGeral(SNAPSHOT, OPCOES)
    const [parteGeral] = estrutura
    expect(parteGeral.tipo).toBe('parte')
    expect(parteGeral.filhos.filter((f) => f.tipo === 'titulo')).toHaveLength(8)
  })

  it('é idempotente: reprocessar o mesmo snapshot dá exatamente o mesmo resultado', () => {
    const r1 = parseParteGeral(SNAPSHOT, OPCOES)
    const r2 = parseParteGeral(SNAPSHOT, OPCOES)
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2))
  })

  it('dispositivos e estrutura resultantes validam contra o schema v1', () => {
    const { estrutura, dispositivos } = parseParteGeral(SNAPSHOT, OPCOES)
    const dispRes = validarComSchema('dispositivo.schema.json', dispositivos)
    const estRes = validarComSchema('estrutura.schema.json', estrutura)
    expect(dispRes.errors ?? []).toEqual([])
    expect(dispRes.ok).toBe(true)
    expect(estRes.errors ?? []).toEqual([])
    expect(estRes.ok).toBe(true)
  })
})
