#!/usr/bin/env python3
"""
Reduz as fotos da galeria para a resolução que a tela realmente usa.

O problema que isto resolve: fotos de celular chegam em 3468x4624. O arquivo é
pequeno porque JPEG comprime bem, mas para desenhar na tela o navegador precisa
descomprimir, e aí cada pixel vira 4 bytes -- 61 MB de RAM por foto, num
aparelho com 430 MB. O painel da galeria tem cerca de 240x230 pixels.

Medido em 25/08/2026: com as fotos originais o renderer do Chromium ia de 115 MB
a 175 MB conforme o slideshow avançava, o swap enchia e o Wi-Fi caía junto --
porque no BCM2835 o cartão SD e o rádio dividem o controlador SDIO.

Os originais são preservados em uploads/gallery-originais/ antes de qualquer
escrita. Reexecutar é seguro: arquivos já reduzidos são ignorados.

Uso:
    python3 backend/scripts/resize-gallery.py --dry-run
    python3 backend/scripts/resize-gallery.py
    python3 backend/scripts/resize-gallery.py --lado 640
    python3 backend/scripts/resize-gallery.py --arquivo <caminho>   # um só

O modo --arquivo é o que o server.js chama logo após cada upload, para que uma
foto grande nunca chegue a ser exibida em resolução plena. Sem isso, bastaria um
upload para o problema voltar.
"""

import argparse
import os
import shutil
import sys

try:
    from PIL import Image
except ImportError:
    sys.exit("PIL/Pillow não encontrado. No Pi: sudo apt install python3-pil")

AQUI = os.path.dirname(os.path.abspath(__file__))
GALERIA = os.path.join(AQUI, "..", "uploads", "gallery")
ORIGINAIS = os.path.join(AQUI, "..", "uploads", "gallery-originais")

# Lado maior, em pixels. 800 é ~3x o painel (240x230), o que dá folga para
# recorte e para uma tela melhor no futuro sem voltar a decodificar milhões de
# pixels à toa.
LADO_PADRAO = 800


def mb_decodificada(w, h):
    return w * h * 4 / 1048576


def reduzir_um(caminho, lado):
    """Reduz um arquivo no lugar. Devolve 0 em sucesso, 1 em falha.

    Silencioso de propósito no caminho feliz: quem chama é o servidor, e ruído
    no stdout de cada upload não ajuda ninguém.
    """
    try:
        with Image.open(caminho) as img:
            w, h = img.size
            formato = img.format
            if max(w, h) <= lado:
                return 0
        with Image.open(caminho) as img:
            img = img.convert("RGB")
            img.thumbnail((lado, lado), Image.LANCZOS)
            img.save(caminho, format=formato or "JPEG", quality=85, optimize=True)
        return 0
    except Exception as e:
        print(f"falha ao reduzir {caminho}: {e}", file=sys.stderr)
        return 1


def main():
    p = argparse.ArgumentParser(description="Reduz as fotos da galeria.")
    p.add_argument("--dry-run", action="store_true", help="só relata, não escreve")
    p.add_argument("--lado", type=int, default=LADO_PADRAO, help=f"lado maior (padrão: {LADO_PADRAO})")
    p.add_argument("--arquivo", help="reduz um arquivo só, pelo caminho (usado no upload)")
    args = p.parse_args()

    if args.arquivo:
        sys.exit(reduzir_um(args.arquivo, args.lado))

    base = os.path.normpath(GALERIA)
    if not os.path.isdir(base):
        sys.exit(f"{base} não existe")

    arquivos = sorted(f for f in os.listdir(base) if not f.startswith("."))
    if not arquivos:
        sys.exit("galeria vazia")

    if not args.dry_run:
        os.makedirs(ORIGINAIS, exist_ok=True)

    antes_ram = depois_ram = antes_disco = depois_disco = 0
    mexidos = 0

    for nome in arquivos:
        caminho = os.path.join(base, nome)
        try:
            with Image.open(caminho) as img:
                w, h = img.size
                formato = img.format
        except Exception as e:
            print(f"  {nome}: não é imagem legível ({e})")
            continue

        tam = os.path.getsize(caminho)
        antes_ram += mb_decodificada(w, h)
        antes_disco += tam

        if max(w, h) <= args.lado:
            depois_ram += mb_decodificada(w, h)
            depois_disco += tam
            print(f"  {nome[:12]}…  {w}x{h}  já está pequena, ignorada")
            continue

        escala = args.lado / max(w, h)
        nw, nh = int(w * escala), int(h * escala)
        depois_ram += mb_decodificada(nw, nh)
        mexidos += 1

        if args.dry_run:
            print(f"  {nome[:12]}…  {w}x{h} → {nw}x{nh}   "
                  f"{mb_decodificada(w, h):.0f} MB → {mb_decodificada(nw, nh):.1f} MB na RAM")
            continue

        # Backup antes de qualquer escrita. São fotos do usuário: se algo der
        # errado no redimensionamento, o original tem que sobreviver.
        destino_backup = os.path.join(ORIGINAIS, nome)
        if not os.path.exists(destino_backup):
            shutil.copy2(caminho, destino_backup)

        with Image.open(caminho) as img:
            img = img.convert("RGB")
            img.thumbnail((args.lado, args.lado), Image.LANCZOS)
            img.save(caminho, format=formato or "JPEG", quality=85, optimize=True)

        novo_tam = os.path.getsize(caminho)
        depois_disco += novo_tam
        print(f"  {nome[:12]}…  {w}x{h} → {nw}x{nh}   "
              f"{tam // 1024} KB → {novo_tam // 1024} KB")

    print()
    print(f"  RAM decodificada:  {antes_ram:.0f} MB → {depois_ram:.1f} MB")
    if args.dry_run:
        print(f"  {mexidos} arquivo(s) seriam reduzidos. Nada foi escrito.")
    else:
        print(f"  {mexidos} arquivo(s) reduzidos. Originais em uploads/gallery-originais/")


if __name__ == "__main__":
    main()
