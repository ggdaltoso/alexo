#!/usr/bin/env python3
"""
Medidor de sinal ao vivo: mostra, a cada varredura, se o leitor está enxergando
a tag AGORA.

Serve para achar a posição boa do módulo com a tag na mão, olhando a tela. É o
oposto do nfc-dropout-test.py, que mede em lote e só dá o veredito no fim -- útil
para registrar um número, inútil para ajustar posição.

A linha se reescreve no lugar, mostrando a taxa das últimas 20 varreduras:

    [####################]  100%  043C1F245F6180   LENDO
    [########------------]   40%  043C1F245F6180   INSTAVEL
    [--------------------]    0%  --               SEM TAG

Uso:
    python3 backend/scripts/nfc-signal.py     # Ctrl+C para sair
"""

import importlib.util
import os
import sys
import time
from collections import deque

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location(
    "pn532_probe", os.path.join(HERE, "pn532-i2c-probe.py")
)
probe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(probe)

BUS = int(os.environ.get("PN532_I2C_BUS", 3))
JANELA = 20


def main():
    dev = probe.PN532I2C(BUS, probe.PN532_I2C_ADDRESS, verbose=False)
    dev.open()

    # Limpa comando pendente de uma execução anterior. Esta ferramenta é feita
    # para ser iniciada e interrompida com Ctrl+C várias vezes seguidas, e um
    # InListPassiveTarget abortado no meio deixa a resposta atrasada no
    # barramento -- a próxima execução leria essa resposta no lugar do ACK.
    dev.abort()
    dev.drain()
    time.sleep(0.1)

    for cmd, resp_len in (([probe.CMD_GET_FIRMWARE_VERSION], 12),
                          ([probe.CMD_SAM_CONFIGURATION, 0x01, 0x14, 0x01], 9)):
        _, err = dev.send_command(cmd, resp_len, timeout=1.0)
        if err:
            sys.exit(f"o módulo não respondeu: {err}\n"
                     f"tente de novo -- se persistir, rode o probe:\n"
                     f"  python3 backend/scripts/pn532-i2c-probe.py --bus {BUS}")

    print(f"/dev/i2c-{BUS} — mova a tag/o módulo e observe a barra. Ctrl+C para sair.\n")

    hist = deque(maxlen=JANELA)
    uid = "--"

    while True:
        payload, err = dev.send_command(
            [probe.CMD_IN_LIST_PASSIVE_TARGET, 0x01, 0x00], 25, timeout=0.8
        )
        got = not err and payload and payload[0] == 0x4B and payload[1] != 0
        if got:
            uid_len = payload[6]
            uid = payload[7:7 + uid_len].hex().upper()
        hist.append(1 if got else 0)

        pct = 100 * sum(hist) // len(hist)
        cheias = pct * JANELA // 100
        barra = "#" * cheias + "-" * (JANELA - cheias)

        if pct >= 90:
            estado = "LENDO"
        elif pct > 0:
            estado = "INSTAVEL"
        else:
            estado = "SEM TAG"
            uid = "--"

        sys.stdout.write(f"\r[{barra}] {pct:3d}%  {uid:<16s} {estado:9s}")
        sys.stdout.flush()
        time.sleep(0.15)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n")
