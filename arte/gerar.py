# Gera variações de cada sprite no ComfyUI local (Flux Schnell fp8 + LoRA Don't Starve).
# Uso: python arte/gerar.py [chave ...] [--sementes 1,2,3]
# Precisa do ComfyUI aberto em 127.0.0.1:8188 (C:\ComfyUI_windows_portable\run_nvidia_gpu.bat).
# Saída: arte/bruto/<chave>_<semente>.png
import json, os, sys, time, urllib.request

AQUI = os.path.dirname(os.path.abspath(__file__))
URL = "http://127.0.0.1:8188"


def fluxo(prompt, semente, lora=1.0):
    return {
        "1": {"class_type": "UNETLoader", "inputs": {"unet_name": "flux1-schnell-fp8-e4m3fn.safetensors", "weight_dtype": "default"}},
        "2": {"class_type": "DualCLIPLoader", "inputs": {"clip_name1": "clip_l.safetensors", "clip_name2": "t5xxl_fp8_e4m3fn.safetensors", "type": "flux"}},
        "3": {"class_type": "VAELoader", "inputs": {"vae_name": "ae.safetensors"}},
        "4": {"class_type": "LoraLoaderModelOnly", "inputs": {"model": ["1", 0], "lora_name": "j_dsstyle_flux.safetensors", "strength_model": lora}},
        "5": {"class_type": "CLIPTextEncode", "inputs": {"text": prompt, "clip": ["2", 0]}},
        "6": {"class_type": "CLIPTextEncode", "inputs": {"text": "", "clip": ["2", 0]}},
        "7": {"class_type": "EmptySD3LatentImage", "inputs": {"width": 1024, "height": 1024, "batch_size": 1}},
        "8": {"class_type": "KSampler", "inputs": {"model": ["4", 0], "positive": ["5", 0], "negative": ["6", 0], "latent_image": ["7", 0],
              "seed": semente, "steps": 4, "cfg": 1.0, "sampler_name": "euler", "scheduler": "simple", "denoise": 1.0}},
        "9": {"class_type": "VAEDecode", "inputs": {"samples": ["8", 0], "vae": ["3", 0]}},
        "10": {"class_type": "SaveImage", "inputs": {"images": ["9", 0], "filename_prefix": "hordew"}},
    }


def enviar(fluxo_api):
    """Põe um fluxo na fila do ComfyUI e devolve o id."""
    corpo = json.dumps({"prompt": fluxo_api}).encode()
    req = urllib.request.Request(URL + "/prompt", data=corpo, headers={"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req))["prompt_id"]


def esperar_e_baixar(pid, no_saida, saida, chave="images"):
    """Espera o fluxo terminar e grava o arquivo do nó de saída indicado (imagem, ou áudio com chave="audio")."""
    while True:
        h = json.load(urllib.request.urlopen(f"{URL}/history/{pid}"))
        if pid in h:
            break
        time.sleep(0.5)
    if h[pid].get("status", {}).get("status_str") != "success":
        raise RuntimeError(json.dumps(h[pid].get("status"))[:500])
    img = h[pid]["outputs"][no_saida][chave][0]
    q = f"{URL}/view?filename={img['filename']}&subfolder={img['subfolder']}&type={img['type']}"
    with open(saida, "wb") as f:
        f.write(urllib.request.urlopen(q).read())


def gerar(prompt, semente, saida, lora=1.0):
    esperar_e_baixar(enviar(fluxo(prompt, semente, lora)), "10", saida)


def main():
    args = sys.argv[1:]
    sementes = [1, 2, 3]
    if "--sementes" in args:
        i = args.index("--sementes")
        sementes = [int(s) for s in args[i + 1].split(",")]
        del args[i:i + 2]
    cfg = json.load(open(os.path.join(AQUI, "sprites.json"), encoding="utf-8"))
    chaves = args or list(cfg["sprites"])
    os.makedirs(os.path.join(AQUI, "bruto"), exist_ok=True)
    for chave in chaves:
        s = cfg["sprites"][chave]
        # Zumbis têm modelo próprio: sem "de pé" e sem "olhos brancos", que brigam com agachado, capuz e viseira
        modelo = s.get("modelo") or ("modelo_pet" if s.get("pet") else "modelo_zumbi" if chave.startswith("z_") else "modelo")
        prompt = cfg[modelo].format(desc=s["desc"])
        for semente in sementes:
            saida = os.path.join(AQUI, "bruto", f"{chave}_{semente}.png")
            t0 = time.time()
            gerar(prompt, semente, saida, s.get("lora", 1.0))
            print(f"{chave} semente {semente}: {time.time() - t0:.1f}s", flush=True)


if __name__ == "__main__":
    main()
