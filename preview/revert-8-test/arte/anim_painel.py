# Monta o painel de avaliação dos quadros do Kontext: uma linha por semente com o original e cada pose,
# todos na MESMA escala do sprite aprovado e apoiados pelos pés, mais uma sobreposição (onion skin)
# para ver se o boneco pula de lugar ou muda de tamanho, e um GIF do ciclo de passada e do ataque.
# Uso: python arte/anim_painel.py <chave>
# Saída: arte/bruto/painel/anim_<chave>.png, anim_<chave>_<semente>_andar.gif e _ataque.gif
import glob, json, os, re, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
from recortar import AQUI, mascara_fundo

CHAO = (96, 112, 70, 255)
POSES = ["passo_a", "passo_b", "ataque"]


def recorte(caminho, espelhar):
    """RGBA do personagem sem fundo, no enquadramento original (sem cortar), já virado para a direita."""
    rgb = np.array(Image.open(caminho).convert("RGB").resize((1024, 1024)))
    corpo = ~mascara_fundo(rgb)
    rot, n = ndimage.label(corpo)
    if n > 1:
        t = ndimage.sum(corpo, rot, range(1, n + 1))
        corpo = np.isin(rot, 1 + np.flatnonzero(t >= t.max() * 0.03))
    im = Image.fromarray(np.dstack([rgb, corpo * 255]).astype(np.uint8), "RGBA")
    return im.transpose(Image.FLIP_LEFT_RIGHT) if espelhar else im


def pes(im):
    """Ponto de apoio: base do corpo e centro horizontal dos 12% de baixo (onde estão os pés)."""
    a = np.array(im)[..., 3] > 0
    ys, xs = np.nonzero(a)
    y1 = ys.max()
    baixo = a[int(y1 - (y1 - ys.min()) * 0.12):y1 + 1]
    return xs.min(), ys.min(), xs.max(), y1, np.nonzero(baixo)[1].mean()


def main():
    chave = sys.argv[1]
    s = json.load(open(os.path.join(AQUI, "sprites.json"), encoding="utf-8"))["sprites"][chave]
    esp = s.get("espelhar", False)
    base = recorte(os.path.join(AQUI, "bruto", f"{chave}_{s['escolha']}.png"), esp)
    bx0, by0, bx1, by1, bcx = pes(base)
    k = s["tamanho"] / (by1 - by0)  # mesma escala do sprite aprovado
    esc = 3  # o painel mostra o tamanho real ampliado 3x
    W, H = int(1024 * k * esc * 0.9), int((by1 - by0) * k * esc * 1.5)

    def quadro(im):
        """Personagem na escala do jogo (ampliada), com os pés no mesmo ponto do original."""
        x0, y0, x1, y1, cx = pes(im)
        r = im.resize((max(1, int(1024 * k * esc)),) * 2, Image.LANCZOS)
        q = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        dx = W / 2 - cx * k * esc
        dy = H - 6 - y1 * k * esc
        q.alpha_composite(r, (int(dx), int(dy)))
        return q

    arquivos = sorted(glob.glob(os.path.join(AQUI, "bruto", "anim", f"{chave}_*_*.png")))
    sementes = sorted({int(re.search(r"_(\d+)\.png$", a).group(1)) for a in arquivos})
    q_base = quadro(base)
    linhas = []
    for sem in sementes:
        qs = {"original": q_base}
        for p in POSES:
            c = os.path.join(AQUI, "bruto", "anim", f"{chave}_{p}_{sem}.png")
            if os.path.exists(c):
                qs[p] = quadro(recorte(c, esp))
        # Onion skin: original em azul, passos em vermelho e verde, para ver deslocamento e tamanho
        onion = Image.new("RGBA", (W, H), CHAO)
        for nome, cor in [("original", (80, 140, 255)), ("passo_a", (255, 90, 90)), ("passo_b", (90, 255, 120))]:
            if nome in qs:
                m = np.array(qs[nome])[..., 3] > 0
                cam = np.zeros((H, W, 4), np.uint8)
                cam[m] = (*cor, 110)
                onion.alpha_composite(Image.fromarray(cam, "RGBA"))
        linha = Image.new("RGBA", (W * 5, H + 22), (25, 22, 30, 255))
        d = ImageDraw.Draw(linha)
        for i, nome in enumerate(["original"] + POSES):
            if nome in qs:
                fundo = Image.new("RGBA", (W, H), CHAO)
                fundo.alpha_composite(qs[nome])
                linha.paste(fundo, (i * W, 22))
            d.text((i * W + 4, 4), f"s{sem} {nome}", fill=(255, 230, 120))
        linha.paste(onion, (4 * W, 22))
        d.text((4 * W + 4, 4), "sobreposicao (azul=orig)", fill=(255, 230, 120))
        linhas.append(linha)
        # GIFs no tamanho real ampliado
        def gif(nomes, sufixo, ms):
            fr = []
            for n in nomes:
                f = Image.new("RGBA", (W, H), CHAO)
                f.alpha_composite(qs[n])
                fr.append(f.convert("RGB"))
            fr[0].save(os.path.join(AQUI, "bruto", "painel", f"anim_{chave}_{sem}_{sufixo}.gif"),
                       save_all=True, append_images=fr[1:], duration=ms, loop=0)
        if "passo_a" in qs and "passo_b" in qs:
            gif(["passo_a", "original", "passo_b", "original"], "andar", 140)
        if "ataque" in qs:
            gif(["original", "ataque"], "ataque", 260)
    painel = Image.new("RGBA", (W * 5, sum(l.height for l in linhas)), (25, 22, 30, 255))
    y = 0
    for l in linhas:
        painel.paste(l, (0, y))
        y += l.height
    os.makedirs(os.path.join(AQUI, "bruto", "painel"), exist_ok=True)
    painel.convert("RGB").save(os.path.join(AQUI, "bruto", "painel", f"anim_{chave}.png"))
    print(f"painel: {len(sementes)} sementes, quadro {W}x{H}")


if __name__ == "__main__":
    main()
