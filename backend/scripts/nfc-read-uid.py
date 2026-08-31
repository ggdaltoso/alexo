#!/usr/bin/env python3
"""
Lê UIDs de tags NFC e imprime só isso.

Ferramenta de bancada, para teste manual: encostar tag, ver o UID, repetir.
Serve para descobrir o UID de uma tag nova (para cadastrar em data/nfc-tags.json)
e para testar alcance/posicionamento da antena sem o ruído de diagnóstico do
pn532-i2c-probe.py.

Reaproveita o protocolo do probe em vez de reimplementar: o probe é a
implementação de referência do PN532 em I2C neste projeto.

Uso:
    python3 backend/scripts/nfc-read-uid.py           # roda até Ctrl+C
    python3 backend/scripts/nfc-read-uid.py --repeat  # reimprime a cada leitura,
                                                      # mesmo se for a mesma tag
    PN532_I2C_BUS=1 python3 backend/scripts/nfc-read-uid.py
"""

import argparse
import importlib.util
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
PROBE = os.path.join(HERE, "pn532-i2c-probe.py")


def load_probe():
    """Importa o probe pelo caminho (o nome do arquivo tem hífen, não dá import normal)."""
    if not os.path.exists(PROBE):
        sys.exit(f"não achei {PROBE} — este script depende dele")
    spec = importlib.util.spec_from_file_location("pn532_probe", PROBE)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main():
    parser = argparse.ArgumentParser(description="Imprime o UID de cada tag encostada no leitor.")
    parser.add_argument("--bus", type=int, default=int(os.environ.get("PN532_I2C_BUS", 3)),
                        help="barramento I2C (padrão: 3, ou $PN532_I2C_BUS)")
    parser.add_argument("--repeat", action="store_true",
                        help="imprime toda leitura, inclusive repetições da mesma tag")
    args = parser.parse_args()

    probe = load_probe()

    dev = probe.PN532I2C(args.bus, probe.PN532_I2C_ADDRESS, verbose=False)
    dev.open()

    payload, err = dev.send_command([probe.CMD_GET_FIRMWARE_VERSION], 12, timeout=1.0)
    if err:
        sys.exit(f"o módulo não respondeu em /dev/i2c-{args.bus}: {err}\n"
                 f"rode o probe para diagnosticar: python3 {PROBE} --bus {args.bus}")

    payload, err = dev.send_command([probe.CMD_SAM_CONFIGURATION, 0x01, 0x14, 0x01], 9, timeout=1.0)
    if err:
        sys.exit(f"SAMConfiguration falhou: {err}")

    print(f"pronto (/dev/i2c-{args.bus}). Encoste uma tag. Ctrl+C para sair.", flush=True)

    last = None
    try:
        while True:
            payload, err = dev.send_command(
                [probe.CMD_IN_LIST_PASSIVE_TARGET, 0x01, 0x00], 25, timeout=0.8
            )
            if err or not payload or payload[0] != 0x4B or payload[1] == 0:
                last = None          # campo vazio: a próxima leitura conta como nova
                time.sleep(0.15)
                continue

            uid_len = payload[6]
            uid = payload[7:7 + uid_len].hex().upper()

            if args.repeat or uid != last:
                print(uid, flush=True)
                last = uid

            time.sleep(0.15)
    except KeyboardInterrupt:
        print()
    finally:
        dev.close()


if __name__ == "__main__":
    main()
