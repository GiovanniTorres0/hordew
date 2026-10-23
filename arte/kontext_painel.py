# Painel de avaliação dos desenhos do Kontext que não são animação (armas, casas, estados de dano):
# uma linha por pose com a referência e cada semente recortadas sobre o chão do jogo, em tamanho grande
# e no tamanho real do jogo (canto de cada célula).
# Uso: python arte/kontext_painel.py <chave> <ref relativa a arte/> [pose ...]
# Saída: arte/bruto/painel/kx_<chave>.png
import glob, json, os, re, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
from recortar import AQUI, mascara_fundo

CHAO = (96, 112, 70)
CEL = 360


def recorte(caminho, molde=None):
    rgb = np.array(Image.open(caminho).convert("RGB").resize((1024, 1024)))
    fundo = mascara_fundo(rgb)
    if molde:  # estados de dano: o mesmo corte por silhueta do original que recortar.py faz
        fora = mascara_fundo(np.array(Image.open(molde).convert("RGB").resize((1024, 1024))))
        fundo |= ~ndimage.binary_dilation(~fora, iterations=6)
    alfa = (~fundo) * 255
    im = Image.fromarray(np.dstack([rgb, alfa]).astype(np.uint8), "RGBA")
    return im.crop(im.getbbox() or (0, 0, 1024, 1024))


def celula(caminho, titulo, tamanho, largura, molde=None):
    im = recorte(caminho, molde)
    c = Image.new("RGB", (CEL, CEL), CHAO)
    k = min((CEL - 20) / im.width, (CEL - 60) / im.height)
    g = im.resize((int(im.width * k), int(im.height * k)))
    c.paste(g, ((CEL - g.width) // 2, 30), g)
    # Tamanho real no jogo, no canto de baixo à direita
    kj = tamanho / (im.width if largura else im.height)
    j = im.resize((max(1, int(im.width * kj)), max(1, int(im.height * kj))))
    c.paste(j, (CEL - j.width - 6, CEL - j.height - 6), j)
    ImageDraw.Draw(c).text((8, 6), titulo, fill=(255, 255, 255))
    return c


def main():
    chave, ref = sys.argv[1], sys.argv[2]
    s = json.load(open(os.path.join(AQUI, "sprites.json"), encoding="utf-8"))["sprites"][chave]
    poses = sys.argv[3:] or list(s.get("poses", {}))
    larg = s.get("medida") == "largura"
    linhas = []
    for pose in poses:
        sem = lambda p: int(re.findall(r"_(\d+)\.png$", p)[0])
        arqs = sorted(glob.glob(os.path.join(AQUI, "bruto", "anim", f"{chave}_{pose}_*.png")), key=sem)
        cels = [celula(os.path.join(AQUI, ref), "ref", s["tamanho"], larg)]
        molde = os.path.join(AQUI, ref) if pose.startswith("dano") else None
        cels += [celula(a, f"{pose} s{sem(a)}", s["tamanho"], larg, molde) for a in arqs]
        linhas.append(cels)
    w = max(len(l) for l in linhas) * CEL
    painel = Image.new("RGB", (w, len(linhas) * CEL), (40, 40, 40))
    for y, l in enumerate(linhas):
        for x, c in enumerate(l):
            painel.paste(c, (x * CEL, y * CEL))
    saida = os.path.join(AQUI, "bruto", "painel", f"kx_{chave}.png")
    painel.save(saida)
    print(saida)


if __name__ == "__main__":
    main()
