# Hordew

Tower defense de zumbis em 2D para navegador. Você controla o Zé e o cachorro Biscoito e precisa proteger a casa de uma família por 10 hordas em cada um dos 3 níveis (Subúrbio, Centro e Cemitério), até o helicóptero de resgate chegar.

## Como jogar

Abra `index.html` no navegador (precisa de internet para carregar o Phaser e a fonte do título).

| Tecla | Ação |
| --- | --- |
| WASD | Andar |
| Mouse + clique | Mirar e atirar |
| 1 / 2 | Construir torreta / espinhos |
| Esc ou botão direito | Cancelar construção |
| L | Loja (entre hordas) |
| Espaço | Chamar a próxima horda |
| P | Pausar |

## Estrutura

- `index.html`: página para jogar localmente
- `play.html`: página usada para publicar o jogo como Artifact no claude.ai
- `src/config.js`: números do jogo (vida, velocidade, preços, níveis)
- `src/waves.js`: composição das hordas
- `src/scenes/`: telas do jogo (carregamento, menu, história, partida)
- `src/textures.js`: todos os gráficos, desenhados por código
- `src/sfx.js`: efeitos sonoros sintetizados

Feito com [Phaser 3](https://phaser.io).
