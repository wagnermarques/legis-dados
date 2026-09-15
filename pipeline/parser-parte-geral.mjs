/**
 * Parser da Parte Geral do Código Penal compilado (Planalto) para
 * { estrutura, dispositivos, avisos } — ver schema/estrutura.schema.json e
 * schema/dispositivo.schema.json.
 *
 * ESCOPO: só a Parte Geral (Art. 1º a Art. 120). A Parte Especial (Art. 121
 * em diante) tem muitíssimo mais densidade de alterações/revogações por
 * crime específico (ex.: feminicídio no art. 121) e fica pra uma próxima
 * rodada, com conferência redobrada — ver docs/parte-especial-pendente.md.
 *
 * Decisão de escopo em relação ao schema v1: o tipo "caput" existe no
 * enum de `tipo` para o dia em que for necessário distinguir "art. X" de
 * "art. X, caput" como âncoras citáveis separadas, mas este parser NÃO cria
 * um dispositivo "caput" à parte — o texto de abertura do artigo (antes do
 * primeiro parágrafo/inciso, ou o artigo inteiro quando não há
 * subdivisão) vira o próprio `texto` do dispositivo `tipo: "artigo"`.
 * Reavaliar se/quando o app precisar citar "caput" separadamente do artigo.
 */
import { htmlParaBlocos } from './html-texto.mjs'
import { extrairNotas } from './nota-alteracao.mjs'

const ROTULO_TIPO_ESTRUTURA = [
  ['PARTE', /^PARTE\b/i],
  ['subsecao', /^SUBSE[ÇC][ÃA]O\b/i],
  ['secao', /^SE[ÇC][ÃA]O\b/i],
  ['capitulo', /^CAP[ÍI]TULO\b/i],
  ['titulo', /^T[ÍI]TULO\b/i],
].map(([tipo, re]) => [tipo === 'PARTE' ? 'parte' : tipo, re])

const NIVEL = { parte: 0, titulo: 1, capitulo: 2, secao: 3, subsecao: 4 }

const RE_ARTIGO = /^Art\.?\s*(\d+)([ºoO°])?(?:-([A-Za-z]))?\.?\s*[-–.]?\s*([\s\S]*)$/
const RE_PARAGRAFO = /^§\s*(\d+)[ºoO°]?\.?\s*[-–.]?\s*([\s\S]*)$/
const RE_PARAGRAFO_UNICO = /^Par[aá]grafo\s+[uú]nico\.?\s*[-–.]?\s*([\s\S]*)$/i
const RE_INCISO = /^([IVXLCDM]+)\s*[-–.]\s*([\s\S]*)$/
const RE_ALINEA = /^([a-z])\)\s*([\s\S]*)$/
const RE_NOTA_ISOLADA = /^\([\s\S]*\)$/

const VALOR_ROMANO = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 }

function romanoParaInteiro(s) {
  let total = 0
  for (let i = 0; i < s.length; i++) {
    const atual = VALOR_ROMANO[s[i]]
    const proximo = VALOR_ROMANO[s[i + 1]]
    total += proximo > atual ? -atual : atual
  }
  return total
}

function juntarLinhas(primeiraSobra, linhas) {
  return [primeiraSobra, ...linhas.slice(1)].join(' ').replace(/\s+/g, ' ').trim()
}

/** Achata um bloco (possivelmente multi-linha) numa linha só e descarta
 *  qualquer nota de alteração no fim — usado pra rubrica pendente, que
 *  pode carregar sua própria nota (ex.: "Eficácia de sentença estrangeira
 *  (Redação dada pela Lei nº 7.209, de 11.7.1984)"), irrelevante aqui
 *  porque o schema não versiona rubrica separadamente do dispositivo. */
function limparRubrica(bloco) {
  const linhaUnica = bloco
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join(' ')
  return extrairNotas(linhaUnica).texto
}

export function parseParteGeral(html, { capturadoEm, dataPublicacaoNorma }) {
  const blocos = htmlParaBlocos(html)

  const inicio = blocos.findIndex((b) => b.split('\n')[0].trim().toUpperCase() === 'PARTE GERAL')
  const fim = blocos.findIndex((b) => b.split('\n')[0].trim().toUpperCase() === 'PARTE ESPECIAL')
  if (inicio === -1 || fim === -1 || fim <= inicio) {
    throw new Error('Marcadores "PARTE GERAL"/"PARTE ESPECIAL" não encontrados no HTML.')
  }

  const raiz = []
  const pilha = [] // [{ tipo, no }] — containers de estrutura abertos, do mais externo ao mais interno
  const dispositivos = []
  const avisos = []

  let rubricaPendente = null
  let artigoAtual = null
  let paragrafoAtual = null
  let incisoAtual = null
  let alineaAtual = null

  const containerAtual = () => (pilha.length ? pilha[pilha.length - 1].no.filhos : raiz)

  function abrirEstrutura(tipo, rotulo) {
    while (pilha.length && NIVEL[pilha[pilha.length - 1].tipo] >= NIVEL[tipo]) pilha.pop()
    const no = { tipo, rotulo, rubrica: null, filhos: [] }
    containerAtual().push(no)
    pilha.push({ tipo, no })
    return no
  }

  function novoDispositivo({ id, tipo, rotulo, rubrica, pai, textoBruto }) {
    const { texto: textoExtraido, notas } = extrairNotas(textoBruto)
    const observacoes = []
    let versao = {
      texto: textoExtraido,
      vigenteDesde: dataPublicacaoNorma,
      vigenteAte: null,
      evento: 'original',
      origem: null,
      vigenciaConfirmada: false,
      capturadoEm,
      fonte: 'planalto',
    }

    // "vetado" pesa mais que "incluído": um parágrafo incluído por lei mas
    // vetado pela Presidência nunca chegou a viger — é isso, e não
    // "incluído", que descreve seu estado de verdade (ex.: §§ 1º/4º dos
    // arts. 44/45). "Revogado" também deve vencer "incluído"/"redação
    // dada" de uma nota anterior no mesmo dispositivo.
    const PRIORIDADE_EVENTO = { original: 0, incluido: 1, 'redacao-dada': 1, renumerado: 1, revogado: 2, vetado: 3 }

    for (const { bruta, interpretada } of notas) {
      if (!interpretada) {
        observacoes.push(bruta)
        continue
      }
      if (PRIORIDADE_EVENTO[interpretada.evento] >= PRIORIDADE_EVENTO[versao.evento]) {
        versao = { ...versao, evento: interpretada.evento }
      }
      if (interpretada.origem) versao = { ...versao, origem: interpretada.origem }
      if (interpretada.vigenteDesde) versao = { ...versao, vigenteDesde: interpretada.vigenteDesde }
      if (!interpretada.origem && interpretada.evento !== 'vetado') {
        observacoes.push(`Nota de alteração sem data completa (dia/mês) — revisar manualmente: "${bruta}"`)
      }
    }

    // Dispositivo revogado/vetado sem nenhum texto residual (real: ex.
    // §§ 1º/2º do art. 51) — schema exige texto não-vazio, e a interface
    // de leitura precisa de algo pra mostrar de qualquer forma.
    if (!versao.texto) {
      versao = { ...versao, texto: versao.evento === 'vetado' ? '(Vetado)' : '(Revogado)' }
    }

    dispositivos.push({ id, tipo, rotulo, rubrica, pai, versoes: [versao], observacoes })
  }

  for (const bloco of blocos.slice(inicio, fim)) {
    const linhas = bloco.split('\n').map((l) => l.trim()).filter(Boolean)
    const primeira = linhas[0]

    const estruturaNestaLinha = (linha) => ROTULO_TIPO_ESTRUTURA.find(([, re]) => re.test(linha))

    if (estruturaNestaLinha(primeira)) {
      // Um bloco pode empilhar várias linhas estruturais (ex.: "PARTE
      // GERAL" / "TÍTULO I" / "DA APLICAÇÃO DA LEI PENAL" todas no mesmo
      // <p>, separadas só por <br>) — a última linha "solta" (que não é
      // ela mesma um cabeçalho nem uma nota entre parênteses) é a rubrica
      // do nível mais fundo aberto neste bloco.
      let noAberto = null
      for (const linha of linhas) {
        const match = estruturaNestaLinha(linha)
        if (match) {
          noAberto = abrirEstrutura(match[0], linha)
        } else if (RE_NOTA_ISOLADA.test(linha)) {
          // Nota de alteração da divisão em si — schema v1 não versiona
          // divisões estruturais, descarta.
        } else if (noAberto && noAberto.rubrica === null) {
          noAberto.rubrica = linha
        } else {
          avisos.push(`Linha estrutural não classificada: "${linha}"`)
        }
      }
      rubricaPendente = null
      continue
    }

    const artigoMatch = primeira.match(RE_ARTIGO)
    if (artigoMatch) {
      const [, numero, ordinal, letra, resto] = artigoMatch
      const id = letra ? `art${numero}-${letra.toLowerCase()}` : `art${numero}`
      const rotulo = `Art. ${numero}${ordinal ? 'º' : ''}${letra ? `-${letra.toUpperCase()}` : ''}`
      const rubrica = rubricaPendente ? limparRubrica(rubricaPendente) : null

      novoDispositivo({
        id,
        tipo: 'artigo',
        rotulo,
        rubrica,
        pai: null,
        textoBruto: juntarLinhas(resto, linhas),
      })
      containerAtual().push({ tipo: 'artigo', rotulo, rubrica, id, filhos: [] })

      artigoAtual = id
      paragrafoAtual = null
      incisoAtual = null
      alineaAtual = null
      rubricaPendente = null
      continue
    }

    const paruMatch = primeira.match(RE_PARAGRAFO_UNICO)
    const parMatch = !paruMatch && primeira.match(RE_PARAGRAFO)
    if (paruMatch || parMatch) {
      const numero = parMatch ? parMatch[1] : null
      const id = numero ? `${artigoAtual}_par${numero}` : `${artigoAtual}_paru`
      const rotulo = numero ? `§ ${numero}º` : 'Parágrafo único'

      novoDispositivo({
        id,
        tipo: 'paragrafo',
        rotulo,
        rubrica: null,
        pai: artigoAtual,
        textoBruto: juntarLinhas(paruMatch ? paruMatch[1] : parMatch[2], linhas),
      })
      paragrafoAtual = id
      incisoAtual = null
      alineaAtual = null
      rubricaPendente = null
      continue
    }

    const incisoMatch = primeira.match(RE_INCISO)
    if (incisoMatch && /^[IVXLCDM]+$/.test(incisoMatch[1]) && romanoParaInteiro(incisoMatch[1]) > 0) {
      const numero = romanoParaInteiro(incisoMatch[1])
      const pai = paragrafoAtual ?? artigoAtual
      const id = `${pai}_inc${numero}`

      novoDispositivo({
        id,
        tipo: 'inciso',
        rotulo: `${incisoMatch[1]} –`,
        rubrica: null,
        pai,
        textoBruto: juntarLinhas(incisoMatch[2], linhas),
      })
      incisoAtual = id
      alineaAtual = null
      rubricaPendente = null
      continue
    }

    const alineaMatch = primeira.match(RE_ALINEA)
    if (alineaMatch) {
      const letra = alineaMatch[1]
      const pai = incisoAtual ?? paragrafoAtual ?? artigoAtual
      const id = `${pai}_alin-${letra}`

      novoDispositivo({
        id,
        tipo: 'alinea',
        rotulo: `${letra})`,
        rubrica: null,
        pai,
        textoBruto: juntarLinhas(alineaMatch[2], linhas),
      })
      alineaAtual = id
      rubricaPendente = null
      continue
    }

    if (RE_NOTA_ISOLADA.test(primeira) && linhas.length === 1) {
      // Nota solta não colada ao fim do texto do dispositivo anterior —
      // vira observação dele em vez de um dispositivo próprio.
      const ultimo = dispositivos[dispositivos.length - 1]
      if (ultimo) ultimo.observacoes.push(primeira.slice(1, -1).trim())
      else avisos.push(`Nota solta sem dispositivo anterior: "${primeira}"`)
      continue
    }

    // Texto livre não reconhecido (tipicamente a rubrica do próximo
    // artigo) — se já havia uma pendente sem ter sido usada, alguma coisa
    // não bateu com o esperado; registra pra revisão manual.
    if (rubricaPendente !== null) {
      avisos.push(`Rubrica pendente descartada (bloco seguinte não era um artigo): "${rubricaPendente}"`)
    }
    rubricaPendente = bloco
  }

  return { estrutura: raiz, dispositivos, avisos }
}
