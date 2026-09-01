#!/usr/bin/env bash
#
# Traz o histórico de prints do Pi para a máquina local.
#
# O histórico vive em backend/uploads/prints/ no Pi, que é justamente uma pasta
# que o deploy nunca toca -- conteúdo do Pi, não do repo. O efeito colateral é
# que ele existe num cartão SD só. Este script é a cópia de segurança.
#
# Sentido único, do Pi para cá: quem guarda print é o admin rodando no Pi, e uma
# sincronização nos dois sentidos só criaria oportunidade de sobrescrever o
# original com uma cópia velha.
#
# Como o deploy.sh, roda sem --delete: apagar um print no admin não apaga a
# cópia local. Se a intenção era apagar dos dois lados, apague aqui à mão.
#
# Host e caminho vêm do ambiente (ALEXO_DEPLOY_HOST / ALEXO_DEPLOY_PATH), do
# .env.deploy na raiz do repo, ou das flags.
#
# Uso:
#   npm run prints:pull
#   npm run prints:pull -- --dry-run
#   npm run prints:pull -- --host pi@192.168.0.96 --destino ~/alexo-prints

set -euo pipefail

cd "$(dirname "$0")/.."

env_host="${ALEXO_DEPLOY_HOST:-}"
env_path="${ALEXO_DEPLOY_PATH:-}"
flag_host=""
flag_path=""
DESTINO="prints"
DRY_RUN=0

# shellcheck source=/dev/null
[ -f .env.deploy ] && source .env.deploy

while [ $# -gt 0 ]; do
  case "$1" in
    --host)    flag_host="$2"; shift 2 ;;
    --path)    flag_path="$2"; shift 2 ;;
    --destino) DESTINO="$2"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) sed -n '2,22p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) printf 'opção desconhecida: %s\n' "$1" >&2; exit 1 ;;
  esac
done

HOST="${flag_host:-${env_host:-${ALEXO_DEPLOY_HOST:-pi@raspberrypi.local}}}"
REMOTE_PATH="${flag_path:-${env_path:-${ALEXO_DEPLOY_PATH:-/home/pi/alexo}}}"

step() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
info() { printf '    %s\n' "$1"; }
fail() { printf '\n\033[31m!! %s\033[0m\n' "$1" >&2; exit 1; }

step "Checando ambiente"
command -v rsync >/dev/null || fail "rsync não encontrado na máquina local."
info "origem:  $HOST:$REMOTE_PATH/backend"
info "destino: $DESTINO/"
[ "$DRY_RUN" -eq 1 ] && info "DRY RUN: nada será copiado."

ssh -o BatchMode=yes -o ConnectTimeout=8 "$HOST" true 2>/dev/null \
  || fail "não consegui conectar em $HOST sem senha.

  - Confirme o endereço (--host pi@IP, ou ALEXO_DEPLOY_HOST no .env.deploy)
  - Configure a chave ssh: ssh-copy-id $HOST"

# Histórico vazio não é erro: é um Pi onde ninguém guardou print ainda.
if ! ssh "$HOST" "test -d '$REMOTE_PATH/backend/uploads/prints'"; then
  info "nenhum print guardado no Pi ainda — nada a trazer."
  exit 0
fi

RSYNC_FLAGS=(-az --human-readable --info=stats1)
[ "$DRY_RUN" -eq 1 ] && RSYNC_FLAGS+=(--dry-run --verbose)

mkdir -p "$DESTINO"

step "Trazendo as imagens"
rsync "${RSYNC_FLAGS[@]}" "$HOST:$REMOTE_PATH/backend/uploads/prints/" "$DESTINO/"

# O índice vem junto e vira index.json ao lado das imagens: sem ele as notas e o
# contexto (música, tag) ficariam só no Pi, e a cópia local seria de novo uma
# pasta de PNGs ordenados por nome -- exatamente o que este histórico substituiu.
step "Trazendo o índice"
rsync "${RSYNC_FLAGS[@]}" "$HOST:$REMOTE_PATH/backend/data/prints.json" "$DESTINO/index.json" \
  || info "índice ainda não existe no Pi (nenhum print guardado pelo admin)."

if [ "$DRY_RUN" -eq 0 ]; then
  total=$(find "$DESTINO" -name '*.png' -type f | wc -l | tr -d ' ')
  step "Pronto"
  info "$total print(s) em $DESTINO/"
  info "a pasta é gitignored: para publicar um print, copie para screens/ à mão."
fi
