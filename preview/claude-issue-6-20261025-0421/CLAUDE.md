# Instruções para o Claude

## Link de teste (obrigatório)

Toda branch enviada para o GitHub é publicada automaticamente pelo workflow `.github/workflows/branch-preview.yml` em:

`https://giovannitorres0.github.io/hordew/preview/<branch>/`

onde `<branch>` é o nome da branch com todo caractere fora de `A-Z a-z 0-9 . _ -` trocado por `-`
(ex.: `claude/issue-3-20261023-0059` → https://giovannitorres0.github.io/hordew/preview/claude-issue-3-20261023-0059/).

Ao terminar uma tarefa de Issue ou PR, **sempre** coloque no começo do seu comentário final uma linha assim, com o link completo da sua branch:

**🧪 Link para testar:** https://giovannitorres0.github.io/hordew/preview/claude-issue-N-AAAAMMDD-HHMM/ (fica pronto em 1 a 2 minutos; use Ctrl+F5)

Não diga que não existe link de teste: o link acima sempre existe depois do push.
Também é possível ver todas as prévias em https://giovannitorres0.github.io/hordew/preview/

## Projeto

Jogo em Phaser 3, sem build: os arquivos são servidos como estão (`index.html`, `src/`). Comentários e textos do jogo em português.
