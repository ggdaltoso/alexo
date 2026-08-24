#!/bin/bash
# Compara o leitor Node (backend/nfcReader.js) com o leitor Python de referência
# (nfc-read-uid.py), na MESMA sessão e com a MESMA tag parada na antena.
#
# Existe por causa de uma ambiguidade real de diagnóstico: quando o Node não lê
# nada, isso tanto pode ser bug no porte quanto tag fora do campo. Rodar os dois
# separadamente não resolve, porque a posição da tag muda entre as tentativas.
#
# O truque é não depender de timing: a fase 1 fica esperando até o Python ver a
# tag, e só então o Node roda. Se o Python viu e o Node não vê logo em seguida,
# com a tag imóvel, o problema é do nfcReader.js — sem margem para dúvida.
#
# Uso: bash backend/scripts/nfc-node-vs-python.sh
set -u

cd "$(dirname "$0")/../.." || exit 1
export PATH="$HOME/node-v14.15.1-linux-armv6l/bin:$PATH"

PY=backend/scripts/nfc-read-uid.py
NODE_TEST=backend/scripts/nfc-reader-test.js
WAIT_S=${WAIT_S:-180}

echo "=== FASE 1: esperando o Python ver uma tag (ate ${WAIT_S}s) ==="
echo "    Encoste uma tag e DEIXE ELA PARADA ate o script terminar."
echo

UID_LIDO=$(timeout "$WAIT_S" python3 -u "$PY" 2>&1 | grep -m1 -E '^[0-9A-F]{8,20}$')

if [ -z "$UID_LIDO" ]; then
  echo "!! o Python nao leu nenhuma tag em ${WAIT_S}s."
  echo "   Nada a comparar: o problema esta no hardware/posicionamento, nao no Node."
  exit 1
fi

echo "OK  Python leu: $UID_LIDO"
echo "    Nao tire a tag. Node comeca em 1s..."
sleep 1
echo

echo "=== FASE 2: Node, 20s, com a mesma tag parada ==="
timeout 30 node "$NODE_TEST" 20 2>&1
echo

echo "=== VEREDITO ==="
echo "Python leu '$UID_LIDO' com a tag nessa posicao."
echo "Se a fase 2 acima diz '0 leitura(s)', o bug e do backend/nfcReader.js."
echo "Se leu o mesmo UID, os dois estao corretos e as falhas anteriores foram posicionamento."
