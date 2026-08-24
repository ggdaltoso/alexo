#!/usr/bin/env python3
"""
Mede a taxa de leitura com a tag PARADA na antena, comparando as três
estratégias de varredura contínua do PN532.

O problema que isto investiga: com a tag imóvel, o leitor lê uma vez e depois
some. É comportamento esperado do ISO14443A -- depois de selecionada, a tag sai
do estado IDLE e para de responder ao REQA das varreduras seguintes. A pergunta
é qual estratégia devolve a tag para IDLE de forma confiável.

  simples   InListPassiveTarget puro (o que o nfcReader.js faz hoje)
  release   + InRelease depois de cada leitura
  rf        + desliga e liga o campo RF antes de cada varredura

Encoste a tag UMA vez e deixe parada: o script roda as três em sequência.

Uso:
    python3 backend/scripts/nfc-dropout-test.py        # 15s por estratégia
    python3 backend/scripts/nfc-dropout-test.py 30
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

CMD_IN_RELEASE = 0x52
CMD_RF_CONFIGURATION = 0x32

PER_MODE = int(sys.argv[1]) if len(sys.argv) > 1 else 15
BUS = int(os.environ.get("PN532_I2C_BUS", 3))


def scan(dev, mode):
    """Uma varredura. Devolve (leu, uid)."""
    if mode == "rf":
        # CfgItem 0x01 = campo RF. Desligar devolve a tag para IDLE.
        dev.send_command([CMD_RF_CONFIGURATION, 0x01, 0x00], 9, timeout=0.5)
        time.sleep(0.05)
        dev.send_command([CMD_RF_CONFIGURATION, 0x01, 0x01], 9, timeout=0.5)

    payload, err = dev.send_command(
        [probe.CMD_IN_LIST_PASSIVE_TARGET, 0x01, 0x00], 25, timeout=0.8
    )
    got = not err and payload and payload[0] == 0x4B and payload[1] != 0

    if got and mode in ("release", "rf"):
        dev.send_command([CMD_IN_RELEASE, 0x00], 9, timeout=0.5)

    if not got:
        return False, None
    uid_len = payload[6]
    return True, payload[7:7 + uid_len].hex().upper()


def measure(dev, mode, seconds):
    hits = scans = 0
    uid = None
    marks = []
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        got, u = scan(dev, mode)
        scans += 1
        if got:
            hits += 1
            uid = uid or u
            marks.append(".")
        else:
            marks.append("x")
        sys.stdout.write(marks[-1])
        sys.stdout.flush()
        time.sleep(0.15)
    print()
    return hits, scans, uid


def main():
    dev = probe.PN532I2C(BUS, probe.PN532_I2C_ADDRESS, verbose=False)
    dev.open()
    dev.abort()
    dev.drain()   # limpa comando pendente de uma execução anterior
    time.sleep(0.1)

    # O tamanho da resposta importa e não é decoração: ler mais bytes do que o
    # frame tem consome o que vem depois e dessincroniza TODOS os comandos
    # seguintes. Um SAMConfiguration (9 bytes) lido como 12 foi o que invalidou
    # as primeiras medições de dropout deste script -- o leitor parecia perder a
    # tag, quando na verdade quem estava quebrado era esta ferramenta.
    for cmd, resp_len, name in (
        ([probe.CMD_GET_FIRMWARE_VERSION], 12, "GetFirmwareVersion"),
        ([probe.CMD_SAM_CONFIGURATION, 0x01, 0x14, 0x01], 9, "SAMConfiguration"),
    ):
        _, err = dev.send_command(cmd, resp_len, timeout=1.0)
        if err:
            sys.exit(f"{name} falhou: {err}")

    print("Encoste uma tag e NÃO MEXA nela até o fim.")
    print("Esperando a primeira leitura...", flush=True)
    while True:
        got, uid = scan(dev, "simples")
        if got:
            print(f"tag {uid} — começando\n", flush=True)
            break
        time.sleep(0.15)

    resultados = []
    for mode in ("simples", "release", "rf"):
        print(f"{mode:8s} ", end="", flush=True)
        hits, scans, _ = measure(dev, mode, PER_MODE)
        resultados.append((mode, hits, scans))

    print("\n=== resultado ===")
    for mode, hits, scans in resultados:
        pct = 100 * hits / scans if scans else 0
        print(f"  {mode:8s}  {hits:3d}/{scans:<3d}  {pct:3.0f}%")

    melhor = max(resultados, key=lambda r: r[1] / r[2] if r[2] else 0)
    pct = 100 * melhor[1] / melhor[2]
    print()
    if pct >= 90:
        print(f"Usar '{melhor[0]}' no nfcReader.js — {pct:.0f}% com a tag parada.")
    elif pct >= 50:
        print(f"Melhor é '{melhor[0]}' ({pct:.0f}%), mas ainda falha demais.")
    else:
        print(f"Nenhuma estratégia funciona (melhor: {melhor[0]}, {pct:.0f}%).")
        print("Se a tag ficou mesmo parada, o problema não é protocolo — é o campo RF.")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print()
