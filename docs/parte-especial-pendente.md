# Parte Especial: pendente

O D2 (importador do Código Penal) cobre só a **Parte Geral** (Art. 1º a
120, mais o Art. 91-A) por enquanto. A **Parte Especial** (Art. 121 em
diante — os crimes em espécie) fica para uma próxima rodada, de propósito:

- É bem maior (~240 artigos contra ~120) e muito mais densa em
  revogações/inclusões por crime específico — o próprio Art. 121
  (homicídio) já tem art. 121-A e uma cadeia de parágrafos/incisos
  incluídos/alterados por leis recentes (2019, 2024, 2026 — inclusive
  referências cruzadas entre artigos, como o art. 92 § 2º citando o
  art. 121-A).
- É exatamente a parte que um estudante vai consultar com mais frequência
  e que descreve os crimes em si — um erro de parser aqui tem custo maior
  que na Parte Geral (regras gerais, mais estáveis).
- O parser da Parte Geral (`pipeline/parser-parte-geral.mjs`) já cobre a
  maior parte dos casos esperados (artigo com/sem ordinal, artigo com
  letra, parágrafo numerado/único, inciso, alínea, revogado, vetado,
  notas de alteração com data completa ou só ano) — mas a Parte Especial
  tende a ter mais variação ainda (o "item" numerado sob alínea, por
  exemplo, não aparece nem uma vez na Parte Geral, então essa parte do
  parser está implementada mas nunca foi exercitada contra texto real).

## O que fazer quando for a vez da Parte Especial

1. Rodar `pipeline/parser-parte-geral.mjs` (ou uma cópia adaptada) contra o
   trecho `PARTE ESPECIAL` até o fim do documento e conferir a contagem de
   avisos — esperar mais avisos do que os zero da Parte Geral, dada a
   densidade de emendas recentes coladas com marcação de Word (ver o bug
   de encoding abaixo, que essa parte do documento expõe mais).
2. Revisar cuidadosamente os dispositivos com letra (ex.: art. 121-A,
   121-B) e os `tipo: "item"` que aparecerem pela primeira vez.
3. Amostragem manual bem maior que a da Parte Geral, com atenção especial
   a artigos que mudaram recentemente (feminicídio, crimes sexuais,
   etc.) — são os que mais importam pro usuário e os que mais mudaram.

## Achado de encoding que vale lembrar

O HTML do Planalto se declara como charset ocidental de 8 bits, mas usa
bytes do Windows-1252 (não ISO-8859-1 "puro") na faixa 0x80–0x9F — é assim
que travessões, aspas curvas etc. aparecem em trechos colados de fontes
mais modernas (Word). Converter com `iconv -f ISO-8859-1` (em vez de
`-f WINDOWS-1252`) corrompe esses caracteres em caracteres de controle
C1 invisíveis, que por acaso ficam parecendo "espaço" — foi assim que a
Parte Geral escondeu um bug até uma emenda de 2024 expor. Sempre
converter com `WINDOWS-1252` (ou `CP1252`), nunca `ISO-8859-1`, para
qualquer HTML novo do Planalto.
