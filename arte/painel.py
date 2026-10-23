# Monta as folhas de avaliação e roda as checagens automáticas.
# Uso: python arte/painel.py [chave ...]
# Para cada chave: arte/bruto/painel/<chave>.png com cada semente em três versões
# (original, recorte ampliado 2x e recorte no tamanho real sobre o chão de dia e de noite)
# e arte/bruto/painel/metricas.json com os problemas objetivos de cada imagem.
import glob, json, os, re, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from recortar import AQUI, mascara_fundo, recortar  # noqa: E402

PAINEL = os.path.join(AQUI, "bruto", "painel")
CHAO_DIA, CHAO_NOITE = (111, 154, 82), (40, 34, 56)


def metricas(caminho):
    rgb = np.array(Image.open(caminho).convert("RGB"))
    corpo = ~mascara_fundo(rgb)
    rotulos, n = ndimage.label(corpo)
    tamanhos = ndimage.sum(corpo, rotulos, range(1, n + 1)) if n else np.array([0])
    grandes = int((tamanhos >= tamanhos.max() * 0.03).sum())
    h, w = corpo.shape
    ys, xs = np.nonzero(corpo)
    problemas = []
    if not len(ys):
        return {"problemas": ["fundo não reconhecido: nada foi recortado"]}
    na_borda = corpo[:3].sum() + corpo[-3:].sum() + corpo[:, :3].sum() + corpo[:, -3:].sum()
    if na_borda > 30:
        problemas.append("encosta na borda da imagem (provavelmente cortado)")
    if grandes > 1:
        problemas.append(f"{grandes} pedaços separados (mais de um personagem, sombra ou objeto solto)")
    # Maior dimensão: um crocodilo é baixo e comprido, um zumbi é alto e estreito
    altura = max(ys.max() - ys.min(), xs.max() - xs.min()) / h
    if altura < 0.4:
        problemas.append(f"personagem pequeno demais na imagem ({altura:.0%} do quadro)")
    if corpo.mean() > 0.6:
        problemas.append("fundo quase todo tomado (fundo magenta não ficou liso)")
    return {"altura": round(float(altura), 2), "pedacos": grandes, "problemas": problemas}


def folha(chave, s):
    arquivos = sorted(glob.glob(os.path.join(AQUI, "bruto", f"{chave}_*.png")),
                      key=lambda a: int(re.search(r"_(\d+)\.png$", a).group(1)))
    if not arquivos:
        return {}
    col, lin = 300, 300 + 170 + 20
    out = Image.new("RGB", (col * len(arquivos), lin), "white")
    d = ImageDraw.Draw(out)
    resultado = {}
    for i, a in enumerate(arquivos):
        semente = int(re.search(r"_(\d+)\.png$", a).group(1))
        x = i * col
        out.paste(Image.open(a).convert("RGB").resize((col, col)), (x, 0))
        sprite = recortar(a, {**s, "animar": False})[0]  # um quadro só, sem a folha de animação
        # Ampliado 2x (sem suavizar) para ver o acabamento da borda
        grande = sprite.resize((sprite.width * 2, sprite.height * 2), Image.NEAREST)
        caixa = Image.new("RGB", (col // 2, 170), CHAO_DIA)
        caixa.paste(grande, ((caixa.width - grande.width) // 2, max(0, 165 - grande.height)), grande)
        out.paste(caixa, (x, col))
        # Tamanho real, de dia e de noite
        for j, cor in enumerate((CHAO_DIA, CHAO_NOITE)):
            c = Image.new("RGB", (col // 4, 170), cor)
            c.paste(sprite, ((c.width - sprite.width) // 2, max(0, 160 - sprite.height)), sprite)
            out.paste(c, (x + col // 2 + j * col // 4, col))
        m = metricas(a)
        resultado[semente] = m
        texto = f"semente {semente}" + (" | " + "; ".join(m["problemas"]) if m["problemas"] else " | ok")
        d.text((x + 4, col + 172), texto[:60], fill="black")
    out.save(os.path.join(PAINEL, f"{chave}.png"))
    return resultado


def main():
    cfg = json.load(open(os.path.join(AQUI, "sprites.json"), encoding="utf-8"))
    os.makedirs(PAINEL, exist_ok=True)
    caminho_m = os.path.join(PAINEL, "metricas.json")
    todas = json.load(open(caminho_m, encoding="utf-8")) if os.path.exists(caminho_m) else {}
    for chave in sys.argv[1:] or list(cfg["sprites"]):
        r = folha(chave, cfg["sprites"][chave])
        if r:
            todas[chave] = r
            print(chave, {k: v["problemas"] or "ok" for k, v in r.items()})
    json.dump(todas, open(caminho_m, "w", encoding="utf-8"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
