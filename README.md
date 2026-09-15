# legis-dados

Pipeline de coleta e conversão + dados versionados das normas usadas pelo
[legisreader](https://github.com/wagnermarques/legisreader) (leitor de
legislação brasileira para estudantes de direito). Ver o
[roadmap do legisreader](https://github.com/wagnermarques/legisreader/blob/main/roadmap.org)
para o plano completo do produto — este README cobre só este repositório.

## Licença

Duas coisas diferentes, duas licenças diferentes:

- **O texto das normas em si** (`dados/`, `snapshots/`) é **domínio público**:
  a Lei nº 9.610/1998, art. 8º, IV, exclui da proteção do direito autoral
  "os textos de tratados ou convenções, leis, decretos, regulamentos,
  decisões judiciais e demais atos oficiais". Use como quiser, sem pedir
  permissão.
- **O código** (`pipeline/`, `schema/`, workflows) é licenciado sob
  [AGPL-3.0-or-later](LICENSE) — mesma decisão do `legisreader` (roadmap,
  seção "Licenciamento"), pelo mesmo motivo do biblereaderapp: uso em rede
  (monitor diário, publicação de releases consumidas por outros apps).

O que **não** é coberto por nenhuma licença aberta: a *seleção e organização*
de terceiros sobre o texto oficial (comentários, anotações, jurisprudência
selecionada) pode ser protegida (Lei nº 9.610/1998, arts. 7º, XIII, e 87) —
por isso este projeto só captura texto de fontes oficiais, nunca de
compilações de terceiros.

## Regra do projeto

Só capturar de fontes oficiais, e guardar sempre de onde e quando cada texto
veio (`fonte` + `capturadoEm` em cada versão de dispositivo — ver
[`schema/dispositivo.schema.json`](schema/dispositivo.schema.json)).

## Fontes (reconferidas em 2026-09-15, marco D1)

| Fonte | URL | Uso no projeto |
|---|---|---|
| Planalto | `https://www.planalto.gov.br/ccivil_03/decreto-lei/del2848compilado.htm` | Texto compilado atual do Código Penal — base da importação (D2) |
| LexML Brasil | `https://www.lexml.gov.br/urn/urn:lex:br:federal:decreto.lei:1940-12-07;2848` | URN LEX (`urn:lex:br:federal:decreto.lei:1940-12-07;2848`) e relações entre normas |
| Imprensa Nacional / DOU (INLABS) | `https://inlabs.in.gov.br/` | Fonte oficial para detecção de leis alteradoras (exige cadastro — credenciais só em secrets do CI, nunca no repositório) |
| Câmara / Senado (dados abertos) | `https://dadosabertos.camara.leg.br/`, `https://legis.senado.leg.br/` | Projetos em tramitação que alteram a norma (fase futura, aviso antecipado) |

A URN e a URL do Planalto foram confirmadas por busca em 2026-09-15; a
disponibilidade e os termos de uso de cada fonte devem ser reconferidos de
novo antes de escrever qualquer coletor de verdade (D2), porque endpoints e
políticas de acesso mudam com o tempo.

### Regras de coleta

- Respeitar `robots.txt` e termos de uso; limitar a frequência (uma captura
  por norma por execução é suficiente).
- Preferir API ou dados abertos a raspar HTML sempre que existir alternativa.
- Credenciais (ex.: cadastro do INLABS) ficam só em *secrets* do GitHub
  Actions deste repositório, nunca versionadas.
- Nenhuma mudança vai para `dados/` sem revisão humana do PR — um erro de
  parser mostrando o artigo errado para um estudante custa mais do que um
  dia de atraso.

## Estrutura

```
fontes/
  br/federal/decreto-lei/1940-2848.yaml   # URN, URL do Planalto, termos de busca no DOU
snapshots/
  br/federal/decreto-lei/1940-2848/planalto/AAAA-MM-DD.html
                                           # captura bruta, para auditoria e reprocessamento
dados/
  br/federal/decreto-lei/1940-2848/
    norma.json         # metadados: URN, ementa, datas, fonte, data da captura
    estrutura.json     # árvore: Parte > Título > Capítulo > Seção > artigos
    dispositivos.json  # todos os dispositivos com suas versões
  indice.json           # lista leve de normas disponíveis
schema/                 # JSON Schema do formato (validado no CI a cada PR)
pipeline/               # scripts Node: capturar, converter, validar, detectar, publicar
docs/
  convencao-ids.md      # como um dispositivo ganha seu id estável
.github/workflows/       # validação de PR contra o schema (monitor diário vem no D3)
```

O caminho dos dados segue a URN do LexML
(`urn:lex:br:federal:decreto.lei:1940-12-07;2848`), só que num formato seguro
para nomes de arquivo. A URN completa fica em `norma.json`. Assim,
acrescentar `br/sp/lei/...` mais tarde não muda nada na estrutura.

## Formato dos dispositivos

Ver [`schema/dispositivo.schema.json`](schema/dispositivo.schema.json)
(normativo) e [`docs/convencao-ids.md`](docs/convencao-ids.md) (como o `id`
de cada dispositivo é montado). Pontos importantes:

- O `id` nunca muda, mesmo com a mudança do texto — favoritos e anotações no
  legisreader apontam para ele.
- `texto` é sempre texto limpo: sem HTML e sem notas de alteração misturadas
  (essas vão para `origem`/`evento`) — requisito da pesquisa do legisreader,
  que senão encontraria centenas de notas ao buscar "Lei".
- Publicação e vigência são coisas diferentes: `vigenciaConfirmada` só vira
  `true` após revisão humana (vacatio legis, vetos).
- Declaração de inconstitucionalidade pelo STF não altera o texto — vira
  `observacoes`, preenchida à mão.

## Como o legisreader consome os dados

Artefato de release, não submódulo: este repositório publica uma release
versionada (ex.: `dados-2026.09.15`) com o conteúdo de `dados/`, e o build do
legisreader baixa uma release *fixada* para `public/data/`. O app é sempre
publicado com dados conhecidos e validados — nunca lendo `main` deste
repositório diretamente.
