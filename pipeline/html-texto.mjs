/**
 * HTML bruto do Planalto -> lista de blocos de texto puro (um bloco por
 * <p>, com <br> virando quebra "fraca" dentro do mesmo bloco).
 *
 * O documento tem quebras de linha *literais* soltas por todo lado (CRLF do
 * editor original) — por isso o whitespace do arquivo-fonte é colapsado
 * ANTES de olhar pras tags. Sem isso, cada <br> seguido de uma dessas
 * quebras vira um parágrafo em branco espúrio (bug real encontrado ao
 * inspecionar a captura real: a primeira tentativa "perdia" a contagem
 * certa de artigos por causa disso).
 */

// Entidades nomeadas realmente usadas no documento (conferido na captura).
const ENTIDADES_NOMEADAS = { nbsp: ' ', quot: '"', amp: '&', lt: '<', gt: '>' }

// Referências numéricas na faixa 0x80–0x9F seguem a tabela de
// compatibilidade do HTML5 (herdada do Windows-1252), não Unicode direto —
// é assim que navegadores de verdade interpretam &#150; etc., e é exatamente
// o que aparece no documento (ex.: &#150; = travessão usado depois do
// algarismo romano dos incisos).
const CP1252_C1 = {
  128: 0x20ac, 130: 0x201a, 131: 0x0192, 132: 0x201e, 133: 0x2026,
  134: 0x2020, 135: 0x2021, 136: 0x02c6, 137: 0x2030, 138: 0x0160,
  139: 0x2039, 140: 0x0152, 142: 0x017d, 145: 0x2018, 146: 0x2019,
  147: 0x201c, 148: 0x201d, 149: 0x2022, 150: 0x2013, 151: 0x2014,
  152: 0x02dc, 153: 0x2122, 154: 0x0161, 155: 0x203a, 156: 0x0153,
  158: 0x017e, 159: 0x0178,
}

function decodeEntidades(s) {
  return s
    .replace(/&#(\d+);/g, (_, d) => {
      const n = Number(d)
      return String.fromCodePoint(CP1252_C1[n] ?? n)
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&([a-z]+);/gi, (m, nome) => ENTIDADES_NOMEADAS[nome.toLowerCase()] ?? m)
}

export function htmlParaBlocos(html) {
  let s = html.replace(/\s+/g, ' ')
  s = s.replace(/<br\s*\/?>/gi, '\n')
  s = s.replace(/<\/?p\b[^>]*>/gi, '\n\n')
  s = s.replace(/<[^>]+>/g, '')
  s = decodeEntidades(s)
  s = s.replace(/ /g, ' ')
  s = s.replace(/[ \t]+/g, ' ')
  s = s.replace(/ *\n */g, '\n')
  s = s.replace(/\n{3,}/g, '\n\n')
  // Combining marks (á = a + U+0301 etc.) viram forma precomposta, senão
  // busca/comparação de texto quebra de formas inesperadas.
  s = s.normalize('NFC')

  return s
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)
}
