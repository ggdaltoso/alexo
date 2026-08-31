#!/usr/bin/env bash
#
# Resume o log do wifi-monitor: disponibilidade, rede, latência, temperatura.
#
#   bash scripts/wifi-resumo.sh                 # do dev: puxa o boot atual do Pi
#   bash scripts/wifi-resumo.sh --local         # rodando no próprio Pi
#   bash scripts/wifi-resumo.sh --desde '-6h'
#   bash scripts/wifi-resumo.sh --tudo          # todos os boots guardados
#   bash scripts/wifi-resumo.sh /tmp/wifi.log   # arquivo salvo à mão
#   journalctl -u wifi-monitor -o cat | bash scripts/wifi-resumo.sh -
#
# Host igual ao do deploy: --host, ALEXO_DEPLOY_HOST ou .env.deploy.
#
# ---------------------------------------------------------------------------
# Por que existe: as colunas do wifi-monitor NÃO podem ser lidas por índice.
# O SSID tem espaço ("GAMA Deco") e a última coluna lista de zero a três
# serviços, então nem contar da esquerda nem contar de NF funciona -- as duas
# tentativas produziram números errados que quase viraram conclusão (uma delas
# reportou latência média de 60 ms lendo a coluna de temperatura). A única
# leitura estável é casar a linha inteira de uma vez, ancorando no MAC do BSSID,
# que tem formato fixo. É o que o programa perl abaixo faz.
#
# mawk (o awk padrão do Raspbian) não tem grupos de captura, daí perl.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

env_host="${ALEXO_DEPLOY_HOST:-}"
# shellcheck disable=SC1091
[ -f "$REPO_ROOT/.env.deploy" ] && source "$REPO_ROOT/.env.deploy"
HOST="${env_host:-${ALEXO_DEPLOY_HOST:-pi@raspberrypi.local}}"

MODO=remoto
FONTE=""
DESDE=""
TUDO=0

while [ $# -gt 0 ]; do
  case "$1" in
    --host)   HOST="$2"; shift 2 ;;
    --local)  MODO=local; shift ;;
    --desde)  DESDE="$2"; shift 2 ;;
    --tudo)   TUDO=1; shift ;;
    -h|--help) awk 'NR>1 && /^# ---/{exit} NR>1 && /^#/{sub(/^# ?/,""); print}' "${BASH_SOURCE[0]}"; exit 0 ;;
    -)        MODO=stdin; shift ;;
    -*)       echo "flag desconhecida: $1" >&2; exit 2 ;;
    *)        MODO=arquivo; FONTE="$1"; shift ;;
  esac
done

# journalctl -b limita ao boot atual: sem isso o resumo mistura sessões e a
# contagem de quedas deixa de significar alguma coisa.
jcmd="journalctl -u wifi-monitor --no-pager -o cat"
[ "$TUDO" -eq 1 ] || jcmd="$jcmd -b"
[ -n "$DESDE" ] && jcmd="$jcmd --since '$DESDE'"

case "$MODO" in
  stdin)   cat ;;
  arquivo) cat -- "$FONTE" ;;
  local)   eval "$jcmd" ;;
  remoto)
    ssh -o BatchMode=yes -o ConnectTimeout=8 "$HOST" "$jcmd" 2>/dev/null \
      || { echo "não consegui ler o log em $HOST (--host <user@host>, ou --local se já estiver no Pi)" >&2; exit 1; }
    ;;
esac | TUDO="$TUDO" perl -e '
use strict; use warnings;

# horario ssid sinal qualidade bitrate ping carga temp bssid servicos
# O .+? do SSID para no primeiro campo que parece sinal; o MAC ancora o resto.
my $LINHA = qr{
  ^(\d\d:\d\d:\d\d)\s+(.+?)\s+(-?\d+|\?)\s+(\S+/\S+|\?)\s+(\S+)\s+
   (\S+)\s+(\S+)\s+(\S+)\s+([0-9A-Fa-f:]{17}|\?)\s*(.*)$
}x;

my (@ping, @sinal, @temp, @carga, @eventos);
my (%ssid, %bssid, $n, $falhas, $desassoc, $degradado);
my ($t0, $t1, $ssid_ant, $bssid_ant, $serv_ant);
$n = $falhas = $desassoc = $degradado = 0;

while (my $l = <STDIN>) {
  next unless my @c = $l =~ $LINHA;
  my ($hora, $ssid, $sinal, undef, undef, $ping, $carga, $temp, $bssid, $serv) = @c;
  $n++;
  $t0 //= $hora; $t1 = $hora;
  $ssid{$ssid}++; $bssid{$bssid}++;

  if ($ping eq "SEM_RESPOSTA") { $falhas++; push @eventos, "$hora  ping sem resposta  (sinal $sinal dBm, carga $carga)" }
  else { push @ping, $ping + 0 }

  # sinal "?" = iwconfig nao reportou nada = interface desassociada. E a queda
  # de verdade, diferente de ping lento por Pi ocupado.
  if ($sinal eq "?") { $desassoc++; push @eventos, "$hora  DESASSOCIADO da rede" }
  else { push @sinal, $sinal + 0 }

  push @temp,  $temp  + 0 if $temp  =~ /^[\d.]+$/;
  push @carga, $carga + 0 if $carga =~ /^[\d.]+$/;

  push @eventos, "$hora  trocou de rede: $ssid_ant -> $ssid"        if defined $ssid_ant  && $ssid_ant  ne $ssid;
  push @eventos, "$hora  trocou de ponto de acesso: $bssid_ant -> $bssid" if defined $bssid_ant && $bssid_ant ne $bssid;
  push @eventos, "$hora  serviços: $serv_ant -> $serv"              if defined $serv_ant  && $serv_ant  ne $serv;
  ($ssid_ant, $bssid_ant, $serv_ant) = ($ssid, $bssid, $serv);

  $degradado++ if $serv !~ /alexo\b/ || $serv =~ /nenhum/;
}

unless ($n) { warn "nenhuma amostra encontrada -- o log está vazio ou não é do wifi-monitor\n"; exit 1 }

sub est {
  my @v = sort { $a <=> $b } @_;
  return unless @v;
  my $s = 0; $s += $_ for @v;
  ( min => $v[0], max => $v[-1], media => $s / @v,
    mediana => $v[ int(@v / 2) ], p95 => $v[ int($#v * 0.95) ] );
}
sub linha_stat {
  my ($rot, $fmt, $un, @v) = @_;
  return printf("  %-14s (sem dados)\n", $rot) unless @v;
  my %e = est(@v);
  printf "  %-14s min $fmt   média $fmt   máx $fmt%s\n", $rot, $e{min}, $e{media}, $e{max}, $un;
}
sub chaves { my $h = shift; join ", ", map { "$_ (" . $h->{$_} . "x)" } sort { $h->{$b} <=> $h->{$a} } keys %$h }

my $dur = @ping || @sinal ? sprintf("%s a %s", $t0, $t1) : "?";
printf "\n== janela ==\n  %d amostras   %s\n", $n, $dur;
# O log só grava HH:MM:SS, então uma janela que cruza boots parece contínua e não é.
print "  atenção: --tudo junta boots diferentes; as estatísticas misturam sessões\n"
  if ($ENV{TUDO} || 0) eq "1";

printf "\n== disponibilidade ==\n";
printf "  %-14s %d de %d amostras (%.1f%%)\n", "falhas ping",  $falhas,   $n, 100 * $falhas / $n;
printf "  %-14s %d de %d amostras (%.1f%%)\n", "desassociado", $desassoc, $n, 100 * $desassoc / $n;
printf "  %-14s %d de %d amostras\n",          "serv. faltando", $degradado, $n;

printf "\n== rede ==\n";
printf "  %-14s %s\n", "ssid",  chaves(\%ssid);
printf "  %-14s %s\n", "bssid", chaves(\%bssid);
printf "  %-14s %s\n", "",
  keys %bssid > 1 ? "mais de um nó: houve roaming na janela" : "nó único: sem roaming na janela";

printf "\n== medidas ==\n";
linha_stat("ping",  "%.1f", " ms",   @ping);
if (@ping) {
  my %e = est(@ping);
  printf "  %-14s mediana %.1f ms   p95 %.1f ms   acima de 100 ms: %d\n",
    "", $e{mediana}, $e{p95}, scalar grep { $_ > 100 } @ping;
}
linha_stat("sinal", "%.0f", " dBm",  @sinal);
linha_stat("temp",  "%.1f", " °C",   @temp);
linha_stat("carga", "%.2f", "",      @carga);

if (@eventos) {
  printf "\n== eventos (%d) ==\n", scalar @eventos;
  print "  $_\n" for @eventos[0 .. ($#eventos > 39 ? 39 : $#eventos)];
  printf "  ... e mais %d\n", @eventos - 40 if @eventos > 40;
} else {
  print "\n== eventos ==\n  nenhum: sem queda, sem roaming, sem troca de rede\n";
}
print "\n";
'
