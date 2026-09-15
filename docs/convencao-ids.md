# Convenção de IDs dos dispositivos

O `id` de um dispositivo é estável para sempre: uma vez atribuído, nunca
muda — nem se o texto mudar, nem se o dispositivo for renumerado. Favoritos
e anotações do legisreader apontam para ele, então mudar um `id` quebraria
tudo que já aponta pra lá.

## Regra geral

`id` é a concatenação do caminho até a raiz (artigo → parágrafo → inciso →
alínea → item), separado por `_`, sempre em minúsculas, sem acento:

| Nível | Prefixo | Exemplo de rótulo | Exemplo de id |
|---|---|---|---|
| artigo | `art` | Art. 121 | `art121` |
| caput | `_caput` | (sem rótulo próprio) | `art121_caput` |
| parágrafo | `_par` | § 2º | `art121_par2` |
| parágrafo único | `_par` | Parágrafo único | `art121_paru` |
| inciso | `_inc` | VI | `art121_par2_inc6` |
| alínea | `_alin` | a) | `art121_par2_inc6_alina` |
| item | `_item` | 1 | `art121_par2_inc6_alina_item1` |
| pena | `_pena` | Pena – reclusão... | `art121_pena` |

Números romanos em rótulos (incisos) viram números decimais no `id` (VI →
`6`), porque romanos de mais de um dígito criam ambiguidade de parsing sem
ganhar nada em legibilidade.

## Artigos com letra (ex.: art. 121-A)

Um artigo acrescentado por lei posterior ganha `id` com a letra anexada
diretamente ao número, sem separador: `art121-a` (letra minúscula, hífen
antes dela — o hífen é o único caractere não-alfanumérico permitido no
segmento do número do artigo). Os níveis abaixo dele seguem a regra normal:
`art121-a_par1`.

## Renumeração

Quando um dispositivo é renumerado (ex.: o que era § 2º vira § 3º por causa
de um parágrafo novo intercalado), o **`id` original não muda**. A mudança
de rótulo entra como uma nova entrada em `versoes` com `"evento":
"renumerado"`, e o `rotulo` no nível do dispositivo passa a refletir o
rótulo atual (o histórico de rótulos, se precisar, fica em `observacoes` —
o schema v1 não versiona `rotulo` separadamente do texto).

## Por que não usar os identificadores do LexML diretamente

O LexML tem seus próprios URNs por dispositivo (`urn:lex:...!art121`), mas
eles descrevem a *localização atual* na hierarquia, não uma referência
opaca e estável — o formato varia entre tipos de norma e nem sempre chega a
inciso/alínea. Preferimos um `id` interno simples e 100% sob nosso
controle, e guardamos a URN da norma inteira em `norma.json` para quem
precisar cruzar com o LexML.

## Validação automática

O schema (`schema/dispositivo.schema.json`) só garante o *formato* do `id`
(`^[a-z0-9_-]+$`). Não há (ainda) uma checagem automática de que o `id`
segue exatamente esta convenção — isso é responsabilidade do parser (D2) e
da revisão humana do PR.
