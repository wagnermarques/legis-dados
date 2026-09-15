# snapshots/

Guarda a captura bruta (HTML, sempre convertido para UTF-8 — **do
Windows-1252, não ISO-8859-1**, ver `../docs/parte-especial-pendente.md`)
de cada fonte, para auditoria e reprocessamento — mesma estrutura de
caminho de `../dados/`, com um arquivo por data de captura:
`br/<esfera>/<tipo>/<identificador>/<fonte>/AAAA-MM-DD.html`.

Os testes golden em `../pipeline/parser-parte-geral.test.mjs` rodam contra
o snapshot `2026-09-15.html` do Código Penal — não apagar/mover sem
atualizar os testes.
