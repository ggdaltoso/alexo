# Units systemd do Alexo

Versionados aqui porque, até 24/08/2026, eles existiam **só no Pi** — e já
divergiram uma vez em silêncio: o README do projeto documentava um
`Restart=always` que os arquivos reais não tinham, e isso só apareceu quando o
backend caiu de verdade e não voltou.

Instalar (a partir da raiz do repo):

```bash
scp deploy/systemd/*.service pi@192.168.0.96:/tmp/
ssh pi@192.168.0.96 'sudo cp /tmp/alexo*.service /etc/systemd/system/ \
  && sudo systemctl daemon-reload \
  && sudo systemctl enable --now alexo-mpv.service'
```

| Unit | Papel |
|---|---|
| `alexo-mpv.service` | mpv ocioso, dono do socket IPC |
| `alexo.service` | backend Node |
| `alexo-display.service` | Chromium em modo kiosk |

Ordem: o `alexo.service` declara `After=alexo-mpv.service`, mas isso só garante
ordem de *partida*, não que o socket já exista. Quem lida com essa janela é o
`musicPlayer.init()`, que espera o socket aparecer quando `MPV_EXTERNAL=1`.
