#!/usr/bin/env bash
#
# Deploy do Alexo para o Raspberry Pi.
#
#   npm run deploy
#   npm run deploy -- --host pi@192.168.1.50
#   npm run deploy -- --dry-run
#   npm run deploy -- --skip-build --no-restart
#
# Host e caminho podem vir do ambiente (ALEXO_DEPLOY_HOST / ALEXO_DEPLOY_PATH),
# de um arquivo .env.deploy na raiz do repo, ou das flags acima.
#
# O que NÃO é enviado (de propósito — é conteúdo/config que vive no Pi):
#   backend/data/     gallery.json e, no futuro, o catálogo de músicas
#   backend/uploads/  fotos da galeria e MP3s
#   .env              config de produção, com o token do Todoist
#   node_modules/     reinstalado no Pi (tem addon nativo)
#
# rsync roda sem --delete: nada é apagado no Pi por este script.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# ------------------------------------------------------------------ config

# Precedência: flag de linha de comando > variável de ambiente > .env.deploy > padrão.
# O que veio do ambiente é guardado antes do source, senão o arquivo clobberia.
env_host="${ALEXO_DEPLOY_HOST:-}"
env_path="${ALEXO_DEPLOY_PATH:-}"
env_services="${ALEXO_DEPLOY_SERVICES:-}"
env_npm="${ALEXO_DEPLOY_NPM:-}"

# shellcheck disable=SC1091
[ -f .env.deploy ] && source .env.deploy

HOST="${env_host:-${ALEXO_DEPLOY_HOST:-pi@raspberrypi.local}}"
REMOTE_PATH="${env_path:-${ALEXO_DEPLOY_PATH:-/home/pi/alexo}}"
SERVICES="${env_services:-${ALEXO_DEPLOY_SERVICES:-alexo.service alexo-display.service}}"
REMOTE_NPM="${env_npm:-${ALEXO_DEPLOY_NPM:-}}"

SKIP_BUILD=0
NO_RESTART=0
DRY_RUN=0

usage() {
  cat <<'EOF'
Atalhos npm:

  npm run deploy              build + envia + reinicia os serviços
  npm run deploy:dry          mostra o que seria enviado, sem tocar no Pi
  npm run deploy:fast         pula o build, envia o dist atual
  npm run deploy:no-restart   envia sem reiniciar os serviços

Flags (todos os atalhos aceitam flags extras depois de --):

  --host <user@host>   destino ssh (padrão: pi@raspberrypi.local)
  --path <dir>         diretório no Pi (padrão: /home/pi/alexo)
  --skip-build         não roda o build do frontend, envia o dist atual
  --no-restart         envia os arquivos mas não reinicia os serviços
  --dry-run            mostra o que seria enviado, sem enviar nem reiniciar
  -h, --help           esta ajuda

  ex.: npm run deploy:dry -- --host pi@192.168.1.50

Para não repetir o host, crie um .env.deploy na raiz:
  ALEXO_DEPLOY_HOST=pi@192.168.1.50
  ALEXO_DEPLOY_PATH=/home/pi/alexo
  ALEXO_DEPLOY_NPM=/caminho/para/npm    # opcional, só se a detecção falhar
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --host)       HOST="$2"; shift 2 ;;
    --path)       REMOTE_PATH="$2"; shift 2 ;;
    --skip-build) SKIP_BUILD=1; shift ;;
    --no-restart) NO_RESTART=1; shift ;;
    --dry-run)    DRY_RUN=1; shift ;;
    -h|--help)    usage; exit 0 ;;
    *) echo "Erro: argumento desconhecido: $1" >&2; echo; usage; exit 2 ;;
  esac
done

step() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
info() { printf '    %s\n' "$1"; }
fail() { printf '\n\033[31m!! %s\033[0m\n' "$1" >&2; exit 1; }

# --------------------------------------------------------------- preflight

step "Checando ambiente"

command -v rsync >/dev/null || fail "rsync não encontrado na máquina local."

if [ "$DRY_RUN" -eq 1 ]; then
  info "DRY RUN: nada será enviado nem reiniciado."
fi

info "destino: $HOST:$REMOTE_PATH"

if ! ssh -o BatchMode=yes -o ConnectTimeout=8 "$HOST" true 2>/dev/null; then
  fail "não consegui conectar em $HOST sem senha.

  - Confirme o endereço (--host pi@IP, ou ALEXO_DEPLOY_HOST no .env.deploy)
  - Configure a chave ssh: ssh-copy-id $HOST
    (sem isso o rsync pediria senha várias vezes no meio do deploy)"
fi

ssh "$HOST" "test -d '$REMOTE_PATH'" \
  || fail "$REMOTE_PATH não existe em $HOST. Crie o diretório e copie o .env de produção antes do primeiro deploy."

ssh "$HOST" "command -v rsync >/dev/null" \
  || fail "rsync não está instalado no Pi. Instale com: ssh $HOST sudo apt install rsync"

info "conexão ok"

# `ssh host "cmd"` abre um shell não-interativo e não-login, que não carrega
# ~/.profile nem o bloco do nvm no ~/.bashrc. E há Pis em que o npm nunca está
# no PATH (instalação por tarball, com o systemd chamando o caminho absoluto).
# Por isso o npm é descoberto, não assumido.
if [ -z "$REMOTE_NPM" ]; then
  # Cada candidato é validado antes de ser aceito: shells de login podem imprimir
  # banners no stdout (o Raspberry Pi OS avisa sobre a senha padrão do usuário pi),
  # e esse ruído se misturaria ao caminho.
  REMOTE_NPM="$(ssh "$HOST" 'bash -s' <<'REMOTE'
try() {
  [ -n "$1" ] && [ "${1#/}" != "$1" ] && [ -x "$1" ] && { echo "$1"; exit 0; }
  return 0
}
try "$(command -v npm 2>/dev/null | tail -1)"
try "$(bash -lc 'command -v npm' 2>/dev/null | tail -1)"
for candidate in /home/*/node-*/bin/npm /usr/local/lib/nodejs/*/bin/npm /opt/node*/bin/npm; do
  try "$candidate"
done
exit 1
REMOTE
  )" || REMOTE_NPM=""
fi

# O npm é um script com shebang `#!/usr/bin/env node`, então chamar o caminho
# absoluto não basta: o `node` precisa estar no PATH. É o mesmo motivo pelo qual
# o unit do systemd carrega um Environment="PATH=.../bin:...".
REMOTE_NODE_BIN=""
if [ -n "$REMOTE_NPM" ]; then
  REMOTE_NODE_BIN="$(dirname "$REMOTE_NPM")"
  ssh "$HOST" "PATH='$REMOTE_NODE_BIN':\$PATH '$REMOTE_NPM' --version >/dev/null 2>&1" \
    || REMOTE_NPM=""
fi

if [ -z "$REMOTE_NPM" ]; then
  fail "não encontrei um npm utilizável em $HOST.

  Procurei no PATH, num shell de login e nos caminhos usuais de instalação
  por tarball. Descubra o caminho e informe ao script:

    ssh $HOST 'systemctl cat alexo.service | grep ExecStart'   # costuma ter o caminho
    echo 'ALEXO_DEPLOY_NPM=/caminho/para/npm' >> .env.deploy"
fi

info "npm no Pi: $REMOTE_NPM (v$(ssh "$HOST" "PATH='$REMOTE_NODE_BIN':\$PATH '$REMOTE_NPM' --version"))"

# ------------------------------------------------------------------- build

if [ "$SKIP_BUILD" -eq 1 ]; then
  step "Build do frontend (pulado por --skip-build)"
else
  step "Buildando o frontend"
  npm run build
fi

[ -f frontend/dist/index.html ] \
  || fail "frontend/dist/index.html não existe. Rode sem --skip-build."

info "dist: $(du -h frontend/dist/index.html | cut -f1)"

# ------------------------------------------------------------------ upload

step "Enviando arquivos"

RSYNC_FLAGS=(-az --human-readable --info=stats1)
[ "$DRY_RUN" -eq 1 ] && RSYNC_FLAGS+=(--dry-run --verbose)

# rsync só lista o que mudou. Sem o rótulo, uma lista vazia parece que a
# etapa foi pulada, quando na verdade quer dizer "o Pi já está igual".
sync_part() {
  local label="$1"; shift
  printf '\n    \033[1m[%s]\033[0m\n' "$label"
  rsync "${RSYNC_FLAGS[@]}" "$@"
}

# backend: código + package.json. data/ e uploads/ ficam intactos no Pi.
#
# O package-lock.json fica de fora, e não é economia de banda: mandá-lo não
# pina nada e ainda cria um ping-pong. O lock do repo é lockfileVersion 3, que
# traz só o campo `packages`; o npm 6 do Pi não entende esse formato -- não há
# o `dependencies` legado para ele ler. Então ele descarta o arquivo, resolve
# pelo package.json e escreve um lock v1 no lugar. O deploy seguinte manda o v3
# de volta e a conta recomeça: uma reescrita no cartão SD a cada deploy, para
# um arquivo que aquele npm nunca conseguiu usar.
#
# Deixando o lock do Pi em paz, ele fica com o v1 que o próprio npm 6 gerou --
# o único que aquele npm de fato lê. Ou seja, o Pi passa a instalar de forma
# MAIS reproduzível do que antes, não menos.
sync_part "backend — código e package.json (data/, uploads/, node_modules/ e o lock do Pi preservados)" \
  --exclude 'node_modules/' \
  --exclude 'data/' \
  --exclude 'uploads/' \
  --exclude 'package-lock.json' \
  backend/ "$HOST:$REMOTE_PATH/backend/"

# frontend: só o bundle (viteSingleFile gera um index.html único)
sync_part "frontend — bundle do dist" \
  frontend/dist/ "$HOST:$REMOTE_PATH/frontend/dist/"

# raiz: só o package.json, que é o que o `npm start` do Pi usa
sync_part "raiz — package.json" \
  package.json "$HOST:$REMOTE_PATH/package.json"

if [ "$DRY_RUN" -eq 1 ]; then
  step "Dry run concluído — nada foi alterado no Pi"
  info "Lista de arquivos vazia acima = o Pi já está igual naquela parte,"
  info "não que ela foi pulada. O frontend aparece sempre porque o build"
  info "reescreve o index.html a cada vez."
  info ""
  info "O deploy real ainda faria, depois do envio:"
  info "  1. cd $REMOTE_PATH/backend && $REMOTE_NPM install --production"
  info "  2. sudo systemctl restart $SERVICES"
  exit 0
fi

# --------------------------------------------------------------- instalar

step "Instalando dependências do backend no Pi"
ssh "$HOST" "export PATH='$REMOTE_NODE_BIN':\$PATH; cd '$REMOTE_PATH/backend' && '$REMOTE_NPM' install --production --no-audit --no-fund"

# --------------------------------------------------------------- reiniciar

if [ "$NO_RESTART" -eq 1 ]; then
  step "Serviços não reiniciados (--no-restart)"
  info "para aplicar: ssh $HOST sudo systemctl restart $SERVICES"
  exit 0
fi

step "Reiniciando serviços"
info "pode pedir a senha do sudo no Pi"
# -t aloca TTY para o prompt de senha do sudo funcionar
ssh -t "$HOST" "sudo systemctl restart $SERVICES"

step "Status"
ssh "$HOST" "systemctl is-active $SERVICES || true"

printf '\n\033[32mDeploy concluído.\033[0m\n'
info "logs: ssh $HOST journalctl -u alexo.service -f"
