# Gera as faixas de música no ComfyUI local com o Stable Audio Open 1.0 (no máximo 47 s por faixa).
# Cada clima ganha duas variações que o jogo toca alternadas, com cruzamento suave (src/music.js).
# Uso: python arte/musica.py [clima ...] [--sementes 1,2,3]
# Saída: arte/bruto/musica/<clima>_<semente>.opus e um resumo com o volume ao longo do tempo
# (para achar silêncios, estouros e finais cortados sem precisar ouvir tudo).
import json, os, sys
from gerar import AQUI, esperar_e_baixar, enviar

NEGATIVO = "vocals, singing, speech, voice, low quality, noise, distortion, clipping, silence, fade out, ending"
CLIMAS = {
    "dia": "Dark whimsical waltz in 3/4 time, music box, celesta, pizzicato strings, harpsichord, soft choir pad, "
           "Danny Elfman Tim Burton style, minor key, gothic, eerie but calm, steady, instrumental, 92 BPM",
    "noite": "Tense horror survival soundtrack, driving taiko and war drums, low staccato cello ostinato, tense "
             "tremolo violins, dark cinematic, The Walking Dead style, minor key, relentless, instrumental, 128 BPM",
    "tank": "Heavy aggressive horror boss battle music, pounding war drums, distorted low brass stabs, frantic "
            "string ostinato, huge cinematic hits, minor key, intense, instrumental, 140 BPM",
    "witch": "Creepy horror suspense music, dissonant high string clusters, slow eerie music box, deep drone, "
             "distant ghostly wind, sparse, unsettling, instrumental, 70 BPM",
}


def fluxo(prompt, semente, segundos=47):
    return {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "stable-audio-open-1.0.safetensors"}},
        "2": {"class_type": "CLIPLoader", "inputs": {"clip_name": "t5_base.safetensors", "type": "stable_audio"}},
        "3": {"class_type": "CLIPTextEncode", "inputs": {"text": prompt, "clip": ["2", 0]}},
        "4": {"class_type": "CLIPTextEncode", "inputs": {"text": NEGATIVO, "clip": ["2", 0]}},
        "5": {"class_type": "ConditioningStableAudio", "inputs": {"positive": ["3", 0], "negative": ["4", 0],
              "seconds_start": 0.0, "seconds_total": float(segundos)}},
        "6": {"class_type": "EmptyLatentAudio", "inputs": {"seconds": float(segundos), "batch_size": 1}},
        "7": {"class_type": "KSampler", "inputs": {"model": ["1", 0], "positive": ["5", 0], "negative": ["5", 1],
              "latent_image": ["6", 0], "seed": semente, "steps": 100, "cfg": 7.0,
              "sampler_name": "dpmpp_3m_sde_gpu", "scheduler": "exponential", "denoise": 1.0}},
        "8": {"class_type": "VAEDecodeAudio", "inputs": {"samples": ["7", 0], "vae": ["1", 2]}},
        "9": {"class_type": "SaveAudioOpus", "inputs": {"audio": ["8", 0], "filename_prefix": "hordew_musica", "quality": "128k"}},
    }


def main():
    args = sys.argv[1:]
    sementes = [1, 2, 3]
    if "--sementes" in args:
        i = args.index("--sementes")
        sementes = [int(s) for s in args[i + 1].split(",")]
        del args[i:i + 2]
    pasta = os.path.join(AQUI, "bruto", "musica")
    os.makedirs(pasta, exist_ok=True)
    for clima in args or list(CLIMAS):
        for sem in sementes:
            saida = os.path.join(pasta, f"{clima}_{sem}.opus")
            esperar_e_baixar(enviar(fluxo(CLIMAS[clima], sem)), "9", saida, chave="audio")
            print(f"{clima} semente {sem}", flush=True)


if __name__ == "__main__":
    main()
