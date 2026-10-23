# Hordew

Tower defense de zumbis em 2D para navegador. Escolha seu personagem (José Perdigueiro, Pedro Pedra Preto ou Jussara Tais), compre um pet e defenda a base no centro do mapa contra zumbis que chegam de todos os lados. São 3 níveis (Subúrbio, Centro e Cemitério) com 10 hordas cada, 4 dificuldades e um modo infinito que abre quando você vence um nível.

**Jogue online:** https://giovannitorres0.github.io/hordew/

## Como jogar

| Tecla | Ação |
| --- | --- |
| WASD | Andar |
| Mouse + clique | Mirar e atirar |
| Q | Trocar de arma |
| 1 a 7 | Construir: Sentinela, Tesla, Lança-chamas, Barricada, Espinhos, Mina, Farol |
| Botão direito numa torre ou na base | Upgrades, consertar, vender |
| Esc ou botão direito | Cancelar construção |
| L | Loja (entre hordas): armas, pets e itens |
| Espaço | Chamar a próxima horda (dá bônus) ou se soltar de um Hunter/Jockey |
| P | Pausar |
| U | Ligar ou desligar a música |

## O que tem no jogo

- **Dia e noite:** de dia você constrói; as hordas vêm à noite e só dá para ver o que está iluminado.
- **Zumbis especiais (Left 4 Dead 2):** Boomer, Spitter, Smoker, Hunter, Charger, Jockey, Tank (chefe a cada 10 hordas) e Witch (opcional, dá recompensa). Também tem o Venenoso, com aura tóxica.
- **Torres com upgrades (Bloons TD):** 3 linhas (velocidade, dano, utilidade), no máximo 2 por torre. Zumbis atacam e quebram as construções.
- **Pets:** cachorro (sangramento), crocodilo (mordida forte e camuflagem), gato (rápido), gavião (revela o mapa) e coelho rosa (mais velocidade).
- **Armas (Killing Floor):** MP7, escopeta, pistola .50, AK-47, besta, lança-chamas, M79 e AA-12.
- **Eventos de horda:** neblina, chuva ácida, horda rápida, apagão e horda dupla. Um "diretor" ajusta o tamanho das hordas ao seu desempenho.

## Estrutura

- `index.html`: página para jogar localmente (precisa de internet para carregar o Phaser e a fonte)
- `play.html`: página usada para publicar o jogo como Artifact no claude.ai
- `src/config.js`: números do jogo (vida, velocidade, preços, zumbis, torres, pets, armas, dificuldades)
- `src/waves.js`: composição das hordas e o diretor
- `src/scenes/`: telas (carregamento, menu, preparação, história, partida)
- `src/game/`: lógica de zumbis, construções e pets
- `src/ui.js`: HUD, minimapa, loja e painel de torre
- `src/textures.js`: todos os gráficos, desenhados por código
- `src/sfx.js`: efeitos sonoros sintetizados

Feito com [Phaser 3](https://phaser.io).
