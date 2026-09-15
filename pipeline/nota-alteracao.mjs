/**
 * Extrai as notas de alteração — "(Redação dada pela Lei nº 7.209, de
 * 11.7.1984)", "(Incluído pela Lei nº 13.964, de 2019)", "(Revogado pela
 * Lei nº 11.106, de 2005)", "(VETADO)", "(Vide ...)" — do fim do texto de
 * um dispositivo, separando o texto "limpo" (requisito da pesquisa: sem
 * nota de alteração misturada) da informação estruturada de versão.
 *
 * "vetado" não estava no schema v1 original — descoberto ao rodar contra o
 * texto real (§ 1º/§ 4º dos arts. 44/45: dispositivo incluído por lei mas
 * vetado pela Presidência, nunca chegou a viger). Acrescentado ao enum
 * `evento` do schema.
 */

const RE_NOTA_FINAL = /\s*\(([^()]*)\)\s*$/

const RE_EVENTO = [
  [/^redação\s+dada/i, 'redacao-dada'],
  [/^inclu[ií]d[oa]/i, 'incluido'],
  [/^revogad[oa]/i, 'revogado'],
  [/^renumerad[oa]/i, 'renumerado'],
  [/^vetado$/i, 'vetado'],
]

// "Lei nº 7.209, de 11.7.1984" | "Lei nº 13.964, de 2019" | "Lei nº 9.268,
// de 1º.4.1996" — número da lei + data (dia.mês.ano completos, ou só ano).
const RE_LEI_DATA =
  /Lei\s*n[ºo°]?\s*([\d.]+)\s*,?\s*de\s+(?:(1[ºo°]|\d{1,2})\.(\d{1,2})\.(\d{4})|(\d{4}))/i

function normalizarNumeroLei(bruto) {
  return bruto.replace(/\./g, '')
}

function paraDataISO(dia, mes, ano) {
  const d = dia.replace(/[ºo°]/, '').padStart(2, '0')
  const m = mes.padStart(2, '0')
  return `${ano}-${m}-${d}`
}

/** Tenta reconhecer uma nota isolada (o conteúdo já sem os parênteses) como
 *  alteração de lei. Devolve null quando não reconhece (ex.: "Vide ADPF
 *  779", "Vigência") — essas viram observação em vez de evento/origem. */
function interpretarNota(nota) {
  const evento = RE_EVENTO.find(([re]) => re.test(nota))?.[1]
  if (!evento) return null

  const leiMatch = nota.match(RE_LEI_DATA)
  if (!leiMatch) return { evento, origem: null, vigenteDesde: null }

  const [, numero, dia, mes, ano, soAno] = leiMatch
  const urn = `urn:lex:br:federal:lei:${
    dia ? paraDataISO(dia, mes, ano) : `${soAno}`
  };${normalizarNumeroLei(numero)}`

  return {
    evento,
    // Só forma uma URN "completa" (data-lei) quando a nota tem dia e mês;
    // só-ano fica sem origem estruturada — mais seguro que inventar 1º de
    // janeiro. Revisão humana completa depois (vigenciaConfirmada).
    origem: dia ? urn : null,
    vigenteDesde: dia ? paraDataISO(dia, mes, ano) : null,
    notaBruta: nota,
  }
}

/** { texto, notas[] } — texto limpo (sem os parênteses finais) e a lista de
 *  notas encontradas, na ordem em que apareciam (pode haver mais de uma,
 *  ex.: "(Incluído pela Lei nº 13.964, de 2019) (Vide ADPF 779)"). */
export function extrairNotas(textoBruto) {
  let texto = textoBruto.trim()
  const notas = []

  let m
  while ((m = texto.match(RE_NOTA_FINAL))) {
    notas.unshift(m[1].trim())
    texto = texto.slice(0, m.index).trim()
  }

  return {
    texto,
    notas: notas.map((nota) => ({ bruta: nota, interpretada: interpretarNota(nota) })),
  }
}
