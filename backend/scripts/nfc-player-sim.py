#!/usr/bin/env python3
"""
Simula o player, sem tocar nada.

Serve para sentir o comportamento antes de existir musicPlayer.js: encostou a
tag, "toca" (um cronômetro anda); tirou, pausa; recolocou a mesma, retoma de onde
parou; encostou outra, troca de álbum e zera.

Não abre o mpv nem toca áudio -- o objetivo é validar o *gesto* e a latência de
resposta, que é o que o hardware decide. A parte de áudio já foi provada em
separado pelo nfc-to-music-test.py.

Usa a mesma regra de remoção do backend/nfcReader.js (VANISH_CONFIRMATIONS): a
tag só é dada por removida depois de N varreduras vazias seguidas, para uma
falha isolada de leitura não pausar a música à toa.

Uso:
    python3 backend/scripts/nfc-player-sim.py     # Ctrl+C para sair
"""

import importlib.util
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location(
    "pn532_probe", os.path.join(HERE, "pn532-i2c-probe.py")
)
probe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(probe)

BUS = int(os.environ.get("PN532_I2C_BUS", 3))
VANISH_CONFIRMATIONS = 2
MUSIC_DIR = os.path.join(HERE, "..", "uploads", "music")


def albuns():
    """Nomes de álbum reais, se existirem, só para o log parecer com o de verdade."""
    try:
        return sorted(
            d for d in os.listdir(MUSIC_DIR)
            if os.path.isdir(os.path.join(MUSIC_DIR, d))
        )
    except OSError:
        return []


def mmss(seg):
    return f"{int(seg) // 60:02d}:{int(seg) % 60:02d}"


def main():
    dev = probe.PN532I2C(BUS, probe.PN532_I2C_ADDRESS, verbose=False)
    dev.open()
    dev.abort()
    dev.drain()
    time.sleep(0.1)

    for cmd, rlen in (([probe.CMD_GET_FIRMWARE_VERSION], 12),
                      ([probe.CMD_SAM_CONFIGURATION, 0x01, 0x14, 0x01], 9)):
        _, err = dev.send_command(cmd, rlen, timeout=1.0)
        if err:
            sys.exit(f"o módulo não respondeu: {err}")

    disponiveis = albuns()
    mapa = {}          # uid -> nome do álbum
    posicao = {}       # uid -> segundos já "tocados"

    uid_atual = None
    tocando = False
    desde = None       # instante em que o play começou
    falhas = 0

    def log(icone, texto):
        # \r + espaços limpam a linha de status ao vivo antes de escrever o evento
        sys.stdout.write("\r" + " " * 70 + "\r")
        print(f"{time.strftime('%H:%M:%S')}  {icone} {texto}")
        sys.stdout.flush()

    print(f"/dev/i2c-{BUS} — encoste uma tag. Ctrl+C para sair.")
    if disponiveis:
        print(f"{len(disponiveis)} álbum(ns) em uploads/music/\n")
    else:
        print("(nenhum álbum em uploads/music/ — usando nomes genéricos)\n")

    while True:
        payload, err = dev.send_command(
            [probe.CMD_IN_LIST_PASSIVE_TARGET, 0x01, 0x00], 25, timeout=0.8
        )
        leu = not err and payload and payload[0] == 0x4B and payload[1] != 0
        uid = None
        if leu:
            n = payload[6]
            uid = payload[7:7 + n].hex().upper()

        if leu:
            falhas = 0
            if uid != uid_atual:
                # tag nova: troca de álbum e zera
                if uid not in mapa:
                    if disponiveis:
                        mapa[uid] = disponiveis[len(mapa) % len(disponiveis)]
                    else:
                        mapa[uid] = f"Álbum {len(mapa) + 1}"
                posicao[uid] = 0.0
                uid_atual = uid
                tocando = True
                desde = time.monotonic()
                log("|>", f"TOCANDO   {mapa[uid]}   [{uid}]")
            elif not tocando:
                tocando = True
                desde = time.monotonic()
                log("|>", f"RETOMADO  {mapa[uid]}   {mmss(posicao[uid])}")
        else:
            if uid_atual is not None and tocando:
                falhas += 1
                if falhas >= VANISH_CONFIRMATIONS:
                    posicao[uid_atual] += time.monotonic() - desde
                    tocando = False
                    falhas = 0
                    log("||", f"PAUSADO   tag removida   {mmss(posicao[uid_atual])}")

        if uid_atual is not None:
            decorrido = posicao[uid_atual] + (time.monotonic() - desde if tocando else 0)
            estado = "|> tocando" if tocando else "|| pausado"
            sys.stdout.write(f"\r   {estado}  {mmss(decorrido)}  {mapa[uid_atual]:<32.32s}")
            sys.stdout.flush()

        time.sleep(0.15)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n")
