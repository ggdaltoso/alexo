#!/bin/bash
# Registra o estado do Wi-Fi do Pi em disco, uma linha por amostra.
#
# Roda NO PI, não na máquina de dev: se a rede cair, uma medição feita de fora
# perde a conexão e os dados exatamente no instante que interessa. Gravando
# localmente, a queda fica registrada de dentro.
#
# Também pinga o gateway a cada amostra -- é o que distingue "sinal fraco" de
# "rádio parou de responder", que é o sintoma que estamos investigando.
#
# Escreve em stdout, não em arquivo. Rodando como serviço, quem guarda é o
# journald -- que já está persistente e com teto de 50 MB, então não é preciso
# inventar rotação de log. Um arquivo em /tmp, como era antes, some no reboot,
# e foi assim que perdemos o histórico da queda de 25/08.
#
# Como serviço (é o normal):
#   sudo systemctl enable --now wifi-monitor
#   journalctl -u wifi-monitor -f
#   journalctl -u wifi-monitor --since '-2h' | grep SEM_RESPOSTA
#
# À mão:
#   bash scripts/wifi-monitor.sh | tee /tmp/wifi.log
#
# INTERVALO=10 bash scripts/wifi-monitor.sh    # padrão: 15s
set -u
export PATH=/usr/sbin:/sbin:$PATH

INTERVALO=${INTERVALO:-15}
GATEWAY=$(ip route | awk '/^default/ {print $3; exit}')

echo "# iniciado $(date '+%F %T')  gateway=$GATEWAY  intervalo=${INTERVALO}s"
echo "# horario  sinal_dBm  qualidade  bitrate_Mbps  ping_ms  carga  servicos_ativos"

while true; do
  linha=$(iwconfig wlan0 2>/dev/null)
  sinal=$(echo "$linha" | grep -oP 'Signal level=\K-?[0-9]+' || echo "?")
  qual=$(echo "$linha" | grep -oP 'Link Quality=\K[0-9]+/[0-9]+' || echo "?")
  taxa=$(echo "$linha" | grep -oP 'Bit Rate=\K[0-9.]+' || echo "?")

  # -W 2: falhar rápido. Uma amostra que demora 10s desalinha a série temporal.
  ping_ms=$(ping -c 1 -W 2 "$GATEWAY" 2>/dev/null | grep -oP 'time=\K[0-9.]+' || echo "SEM_RESPOSTA")

  carga=$(cut -d' ' -f1 /proc/loadavg)

  ativos=""
  for s in alexo-mpv alexo alexo-display; do
    [ "$(systemctl is-active $s.service 2>/dev/null)" = "active" ] && ativos="$ativos$s "
  done
  [ -z "$ativos" ] && ativos="(nenhum)"

  # Sinal como '?' significa que o iwconfig não reportou nada -- interface
  # desassociada. É a assinatura da queda de verdade, diferente de ping lento
  # por Pi ocupado.
  printf '%s  %-4s  %-6s  %-5s  %-12s  %-5s  %s\n' \
    "$(date '+%H:%M:%S')" "$sinal" "$qual" "$taxa" "$ping_ms" "$carga" "$ativos"

  sleep "$INTERVALO"
done
