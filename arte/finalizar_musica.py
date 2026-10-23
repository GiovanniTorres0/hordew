# Copia as faixas escolhidas para o jogo: corta o silêncio/fade do começo e do fim, nivela o volume
# e grava em assets/music/<nome>.opus (Opus 48 kHz estéreo).
# Uso: C:\ComfyUI_windows_portable\python_embeded\python.exe arte/finalizar_musica.py dia_a=dia_1 dia_b=dia_3 ...
# Volume alvo por clima (dB RMS); a Witch fica mais baixa de propósito, é suspense.
import os, sys
import av
import numpy as np

AQUI = os.path.dirname(os.path.abspath(__file__))
ALVO = {"dia": -19.0, "noite": -17.0, "tank": -16.0, "witch": -23.0}


def ler(caminho):
    with av.open(caminho) as f:
        sr = f.streams.audio[0].rate
        a = np.concatenate([q.to_ndarray().astype(np.float32) for q in f.decode(audio=0)], axis=1)
    return a, sr


def aparar(a, sr):
    """Tira trechos do começo e do fim com volume abaixo de 20% da média (silêncio ou fade-out)."""
    mono = a.mean(axis=0)
    passo = sr // 10
    rms = np.array([np.sqrt(np.mean(mono[i:i + passo] ** 2)) for i in range(0, len(mono) - passo, passo)])
    vivo = np.flatnonzero(rms > np.sqrt(np.mean(mono ** 2)) * 0.2)
    return a[:, vivo[0] * passo:(vivo[-1] + 1) * passo]


def gravar(a, sr, saida):
    with av.open(saida, "w", format="ogg") as f:
        st = f.add_stream("libopus", rate=48000)
        st.bit_rate = 112000
        st.layout = "stereo"
        res = av.AudioResampler(format="s16", layout="stereo", rate=48000)
        pcm = (np.clip(a, -1, 1) * 32767).astype(np.int16)
        for i in range(0, pcm.shape[1], 4096):
            q = av.AudioFrame.from_ndarray(np.ascontiguousarray(pcm[:, i:i + 4096].T.reshape(1, -1)), format="s16", layout="stereo")
            q.sample_rate = sr
            for r in res.resample(q):
                for p in st.encode(r):
                    f.mux(p)
        for r in res.resample(None):
            for p in st.encode(r):
                f.mux(p)
        for p in st.encode(None):
            f.mux(p)


os.makedirs(os.path.join(AQUI, "..", "assets", "music"), exist_ok=True)
for par in sys.argv[1:]:
    nome, fonte = par.split("=")
    a, sr = ler(os.path.join(AQUI, "bruto", "musica", f"{fonte}.opus"))
    if a.shape[0] == 1:
        a = np.vstack([a, a])
    a = aparar(a, sr)
    ganho = 10 ** ((ALVO[nome.split("_")[0]] - 20 * np.log10(np.sqrt(np.mean(a ** 2)))) / 20)
    a = a * ganho
    a = a / max(1.0, np.abs(a).max() / 0.95)  # sem estourar
    saida = os.path.join(AQUI, "..", "assets", "music", f"{nome}.opus")
    gravar(a, sr, saida)
    print(f"{nome} <- {fonte}: {a.shape[1] / sr:.1f}s, ganho {20 * np.log10(ganho):+.1f}dB, {os.path.getsize(saida) // 1024} KB")
