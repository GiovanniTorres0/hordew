# Resumo objetivo de cada faixa de música, para escolher as variações sem ouvir tudo:
# duração, pico, volume médio, segundos de silêncio, queda de volume no fim (final "acabando")
# e brilho (centroide do espectro) para comparar o clima entre faixas.
# Uso (precisa do PyAV, que vem no Python do ComfyUI):
#   C:\ComfyUI_windows_portable\python_embeded\python.exe arte/analisar_musica.py arte/bruto/musica/*.opus
import sys
import av
import numpy as np


def ler(caminho):
    with av.open(caminho) as f:
        sr = f.streams.audio[0].rate
        partes = [q.to_ndarray().astype(np.float32) for q in f.decode(audio=0)]
    a = np.concatenate(partes, axis=1)
    return a.mean(axis=0), sr


def db(x):
    return 20 * np.log10(max(float(x), 1e-9))


for caminho in sys.argv[1:]:
    a, sr = ler(caminho)
    seg = len(a) // sr
    rms = np.array([np.sqrt(np.mean(a[i * sr:(i + 1) * sr] ** 2)) for i in range(seg)])
    media = np.sqrt(np.mean(a ** 2))
    silencio = int(np.sum(rms < media * 0.1))
    fim = db(rms[-3:].mean() / media)
    espectro = np.abs(np.fft.rfft(a[: sr * 20]))
    freqs = np.fft.rfftfreq(len(a[: sr * 20]), 1 / sr)
    centro = float((espectro * freqs).sum() / espectro.sum())
    curva = " ".join(f"{db(r / media):+.0f}" for r in rms[::3])
    print(f"{caminho.split('/')[-1].split(chr(92))[-1]}: {len(a) / sr:.1f}s pico {db(np.abs(a).max()):+.1f}dB "
          f"média {db(media):+.1f}dB silêncio {silencio}s fim {fim:+.1f}dB brilho {centro:.0f}Hz | a cada 3s: {curva}")
