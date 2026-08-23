#!/usr/bin/env python3
"""
Probe do PN532 em modo I2C.

Contraparte do pn532-smoke-test.js (que fala HSU/UART). Existe pelo mesmo motivo
que ele: provar o hardware sem depender de biblioteca nenhuma, pra que uma falha
seja inequivocamente do hardware e não de um addon nativo que não compilou no
ARMv6 do Pi Zero.

Por que Python aqui, num projeto Node: falar I2C cru exige ioctl(I2C_SLAVE), que
o Node não consegue fazer sem addon nativo (i2c-bus) -- exatamente a dependência
que queremos manter fora do teste. O fcntl da stdlib do Python 3 faz isso sem
instalar nada. Este script é diagnóstico, não código de aplicação.

Pré-requisitos no Pi:
    dtparam=i2c_arm=on   em /boot/config.txt
    i2c-dev              em /etc/modules
    usuário no grupo i2c
    sudo apt install i2c-tools     (pro i2cdetect; o script não depende dele)

Uso:
    python3 pn532-i2c-probe.py
    python3 pn532-i2c-probe.py --verbose
    python3 pn532-i2c-probe.py --bus 1 --address 0x24 --timeout 30
"""

import argparse
import fcntl
import os
import sys
import time

I2C_SLAVE = 0x0703          # ioctl: fixa o endereço do escravo pra este fd
PN532_I2C_ADDRESS = 0x24    # endereço de 7 bits, fixo no chip

HOST_TO_PN532 = 0xD4
PN532_TO_HOST = 0xD5

ACK_FRAME = bytes([0x00, 0x00, 0xFF, 0x00, 0xFF, 0x00])

CMD_GET_FIRMWARE_VERSION = 0x02
CMD_SAM_CONFIGURATION = 0x14
CMD_IN_LIST_PASSIVE_TARGET = 0x4A

# SAK -> família da tag. Determina o que a lib Node vai conseguir ler depois.
SAK_TYPES = {
    0x00: "Mifare Ultralight / NTAG21x",
    0x08: "Mifare Classic 1K",
    0x18: "Mifare Classic 4K",
    0x20: "ISO14443-4 (DESFire / cartão bancário)",
    0x28: "Mifare Classic 1K + ISO14443-4",
}


class Colors:
    BOLD = "\033[1m"
    DIM = "\033[2m"
    RED = "\033[31m"
    GREEN = "\033[32m"
    YELLOW = "\033[33m"
    BLUE = "\033[34m"
    RESET = "\033[0m"


def supports_color():
    return sys.stdout.isatty()


C = Colors if supports_color() else type("NoColors", (), {k: "" for k in vars(Colors) if not k.startswith("_")})


def step(msg):
    print(f"\n{C.BOLD}==> {msg}{C.RESET}")


def info(msg):
    print(f"    {msg}")


def ok(msg):
    print(f"    {C.GREEN}OK{C.RESET}  {msg}")


def warn(msg):
    print(f"    {C.YELLOW}!!{C.RESET}  {msg}")


def fail(msg):
    print(f"\n{C.RED}!! {msg}{C.RESET}", file=sys.stderr)
    sys.exit(1)


def hexdump(data):
    return " ".join(f"{b:02x}" for b in data)


def build_frame(data):
    """Normal information frame: 00 00 FF LEN LCS TFI ...dados DCS 00"""
    length = len(data) + 1  # +1 pelo TFI
    lcs = (0x100 - length) & 0xFF
    checksum = HOST_TO_PN532
    for b in data:
        checksum = (checksum + b) & 0xFF
    dcs = (0x100 - checksum) & 0xFF
    return bytes([0x00, 0x00, 0xFF, length, lcs, HOST_TO_PN532]) + bytes(data) + bytes([dcs, 0x00])


class BusError(Exception):
    """
    Falha no nível do barramento, não do protocolo.

    O caso que importa é o EREMOTEIO (errno 121): ninguém deu ACK no endereço.
    Em I2C o escravo confirma o próprio endereço por hardware, então esse erro
    é prova de que não há nada vivo em 0x24 -- um sinal que o HSU, por ser
    unidirecional e mudo, nunca conseguiu nos dar.
    """


class PN532I2C:
    def __init__(self, bus, address, verbose=False):
        self.path = f"/dev/i2c-{bus}"
        self.address = address
        self.verbose = verbose
        self.fd = None

    def open(self):
        try:
            self.fd = os.open(self.path, os.O_RDWR)
        except FileNotFoundError:
            fail(
                f"{self.path} não existe.\n\n"
                "  O barramento I2C não está habilitado. No Pi:\n"
                "    sudo dtparam i2c_arm=on          # agora, sem reboot\n"
                "    echo 'dtparam=i2c_arm=on' | sudo tee -a /boot/config.txt   # persistente\n"
                "    sudo modprobe i2c-dev"
            )
        except PermissionError:
            fail(
                f"sem permissão para abrir {self.path}.\n\n"
                "  Adicione o usuário ao grupo i2c e refaça o login:\n"
                "    sudo usermod -aG i2c $USER"
            )
        try:
            fcntl.ioctl(self.fd, I2C_SLAVE, self.address)
        except OSError as e:
            fail(f"ioctl(I2C_SLAVE, 0x{self.address:02x}) falhou: {e}")

    def close(self):
        if self.fd is not None:
            os.close(self.fd)
            self.fd = None

    def _write(self, data):
        if self.verbose:
            print(f"    {C.DIM}--> {hexdump(data)}{C.RESET}")
        try:
            os.write(self.fd, data)
        except OSError as e:
            raise BusError(f"escrita falhou: {e.strerror} (errno {e.errno})") from e

    def _read(self, count):
        """
        Em I2C o PN532 prefixa toda leitura com um byte de status cujo bit0
        indica 'pronto'. Ele não faz clock stretching: quem espera é o host.
        """
        try:
            data = os.read(self.fd, count)
        except OSError as e:
            raise BusError(f"leitura falhou: {e.strerror} (errno {e.errno})") from e
        if self.verbose:
            print(f"    {C.DIM}<-- {hexdump(data)}{C.RESET}")
        return data

    def wait_ready(self, timeout=1.0):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            try:
                status = self._read(1)
            except BusError:
                # NACK enquanto o chip processa é normal; tentar de novo
                time.sleep(0.01)
                continue
            if status and (status[0] & 0x01):
                return True
            time.sleep(0.01)
        return False

    def read_frame(self, expected_len, timeout=1.0):
        if not self.wait_ready(timeout):
            return None
        # +1 pelo byte de status que precede o frame
        try:
            raw = self._read(expected_len + 1)
        except BusError:
            return None
        if not raw or not (raw[0] & 0x01):
            return None
        return raw[1:]

    def send_command(self, data, response_len, timeout=1.0):
        """Envia um comando, confirma o ACK e devolve o payload da resposta."""
        try:
            self._write(build_frame(data))
        except BusError as e:
            return None, str(e)

        ack = self.read_frame(len(ACK_FRAME), timeout)
        if ack is None:
            return None, "sem ACK (o módulo não respondeu)"
        if bytes(ack) != ACK_FRAME:
            return None, f"ACK inválido: {hexdump(ack)}"

        frame = self.read_frame(response_len, timeout)
        if frame is None:
            return None, "ACK recebido, mas nenhum frame de resposta"

        # 00 00 FF LEN LCS TFI ...dados DCS 00
        if frame[0:3] != bytes([0x00, 0x00, 0xFF]):
            return None, f"preâmbulo inesperado: {hexdump(frame[0:3])}"
        length = frame[3]
        lcs = frame[4]
        if (length + lcs) & 0xFF != 0:
            return None, f"LCS inválido (LEN={length:#04x} LCS={lcs:#04x})"
        tfi = frame[5]
        if tfi != PN532_TO_HOST:
            return None, f"TFI inesperado: {tfi:#04x} (esperado 0xd5)"
        payload = frame[6:6 + length - 1]
        return payload, None


def phase_bus(dev, args):
    step("1/4  Barramento I2C")
    info(f"device : {dev.path}")
    info(f"address: 0x{dev.address:02x}")
    dev.open()
    ok("barramento aberto e endereço fixado")


def phase_firmware(dev):
    step("2/4  GetFirmwareVersion")
    payload, err = dev.send_command([CMD_GET_FIRMWARE_VERSION], 12, timeout=1.0)
    if err:
        extra = ""
        if "121" in err:
            extra = (
                "\n  errno 121 = EREMOTEIO: ninguém deu ACK no endereço 0x24.\n"
                "  Em I2C o ACK de endereço é feito pelo hardware do escravo, então\n"
                "  isso é prova de que não há um PN532 vivo nesse endereço -- não é\n"
                "  ambiguidade de protocolo como era no UART.\n"
            )
        fail(
            f"{err}\n{extra}\n"
            "  Antes de suspeitar do software, confira:\n\n"
            "    1. Chave DIP em I2C  ->  1 | 0   (é o erro mais comum)\n"
            "    2. SDA no pino 3 (GPIO2) e SCL no pino 5 (GPIO3), não nos pinos 8/10\n"
            "    3. VCC no pino 1 (3V3) e GND no pino 6\n"
            "    4. i2cdetect -y 1  -> o 0x24 aparece na tabela?\n\n"
            "  Se o i2cdetect também não vê o 0x24, o problema é elétrico, não de\n"
            "  protocolo: nem o ACK de endereço do I2C está acontecendo."
        )
    if len(payload) < 4 or payload[0] != 0x03:
        fail(f"resposta inesperada do GetFirmwareVersion: {hexdump(payload)}")

    ic, ver, rev, support = payload[1], payload[2], payload[3], payload[4] if len(payload) > 4 else 0
    ok(f"o módulo respondeu — IC 0x{ic:02x}, firmware {ver}.{rev}")
    if ic == 0x32:
        info("IC 0x32 = PN532, como esperado")
    else:
        warn(f"IC 0x{ic:02x} não é o 0x32 do PN532")
    modes = []
    if support & 0x01:
        modes.append("ISO14443A")
    if support & 0x02:
        modes.append("ISO14443B")
    if support & 0x04:
        modes.append("ISO18092")
    info(f"suporta: {', '.join(modes) if modes else '(nada reportado)'}")


def phase_sam(dev):
    step("3/4  SAMConfiguration (modo normal)")
    # 0x14, mode=normal(0x01), timeout=0x14 (1s), IRQ=0x01
    payload, err = dev.send_command([CMD_SAM_CONFIGURATION, 0x01, 0x14, 0x01], 9, timeout=1.0)
    if err:
        fail(f"SAMConfiguration falhou: {err}")
    if not payload or payload[0] != 0x15:
        fail(f"resposta inesperada do SAMConfiguration: {hexdump(payload)}")
    ok("configurado — pronto pra ler tags")


def phase_poll(dev, timeout_s):
    step(f"4/4  Procurando tags ({timeout_s}s)")
    info("encoste uma tag na antena do módulo")
    info("Ctrl+C para sair")

    deadline = time.monotonic() + timeout_s
    current_uid = None
    seen = 0

    while time.monotonic() < deadline:
        payload, err = dev.send_command(
            [CMD_IN_LIST_PASSIVE_TARGET, 0x01, 0x00], 25, timeout=0.6
        )

        if err or not payload or payload[0] != 0x4B:
            # timeout sem tag no campo é o caso normal deste loop
            if current_uid is not None:
                info(f"{C.BLUE}tag removida{C.RESET}  {current_uid}")
                current_uid = None
            time.sleep(0.15)
            continue

        found = payload[1]
        if found == 0:
            if current_uid is not None:
                info(f"{C.BLUE}tag removida{C.RESET}  {current_uid}")
                current_uid = None
            time.sleep(0.15)
            continue

        # payload: 4B NbTg Tg SENS_RES(2) SEL_RES UIDLen UID...
        sel_res = payload[5]
        uid_len = payload[6]
        uid = payload[7:7 + uid_len]
        uid_hex = hexdump(uid).upper().replace(" ", "")

        if uid_hex != current_uid:
            current_uid = uid_hex
            seen += 1
            kind = SAK_TYPES.get(sel_res, f"desconhecido (SAK 0x{sel_res:02x})")
            print(f"    {C.GREEN}tag presente{C.RESET}  UID {C.BOLD}{uid_hex}{C.RESET}  ({uid_len} bytes)")
            info(f"             tipo: {kind}")

        time.sleep(0.15)

    print()
    if seen:
        ok(f"{seen} leitura(s) de tag. O hardware NFC está funcionando.")
    else:
        warn("nenhuma tag lida.")
        info("O módulo responde aos comandos, então o rádio/antena é o próximo suspeito —")
        info("ou simplesmente nenhuma tag chegou perto o suficiente (~2cm).")


def main():
    parser = argparse.ArgumentParser(
        description="Probe do PN532 em I2C, sem dependências externas.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--bus", type=int, default=1, help="número do barramento I2C (padrão: 1)")
    parser.add_argument("--address", type=lambda s: int(s, 0), default=PN532_I2C_ADDRESS,
                        help="endereço I2C (padrão: 0x24)")
    parser.add_argument("--timeout", type=int, default=30, help="segundos procurando tags (padrão: 30)")
    parser.add_argument("--verbose", action="store_true", help="mostra os bytes que entram e saem")
    args = parser.parse_args()

    print(f"{C.BOLD}PN532 — probe I2C{C.RESET}")

    dev = PN532I2C(args.bus, args.address, args.verbose)
    try:
        phase_bus(dev, args)
        phase_firmware(dev)
        phase_sam(dev)
        phase_poll(dev, args.timeout)
    except KeyboardInterrupt:
        print("\n\ninterrompido")
    finally:
        dev.close()


if __name__ == "__main__":
    main()
