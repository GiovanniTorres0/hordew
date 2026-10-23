# Transforma as imagens escolhidas em sprites do jogo.
# Uso: python arte/recortar.py
# Para cada sprite com "escolha" em sprites.json: tira o fundo magenta, limpa a borda rosada,
# recorta, espelha se preciso ("espelhar": true) e redimensiona para o tamanho final.
# Sprites com "roupa": true ganham também <chave>_roupa.png, a camisa em tons de cinza para o jogo pintar.
# Personagens que andam viram uma folha de 4 quadros lado a lado (parado, passada, passada contrária, ataque),
# feitos deformando o próprio desenho aprovado: assim o boneco é idêntico em todos os quadros.
# Escreve assets/sprites/*.png e src/sprites.js (lista do que existe, lida pelo BootScene).
import colorsys, json, os
import numpy as np
from PIL import Image
from scipy import ndimage

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
SAIDA = os.path.join(RAIZ, "assets", "sprites")


def mascara_fundo(rgb):
    """True onde é fundo: região magenta/rosa ligada às bordas da imagem (inclui a sombra rosa escura),
    mais os vãos fechados (entre braço e corpo) com a mesma cor do fundo."""
    f = rgb.astype(np.float32) / 255
    r, g, b = f[..., 0], f[..., 1], f[..., 2]
    mx, mn = f.max(-1), f.min(-1)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    # Matiz entre magenta e rosa (295° a 355°), inclusive a vinheta escura de algumas sementes.
    # Vermelho, ruivo e pele ficam perto de 0° (ou acima de 355°) e não entram.
    croma = np.maximum(mx - mn, 1e-6)
    matiz = np.where(mx == r, ((g - b) / croma) % 6, np.where(mx == g, (b - r) / croma + 2, (r - g) / croma + 4)) * 60
    rosa = (matiz > 295) & (matiz < 355) & (sat > 0.22) & (mx > 0.18)
    rotulos, n = ndimage.label(rosa)
    borda = np.unique(np.concatenate([rotulos[0], rotulos[-1], rotulos[:, 0], rotulos[:, -1]]))
    borda = borda[borda > 0]
    fundo = np.isin(rotulos, borda)
    if not fundo.any():
        return fundo
    # Vãos fechados: magenta forte como o do fundo (o rosa claro de um coelho tem pouca saturação e fica)
    sat_fundo = np.median(sat[fundo])
    for i in set(range(1, n + 1)) - set(borda.tolist()):
        regiao = rotulos == i
        if regiao.sum() > 80 and np.median(sat[regiao]) > max(0.4, sat_fundo * 0.75):
            fundo |= regiao
    return fundo


def recortar(caminho, s):
    img = Image.open(caminho).convert("RGB")
    rgb = np.array(img)
    fundo = mascara_fundo(rgb)
    if s.get("fundo_largo"):
        # Sombra rosa escura e pouco saturada colada ao objeto (ex.: base da árvore): cresce o fundo por ela
        f = rgb.astype(np.float32) / 255
        mx, mn = f.max(-1), f.min(-1)
        rosado = (f[..., 0] > f[..., 1] + 0.03) & (f[..., 2] > f[..., 1] + 0.02) & ((mx - mn) > 0.05)
        fundo = ndimage.binary_propagation(fundo, mask=fundo | rosado)
    corpo = ~fundo
    # Remove ilhas soltas (respingos, restos de sombra) e fica com o personagem
    rotulos, n = ndimage.label(corpo)
    if n > 1:
        tamanhos = ndimage.sum(corpo, rotulos, range(1, n + 1))
        corpo = np.isin(rotulos, 1 + np.flatnonzero(tamanhos >= tamanhos.max() * 0.03))
    alfa = corpo.astype(np.float32)
    # Borda suave e sem rosa: tira o magenta dos pixels perto do fundo
    perto = corpo & ndimage.binary_dilation(~corpo, iterations=3)
    f = rgb.astype(np.float32)
    m = np.minimum(f[..., 0], f[..., 2])
    excesso = np.clip(m - f[..., 1], 0, None)
    for c in (0, 2):
        f[..., c] = np.where(perto, f[..., c] - excesso * 0.85, f[..., c])
    if s.get("fundo_largo"):
        # Objeto cinza e marrom (árvore): o rosa que sobra vira avermelhado ou lilás; corta o excesso
        f[..., 2] = np.minimum(f[..., 2], f[..., 1] + 4)
        f[..., 0] = np.minimum(f[..., 0], f[..., 1] + 8)
    alfa = ndimage.gaussian_filter(alfa, 0.7) * corpo + 0
    rgba = np.dstack([np.clip(f, 0, 255), alfa * 255]).astype(np.uint8)

    ys, xs = np.nonzero(corpo)
    caixa = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
    sprite = Image.fromarray(rgba, "RGBA").crop(caixa)
    roupa = None
    if s.get("roupa"):
        roupa = mascara_roupa(rgb[caixa[1]:caixa[3], caixa[0]:caixa[2]], corpo[caixa[1]:caixa[3], caixa[0]:caixa[2]])
    if s.get("espelhar"):
        sprite = sprite.transpose(Image.FLIP_LEFT_RIGHT)
        roupa = roupa and roupa.transpose(Image.FLIP_LEFT_RIGHT)
    w, h = sprite.size
    k = s["tamanho"] / (w if s.get("medida") == "largura" else h)
    tam = (max(1, round(w * k)), max(1, round(h * k)))
    if not anima(s):
        return sprite.resize(tam, Image.LANCZOS), roupa and roupa.resize(tam, Image.LANCZOS), None
    quadril = s.get("quadril", 0.62 if s.get("pet") else 0.58)
    folha = lambda im: folha_quadros(np.array(im), quadril, s.get("pet"), k)
    sprite, quadro = folha(sprite)
    return sprite, roupa and folha(roupa)[0], quadro


def ladrilho(caminho, s):
    """Textura de chão contínua: mistura a imagem com ela mesma deslocada meia volta, com peso 1 no meio
    e 0 nas bordas. Nas bordas fica a parte deslocada, que já emenda com o ladrilho vizinho."""
    a = np.array(Image.open(caminho).convert("RGB").resize((512, 512), Image.LANCZOS)).astype(np.float32)
    n = a.shape[0]
    t = np.abs(np.arange(n) - (n - 1) / 2) / (n / 2)       # 0 no meio, 1 na borda
    peso = np.clip((1 - t) * 2.2, 0, 1)
    peso = np.minimum.outer(peso, peso)[..., None]
    rolada = np.roll(a, (n // 2, n // 2), axis=(0, 1))
    out = a * peso + rolada * (1 - peso)
    # Chão é fundo: contraste reduzido (s["contraste"], padrão 0,5) para não brigar com os personagens
    media = out.reshape(-1, 3).mean(0)
    out = media + (out - media) * s.get("contraste", 0.5)
    return Image.fromarray(out.clip(0, 255).astype(np.uint8), "RGB").resize((s["tamanho"],) * 2, Image.LANCZOS)


def anima(s):
    """Quem anda ganha quadros: zumbis, jogadores e pets de quatro patas (o gavião voa, só ginga)."""
    return s.get("animar", not s.get("modelo"))


def deslocar_linhas(a, desl):
    """Empurra cada linha da imagem para o lado (desl[y] em px, positivo = para a direita)."""
    out = np.zeros_like(a)
    w = a.shape[1]
    for y, d in enumerate(np.round(desl).astype(int)):
        if d >= 0:
            out[y, d:] = a[y, :w - d]
        else:
            out[y, :w + d] = a[y, -d:]
    return out


def folha_quadros(a, quadril, pet, k):
    """Folha com 4 quadros do mesmo tamanho: parado, passada, passada contrária e ataque (tronco inclinado
    para a frente, pernas em passada). A largura ganha folga dos dois lados para a inclinação caber."""
    h, w = a.shape[:2]
    folga = int(max(w * 0.15, h * 0.12)) + 2
    a = np.pad(a, ((0, 0), (folga, folga), (0, 0)))
    W = a.shape[1]
    y0 = int(h * quadril)
    linhas = np.arange(h)
    descida = np.clip((linhas - y0) / max(1, h - y0), 0, 1)  # 0 no quadril, 1 nos pés
    subida = np.clip((y0 - linhas) / max(1, y0), 0, 1)       # 0 no quadril, 1 no topo da cabeça
    # Divide as pernas em frente (direita) e trás pelo centro do que existe abaixo do quadril
    cols = np.nonzero(a[y0:, :, 3].sum(0) > 0)[0]
    cx = int((cols.min() + cols.max()) / 2) if len(cols) else W // 2
    frente = a.copy(); frente[:, :cx] = 0
    tras = a.copy(); tras[:, cx:] = 0
    passo = h * (0.09 if pet else 0.075)

    def passada(sinal):
        pf = deslocar_linhas(frente, sinal * descida * passo)
        pt = deslocar_linhas(tras, -sinal * descida * passo)
        # A perna da frente fica por cima da de trás
        return np.where(pf[..., 3:4] > 0, pf, pt)

    def ataque():
        corpo = passada(1)
        return deslocar_linhas(corpo, subida * h * 0.09)

    quadros = [a, passada(1), passada(-1), ataque()]
    folha = Image.fromarray(np.concatenate(quadros, axis=1), "RGBA")
    fw, fh = max(1, round(W * k)), max(1, round(h * k))
    return folha.resize((fw * 4, fh), Image.LANCZOS), [fw, fh]


def mascara_roupa(rgb, corpo):
    """Camisa branca: pixels claros e pouco saturados abaixo da cabeça. Sai em cinza com alfa."""
    f = rgb.astype(np.float32) / 255
    mx, mn = f.max(-1), f.min(-1)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    h = rgb.shape[0]
    linhas = np.arange(h)[:, None]
    clara = corpo & (sat < 0.22) & (mx > 0.55) & (linhas > h * 0.3) & (linhas < h * 0.8)
    # Só a maior mancha (a camisa), sem pegar olhos ou detalhes soltos
    # As hachuras cortam a camisa em pedaços: junta antes de escolher (a 1024 px os traços têm ~6 px)
    rotulos, n = ndimage.label(ndimage.binary_closing(clara, iterations=6))
    if n:
        tamanhos = ndimage.sum(clara, rotulos, range(1, n + 1))
        clara &= np.isin(rotulos, 1 + np.flatnonzero(tamanhos >= tamanhos.max() * 0.15))
    cinza = (mx * 255).astype(np.uint8)
    alfa = (ndimage.gaussian_filter(clara.astype(np.float32), 0.8) * clara * 255).astype(np.uint8)
    return Image.fromarray(np.dstack([cinza, cinza, cinza, alfa]), "RGBA")


def main():
    cfg = json.load(open(os.path.join(AQUI, "sprites.json"), encoding="utf-8"))
    os.makedirs(SAIDA, exist_ok=True)
    # Começa do zero: um sprite que perdeu a aprovação não pode ficar esquecido na pasta
    for antigo in os.listdir(SAIDA):
        if antigo.endswith(".png"):
            os.remove(os.path.join(SAIDA, antigo))
    feitos, roupas, quadros = [], [], {}
    for chave, s in cfg["sprites"].items():
        if "escolha" not in s:
            continue
        bruto = os.path.join(AQUI, "bruto", f"{chave}_{s['escolha']}.png")
        sprite, roupa, quadro = (ladrilho(bruto, s), None, None) if s.get("textura") else recortar(bruto, s)
        sprite.save(os.path.join(SAIDA, f"{chave}.png"), optimize=True)
        feitos.append(chave)
        if quadro:
            quadros[chave] = quadro
        if roupa:
            roupa.save(os.path.join(SAIDA, f"{chave}_roupa.png"), optimize=True)
            roupas.append(chave)
        print(f"{chave}: {sprite.size[0]}x{sprite.size[1]}")
    with open(os.path.join(RAIZ, "src", "sprites.js"), "w", encoding="utf-8") as js:
        js.write("// Gerado por arte/recortar.py: sprites desenhados que existem em assets/sprites.\n")
        js.write("// Texturas que não estão aqui continuam sendo desenhadas por código (textures.js).\n")
        js.write(f"const SPRITE_KEYS = {json.dumps(feitos)};\n")
        js.write(f"const ROUPA_KEYS = {json.dumps(roupas)};\n")
        js.write("// Folhas de animação: tamanho de cada quadro [largura, altura]; quadros 0 parado, 1 e 2 passada, 3 ataque\n")
        js.write(f"const ANIM_FRAMES = {json.dumps(quadros)};\n")


if __name__ == "__main__":
    main()
