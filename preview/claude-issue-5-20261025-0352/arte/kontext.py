# Quadros de animação desenhados pelo Flux Kontext a partir do desenho aprovado de cada personagem.
# Uso: python arte/kontext.py <chave> [--poses passo_a,passo_b,ataque] [--sementes 1,2,3] [--lora 0.5] [--ref bruto/anim/x.png]
# Entrada: arte/bruto/<chave>_<escolha>.png (o original aprovado, com fundo magenta).
# Saída: arte/bruto/anim/<chave>_<pose>_<semente>.png, no mesmo enquadramento do original.
# Precisa do ComfyUI aberto e de models/diffusion_models/flux1-dev-kontext_fp8_scaled.safetensors.
import json, os, shutil, sys
from gerar import AQUI, URL, esperar_e_baixar, enviar

COMFY_INPUT = r"C:\ComfyUI_windows_portable\ComfyUI\input"
FIXO = ("Keep exactly the same character: same face, body, proportions, clothes, colors, scratchy hand-drawn "
        "Don't Starve style and line thickness, same side view facing the same direction, same size and position "
        "in the frame, same plain flat solid magenta background, whole body visible.")
# Construções trocam este texto pelo "fixo" delas em sprites.json (uma casa não tem corpo nem rosto)
# Poses padrão; "poses" em sprites.json troca por pose específica do personagem (ex.: o golpe do Charger)
POSES = {
    # Contato e passagem: silhuetas de pernas bem diferentes entre si e do original (pedir só "passada" copia a do original)
    "passo_a": "Redraw the legs in the contact pose of a walk: the far leg reaches far forward with its heel planted on the ground, "
               "the near leg stretches far behind on its toes. The upper body and arms stay as they are.",
    "passo_b": "Redraw the legs in the passing pose of a walk: both feet are under the body, the near leg is lifted with the knee raised "
               "high in front, the far leg standing straight. The upper body and arms stay as they are.",
    "ataque": "The character attacks: it lunges forward toward the direction it faces, upper body leaning in, arms thrust forward to strike, mouth wide open.",
}


def fluxo(imagem, prompt, semente, lora):
    f = {
        "1": {"class_type": "UNETLoader", "inputs": {"unet_name": "flux1-dev-kontext_fp8_scaled.safetensors", "weight_dtype": "default"}},
        "2": {"class_type": "DualCLIPLoader", "inputs": {"clip_name1": "clip_l.safetensors", "clip_name2": "t5xxl_fp8_e4m3fn.safetensors", "type": "flux"}},
        "3": {"class_type": "VAELoader", "inputs": {"vae_name": "ae.safetensors"}},
        "4": {"class_type": "LoadImage", "inputs": {"image": imagem}},
        "5": {"class_type": "FluxKontextImageScale", "inputs": {"image": ["4", 0]}},
        "6": {"class_type": "VAEEncode", "inputs": {"pixels": ["5", 0], "vae": ["3", 0]}},
        "7": {"class_type": "CLIPTextEncode", "inputs": {"text": prompt, "clip": ["2", 0]}},
        "8": {"class_type": "ReferenceLatent", "inputs": {"conditioning": ["7", 0], "latent": ["6", 0]}},
        "9": {"class_type": "FluxGuidance", "inputs": {"conditioning": ["8", 0], "guidance": 2.5}},
        "10": {"class_type": "ConditioningZeroOut", "inputs": {"conditioning": ["7", 0]}},
        "11": {"class_type": "KSampler", "inputs": {"model": ["1", 0], "positive": ["9", 0], "negative": ["10", 0], "latent_image": ["6", 0],
               "seed": semente, "steps": 20, "cfg": 1.0, "sampler_name": "euler", "scheduler": "simple", "denoise": 1.0}},
        "12": {"class_type": "VAEDecode", "inputs": {"samples": ["11", 0], "vae": ["3", 0]}},
        "13": {"class_type": "SaveImage", "inputs": {"images": ["12", 0], "filename_prefix": "hordew_anim"}},
    }
    if lora:
        # LoRA do Don't Starve leve, só para segurar o traço
        f["14"] = {"class_type": "LoraLoaderModelOnly", "inputs": {"model": ["1", 0], "lora_name": "j_dsstyle_flux.safetensors", "strength_model": lora}}
        f["11"]["inputs"]["model"] = ["14", 0]
    return f


def main():
    args = sys.argv[1:]
    opc = lambda nome, padrao: args[args.index(nome) + 1] if nome in args else padrao
    chave = args[0]
    sementes = [int(s) for s in opc("--sementes", "1,2,3").split(",")]
    lora = float(opc("--lora", "0"))
    s = json.load(open(os.path.join(AQUI, "sprites.json"), encoding="utf-8"))["sprites"][chave]
    poses = {**POSES, **s.get("poses", {})}
    nomes = opc("--poses", ",".join(poses)).split(",")
    # --ref troca a imagem de partida (ex.: um passo já aprovado, para tirar dele o passo contrário)
    origem = opc("--ref", None) or os.path.join("bruto", f"{chave}_{s['escolha']}.png")
    ref = os.path.basename(origem)
    shutil.copy(os.path.join(AQUI, origem), os.path.join(COMFY_INPUT, ref))
    os.makedirs(os.path.join(AQUI, "bruto", "anim"), exist_ok=True)
    for pose in nomes:
        for semente in sementes:
            saida = os.path.join(AQUI, "bruto", "anim", f"{chave}_{pose}_{semente}.png")
            esperar_e_baixar(enviar(fluxo(ref, f"{poses[pose]} {s.get('fixo', FIXO)}", semente, lora)), "13", saida)
            print(f"{chave} {pose} semente {semente}", flush=True)


if __name__ == "__main__":
    main()
