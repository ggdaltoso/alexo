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
# A temperatura entra na mesma série de propósito: o Pi chegou a 70,8 °C com
# tudo rodando, e chip de rádio degrada com calor. Ter as duas colunas lado a
# lado responde se elas sobem juntas ou são independentes -- sem isso, é
# especulação.
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
echo "# horario  ssid  sinal_dBm  qualidade  bitrate_Mbps  ping_ms  carga  temp_C  bssid  servicos_ativos"

while true; do
  linha=$(iwconfig wlan0 2>/dev/null)
  sinal=$(echo "$linha" | grep -oP 'Signal level=\K-?[0-9]+' || echo "?")
  qual=$(echo "$linha" | grep -oP 'Link Quality=\K[0-9]+/[0-9]+' || echo "?")
  taxa=$(echo "$linha" | grep -oP 'Bit Rate=\K[0-9.]+' || echo "?")

  # BSSID identifica em QUAL ponto de acesso ele esta. Numa rede mesh isso e o
  # que distingue "o rádio caiu" de "ele trocou de nó e o novo nó nao passa
  # trafego" -- em 26/08/2026 o sinal sozinho nao permitiu decidir entre as duas.
  bssid=$(echo "$linha" | grep -oP 'Access Point: \K[0-9A-Fa-f:]+' || echo "?")

  # SSID junto do BSSID porque o wpa_supplicant nao registra associacao no
  # journal deste sistema: sem isto, nao ha como saber em que rede ele estava
  # numa janela passada -- lacuna que impediu de responder se a instabilidade
  # mudou ao trocar de rede em 26/08/2026.
  ssid=$(echo "$linha" | grep -oP 'ESSID:"\K[^"]*' || echo "?")

  # -W 2: falhar rápido. Uma amostra que demora 10s desalinha a série temporal.
  ping_ms=$(ping -c 1 -W 2 "$GATEWAY" 2>/dev/null | grep -oP 'time=\K[0-9.]+' || echo "SEM_RESPOSTA")

  carga=$(cut -d' ' -f1 /proc/loadavg)

  # Pelo sysfs, não pelo vcgencmd: é um read de arquivo em vez de um processo
  # novo a cada 15s, e o valor vem em milésimos de grau.
  temp=$(awk '{printf "%.1f", $1/1000}' /sys/class/thermal/thermal_zone0/temp 2>/dev/null || echo "?")

  ativos=""
  for s in alexo-mpv alexo alexo-display; do
    [ "$(systemctl is-active $s.service 2>/dev/null)" = "active" ] && ativos="$ativos$s "
  done
  [ -z "$ativos" ] && ativos="(nenhum)"

  # Sinal como '?' significa que o iwconfig não reportou nada -- interface
  # desassociada. É a assinatura da queda de verdade, diferente de ping lento
  # por Pi ocupado.
  printf '%s  %-10.10s  %-4s  %-6s  %-5s  %-12s  %-5s  %-5s  %-17s  %s\n' \
    "$(date '+%H:%M:%S')" "$ssid" "$sinal" "$qual" "$taxa" "$ping_ms" "$carga" "$temp" "$bssid" "$ativos"

  sleep "$INTERVALO"
done
