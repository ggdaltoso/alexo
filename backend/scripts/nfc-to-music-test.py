#!/usr/bin/env python3
"""
Teste de integracao: tag NFC -> musica.

Junta as duas metades do projeto -- o leitor PN532 e o mpv -- no mesmo fluxo que
o musicController.js vai implementar. Serve para revalidar o caminho completo
depois de mexer no nfcReader.js ou na configuracao de audio, sem precisar do
backend no ar.

Reaproveita o pn532-i2c-probe.py como modulo em vez de reimplementar o
protocolo, e fala com o mpv pelo socket IPC direto (AF_UNIX): o nc reabre a
conexao a cada chamada e nao serve para uma sequencia temporizada.

Pre-requisito: o mpv precisa estar ocioso com o socket IPC aberto.

    setsid nohup mpv --idle=yes --no-video --audio-device=alsa/hw:0,0 \
      --volume=100 --input-ipc-server=/tmp/mpvsocket \
      >/tmp/mpv.log 2>&1 </dev/null &

Uso (no Pi):

    python3 nfc-to-music-test.py <caminho.mp3> [segundos]
"""

import importlib.util
import json
import os
import socket
import sys
import time

PROBE = "/home/pi/alexo/backend/scripts/pn532-i2c-probe.py"
SOCKET = os.environ.get("MPV_SOCKET", "/tmp/mpvsocket")
BUS = int(os.environ.get("PN532_I2C_BUS", "3"))
PLAY_SECONDS = 15

spec = importlib.util.spec_from_file_location("pn532probe", PROBE)
probe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(probe)


class Mpv:
    """Conexao persistente com o mpv. Uma so, ao contrario do nc que reabre a cada chamada."""

    def __init__(self, path):
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.connect(path)
        self.sock.settimeout(5)
        self.buf = b""

    def command(self, *args):
        payload = json.dumps({"command": list(args)}).encode() + b"\n"
        self.sock.send(payload)
        # o mpv intercala eventos assincronos com as respostas; a resposta e a
        # linha que traz a chave "error"
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline:
            while b"\n" in self.buf:
                line, self.buf = self.buf.split(b"\n", 1)
                if not line.strip():
                    continue
                msg = json.loads(line.decode())
                if "error" in msg:
                    return msg
            try:
                chunk = self.sock.recv(4096)
            except socket.timeout:
                break
            if not chunk:
                break
            self.buf += chunk
        return None

    def close(self):
        self.sock.close()


def wait_for_socket(path, timeout=40):
    """O mpv leva ~11s pra subir nesse Pi -- o timeout precisa de folga."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if os.path.exists(path):
            return True
        time.sleep(0.5)
    return False


def main():
    if len(sys.argv) < 2:
        print(__doc__.strip())
        return 2
    track = sys.argv[1]
    if not os.path.isfile(track):
        print(f"!! arquivo nao encontrado: {track}")
        return 1
    seconds = int(sys.argv[2]) if len(sys.argv) > 2 else PLAY_SECONDS

    print("== 1. mpv ==")
    if not wait_for_socket(SOCKET):
        print(f"!! socket {SOCKET} nao apareceu")
        return 1
    mpv = Mpv(SOCKET)
    print(f"   conectado em {SOCKET}")
    mpv.command("set_property", "volume", 100)

    print("\n== 2. PN532 ==")
    dev = probe.PN532I2C(BUS, probe.PN532_I2C_ADDRESS, verbose=False)
    dev.open()
    payload, err = dev.send_command([probe.CMD_GET_FIRMWARE_VERSION], 12)
    if err:
        print(f"!! {err}")
        return 1
    print(f"   PN532 ok — firmware {payload[2]}.{payload[3]}")
    payload, err = dev.send_command([probe.CMD_SAM_CONFIGURATION, 0x01, 0x14, 0x01], 9)
    if err:
        print(f"!! SAMConfiguration: {err}")
        return 1
    print("   configurado")

    print("\n== 3. Aguardando tag (60s) ==")
    print("   encoste QUALQUER tag na antena")
    deadline = time.monotonic() + 60
    uid = None
    while time.monotonic() < deadline:
        payload, err = dev.send_command(
            [probe.CMD_IN_LIST_PASSIVE_TARGET, 0x01, 0x00], 25, timeout=0.8
        )
        if err or not payload or payload[0] != 0x4B or payload[1] == 0:
            time.sleep(0.1)
            continue
        uid_len = payload[6]
        uid = probe.hexdump(payload[7:7 + uid_len]).upper().replace(" ", "")
        sak = payload[5]
        print(f"   TAG LIDA — UID {uid}  ({probe.SAK_TYPES.get(sak, 'desconhecida')})")
        break

    if uid is None:
        print("!! nenhuma tag em 60s")
        return 1

    print(f"\n== 4. Tocando {seconds}s ==")
    print(f"   {os.path.basename(track)}")
    mpv.command("loadfile", track, "replace")
    time.sleep(2)
    dur = mpv.command("get_property", "duration")
    if dur and dur.get("error") == "success":
        print(f"   duracao da faixa: {dur['data']:.1f}s")

    for i in range(seconds - 2):
        time.sleep(1)
        if i % 5 == 4:
            pos = mpv.command("get_property", "time-pos")
            if pos and pos.get("error") == "success":
                print(f"   t+{pos['data']:.1f}s")

    mpv.command("stop")
    print("\n   parado.")
    print(f"\nOK — tag {uid} disparou a musica de ponta a ponta.")
    dev.close()
    mpv.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
