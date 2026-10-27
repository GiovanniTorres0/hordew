# Aplica o veredito do avaliador nos desenhos do Kontext (bruto/painel/avaliacao_kontext.json):
# - pose "desenho" aprovada vira o sprite da chave: copia para bruto/<chave>_<100+semente>.png e marca a escolha;
# - estados de dano aprovados vão para bruto/anim/aprovados/<chave>_<pose>.png (recortar.py exporta como <chave>_<pose>);
# - reprovados trocam o prompt da pose pelo novo_prompt do avaliador.
# Uso: python arte/aplicar_kontext.py
import json, os, shutil
from recortar import AQUI

av = json.load(open(os.path.join(AQUI, "bruto", "painel", "avaliacao_kontext.json"), encoding="utf-8"))
caminho = os.path.join(AQUI, "sprites.json")
cfg = json.load(open(caminho, encoding="utf-8"))
os.makedirs(os.path.join(AQUI, "bruto", "anim", "aprovados"), exist_ok=True)
for chave, poses in av.items():
    s = cfg["sprites"][chave]
    for pose, a in poses.items():
        if a.get("veredito") == "aprovado":
            origem = os.path.join(AQUI, "bruto", "anim", f"{chave}_{pose}_{a['semente']}.png")
            if pose.startswith("desenho") or pose == "limpo":
                shutil.copy(origem, os.path.join(AQUI, "bruto", f"{chave}_{100 + a['semente']}.png"))
                s["escolha"] = 100 + a["semente"]
                s.pop("pendente", None)
            else:
                shutil.copy(origem, os.path.join(AQUI, "bruto", "anim", "aprovados", f"{chave}_{pose}.png"))
        elif a.get("novo_prompt"):
            s.setdefault("poses", {})[pose] = a["novo_prompt"]
        print(chave, pose, a.get("veredito"), a.get("semente"))
open(caminho, "w", encoding="utf-8").write(json.dumps(cfg, ensure_ascii=False, indent=2) + "\n")
