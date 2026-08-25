#!/usr/bin/env python3
"""
Mede a duração de cada MP3 lendo o cabeçalho, sem dependência externa.

Existe para separar música de vinheta: trilhas de jogo vêm cheias de jingles de
2 a 10 segundos (logo da Nintendo, game over, item pego) que não fazem sentido
num álbum tocado por tag.

Não usa ffprobe (não está instalado no Pi) nem o mpv (leva ~11s por invocação --
inviável para centenas de arquivos). Lê o cabeçalho do primeiro quadro e, quando
existe, o Xing/Info de VBR, que traz a contagem de quadros.

Uso:
    python3 backend/scripts/music-durations.py                 # tudo, agrupado
    python3 backend/scripts/music-durations.py --menor-que 30  # só os curtos
    python3 backend/scripts/music-durations.py --menor-que 30 --lista
"""

import argparse
import os
import struct
import sys

MUSIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "uploads", "music")

# Tabelas do MPEG-1/2 Layer III. Índice pelo valor de 4 bits do cabeçalho.
BITRATES_V1_L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0]
BITRATES_V2_L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0]
SAMPLERATES = {0: [44100, 48000, 32000], 1: [22050, 24000, 16000], 2: [11025, 12000, 8000]}


def tamanho_id3(f):
    """ID3v2 fica no começo e precisa ser pulado para achar o primeiro quadro."""
    f.seek(0)
    cabecalho = f.read(10)
    if len(cabecalho) < 10 or cabecalho[:3] != b"ID3":
        return 0
    # Tamanho vem em synchsafe: 7 bits úteis por byte.
    b = cabecalho[6:10]
    return 10 + ((b[0] << 21) | (b[1] << 14) | (b[2] << 7) | b[3])


def duracao(caminho):
    """Segundos, ou None se o arquivo não parecer um MP3 legível."""
    try:
        tamanho = os.path.getsize(caminho)
        with open(caminho, "rb") as f:
            inicio = tamanho_id3(f)
            f.seek(inicio)
            # O primeiro quadro pode não estar exatamente no início; procurar o
            # sync (11 bits em 1) numa janela pequena resolve os casos comuns.
            bloco = f.read(8192)
            pos = -1
            for i in range(len(bloco) - 4):
                if bloco[i] == 0xFF and (bloco[i + 1] & 0xE0) == 0xE0:
                    pos = i
                    break
            if pos < 0:
                return None

            h = bloco[pos:pos + 4]
            versao = (h[1] >> 3) & 0x03      # 3 = MPEG1, 2 = MPEG2, 0 = MPEG2.5
            camada = (h[1] >> 1) & 0x03      # 1 = Layer III
            if camada != 1:
                return None

            idx_bitrate = (h[2] >> 4) & 0x0F
            idx_sample = (h[2] >> 2) & 0x03
            if idx_bitrate in (0, 15) or idx_sample == 3:
                return None

            mpeg1 = versao == 3
            bitrate = (BITRATES_V1_L3 if mpeg1 else BITRATES_V2_L3)[idx_bitrate] * 1000
            grupo = 0 if versao == 3 else (1 if versao == 2 else 2)
            samplerate = SAMPLERATES[grupo][idx_sample]
            amostras_por_quadro = 1152 if mpeg1 else 576

            # Xing/Info: presente em arquivos VBR e traz a contagem de quadros,
            # que é a única forma honesta de medir VBR -- pelo bitrate do
            # primeiro quadro daria um número errado.
            offset = pos + (36 if mpeg1 else 21)
            marca = bloco[offset:offset + 4]
            if marca in (b"Xing", b"Info"):
                flags = struct.unpack(">I", bloco[offset + 4:offset + 8])[0]
                if flags & 0x0001:
                    quadros = struct.unpack(">I", bloco[offset + 8:offset + 12])[0]
                    return quadros * amostras_por_quadro / samplerate

            # CBR: tamanho útil dividido pela taxa.
            return (tamanho - inicio) * 8 / bitrate
    except OSError:
        return None


def mmss(s):
    return f"{int(s) // 60:d}:{int(s) % 60:02d}"


def main():
    p = argparse.ArgumentParser(description="Duração de cada MP3, para separar música de vinheta.")
    p.add_argument("--menor-que", type=float, default=None, metavar="SEG",
                   help="lista só as faixas mais curtas que isto")
    p.add_argument("--lista", action="store_true", help="uma linha por faixa, sem agrupar")
    args = p.parse_args()

    base = os.path.normpath(MUSIC_DIR)
    if not os.path.isdir(base):
        sys.exit(f"{base} não existe")

    faixas = []
    for raiz, _, arquivos in os.walk(base):
        for nome in arquivos:
            if not nome.lower().endswith(".mp3"):
                continue
            completo = os.path.join(raiz, nome)
            faixas.append((os.path.relpath(completo, base), duracao(completo)))

    faixas.sort(key=lambda t: (t[1] is None, t[1] if t[1] is not None else 0))

    ilegiveis = [f for f in faixas if f[1] is None]
    legiveis = [f for f in faixas if f[1] is not None]

    alvo = [f for f in legiveis if args.menor_que is None or f[1] < args.menor_que]

    if args.lista or args.menor_que is not None:
        for rel, dur in alvo:
            print(f"{mmss(dur):>6}  {rel}")
        print()
        print(f"{len(alvo)} de {len(legiveis)} faixa(s)"
              + (f" com menos de {args.menor_que:.0f}s" if args.menor_que else ""))
    else:
        # Distribuição, para escolher o corte com base no que existe.
        faixas_por_janela = [
            ("até 5s", lambda d: d < 5),
            ("5s a 15s", lambda d: 5 <= d < 15),
            ("15s a 30s", lambda d: 15 <= d < 30),
            ("30s a 60s", lambda d: 30 <= d < 60),
            ("1min a 2min", lambda d: 60 <= d < 120),
            ("2min ou mais", lambda d: d >= 120),
        ]
        print(f"{len(legiveis)} faixa(s) lidas\n")
        for rotulo, teste in faixas_por_janela:
            qtd = sum(1 for _, d in legiveis if teste(d))
            barra = "#" * min(50, qtd)
            print(f"  {rotulo:<14} {qtd:>4}  {barra}")
        print("\nmais curtas:")
        for rel, dur in legiveis[:10]:
            print(f"  {mmss(dur):>6}  {rel}")

    if ilegiveis:
        print(f"\n{len(ilegiveis)} arquivo(s) sem cabeçalho legível:")
        for rel, _ in ilegiveis[:5]:
            print(f"  {rel}")
