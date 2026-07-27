# Player de música ativado por tag NFC

## Contexto

O Alexo hoje já tem um pipeline NFC "acidental": um dispositivo externo (celular/app) faz `POST /api/nfc` com `{type, message}` e o backend retransmite via WebSocket para mostrar uma mensagem na tela por 10s. Essa feature é totalmente separada da nova: agora queremos um **leitor NFC físico ligado direto no Pi Zero W**, controlado pelo Node, que ao detectar uma tag toca uma música mapeada àquela tag (e pausa quando a tag é removida) — um efeito "caixinha tipo Tonie/Yoto". O hardware já foi decidido em conversa anterior:

- **Áudio**: MAX98357A (DAC I2S + ampli Classe D) + speaker passivo 4Ω/3W.
- **Leitura NFC**: módulo PN532 via **UART/serial** (biblioteca npm `pn532`, pacote `techniq/node-pn532`), usando `scanTag()` em polling — suporta **NTAG (203/213/215/216) e Mifare Ultralight**, mas explicitamente **não suporta Mifare Classic**. Essa lib tem suporte a I2C, mas está marcado como WIP há quase 10 anos sem retomada — por isso a escolha é UART, o caminho testado de verdade pela lib. Sem evento nativo de "tag removida": a detecção de presença/ausência é implementada por nós, comparando UID entre polls sucessivos.
- **Playback**: `mpv --idle` controlado via socket IPC JSON, usando o pacote `node-mpv`.
- **Gestão de conteúdo**: página admin HTML server-rendered (`/admin/music`), no mesmo molde da `/admin/gallery` que já existe.

Escopo v1: **1 tag = 1 música** (sem playlist/fila). "Pular música" não tem alvo definido nesse escopo — vira "reiniciar a faixa atual", deixado explícito na UI.

Essas duas features NFC (mensagem via HTTP externo vs. música via leitor físico) devem ficar **completamente desacopladas** no backend e no frontend — mesma tecnologia de transporte (WebSocket), fluxos de estado independentes.

## Bug pré-existente a corrigir como pré-requisito

`frontend/src/contexts/AppContext.tsx:92-94` trata **qualquer** broadcast do WebSocket como se fosse uma `NFCMessage` (`setCurrentMessage(message)` sem checar `type`), incluindo o já existente `{type:'gallery_updated'}`, que não tem `message`/`timestamp`. Isso nunca explodiu na prática porque a Galeria faz polling e não escuta o WS — mas qualquer broadcast novo (como `music_playback_state`) vai colidir com o fluxo de interrupção de `/message` se isso não for corrigido primeiro.

## Backend

### Novos módulos (mesmo estilo de `backend/ws.js`/`backend/state.js` — arquivos pequenos e focados)

- **`backend/nfcReader.js`**: só cuida do hardware. `init()` abre a porta serial (`serialport` + `pn532`) dentro de `try/catch` — se a porta não existir (ex.: rodando num Mac/dev sem o UART), loga aviso e não faz nada, sem derrubar o servidor. Faz um `setInterval` curto (~300ms) chamando `rfid.scanTag()`; compara o UID retornado com o último UID visto: UID novo → emite `'tag-present'`; UID que sumiu (poll retorna sem tag) → emite `'tag-vanish'`. Essa lógica de presença/ausência é nossa, já que a lib não expõe um evento `vanish` pronto (diferente do que a `pn532-i2c` oferecia).
- **`backend/musicPlayer.js`**: só cuida do mpv. `init()` sobe `mpv --idle --input-ipc-server=<path>` via `node-mpv`. Métodos `play(track)`, `pause()`, `resume()`, `restart()`, `setVolume(v)`, `getStatus()`. Emite `'status'` com `{trackId, title, filename, isPlaying, position, duration, volume}` a cada mudança real reportada pelo mpv (play/pause/fim de faixa/seek).
- **`backend/musicController.js`**: a cola — é o único módulo que enxerga `state`, `wsServer`, `musicPlayer` e `nfcReader` ao mesmo tempo.
  - `tag-present` → busca `state.getTagMapping(uid)`; se existir, `musicPlayer.play(track)` + `state.setPlayerState({activeTagUid: uid, trackId})`.
  - `tag-vanish` → se o UID bate com o `activeTagUid` atual, `musicPlayer.pause()` + `state.setPlayerState({activeTagUid: null})`.
  - `musicPlayer.on('status', ...)` → atualiza `state` e faz `wsServer.broadcast({type:'music_playback_state', ...})`.
  - Expõe `play/pause/restart/setVolume/getStatus` (reusados tanto pelas rotas REST de controle quanto por um endpoint de simulação para dev).

### `backend/state.js` — extensão (mesmo padrão da galeria)

- Tracks, com persistência em `backend/data/music-tracks.json` (igual `gallery.json`): `getTracks()/addTrack()/removeTrack(id)` (removendo também precisa fazer cascade nos mapeamentos de tag que apontam pra ela).
- Mapeamentos de tag, em `backend/data/nfc-tags.json`: `getTagMappings()/getTagMapping(uid)/setTagMapping({uid,trackId})/removeTagMapping(uid)`.
- Estado do player: **puramente em memória, sem persistir em disco** (mesmo tratamento que o já existente `state.message`) — `getPlayerState()/setPlayerState(partial)`, shape inicial `{trackId:null, title:null, filename:null, isPlaying:false, position:0, duration:null, volume:80, activeTagUid:null}`. Motivo: posição de playback muda o tempo todo, persistir em JSON a cada tick faria I/O de disco constante no Pi Zero — igual ao alerta que a própria galeria já ilustra (toda leitura/escrita reabre o arquivo inteiro).

### Rotas novas em `backend/server.js` (seguindo exatamente as convenções da galeria — multer, broadcast-após-mutação, ids via `crypto.randomUUID()`)

```
GET    /api/music/tracks
POST   /api/music/tracks/upload   (multer, campo 'audio', mimetype audio/mpeg, ~30MB)
DELETE /api/music/tracks/:id

GET    /api/music/tags
POST   /api/music/tags            body {uid, trackId}  (upsert)
DELETE /api/music/tags/:uid

GET    /api/music/player/status
POST   /api/music/player/play
POST   /api/music/player/pause
POST   /api/music/player/restart
POST   /api/music/player/volume   body {value}

POST   /api/nfc-tag/simulate      body {uid, event:'present'|'remove'}   -- só para dev, sem hardware
```

Uploads em `backend/uploads/music` (paralelo a `backend/uploads/gallery`).

**`GET /admin/music`**: cópia estrutural do `/admin/gallery` (mesmo HTML/CSS inline, mesma lógica de `apiBase` dev/prod) — formulário de upload de MP3 + lista de faixas com botão remover, e uma segunda seção com tabela de mapeamentos UID→faixa (input de UID + `<select>` de faixa).

### Broadcasts WebSocket novos

```
{ type: 'music_tracks_updated' }   // notificação vazia, cliente re-GET — igual gallery_updated
{ type: 'music_tags_updated' }     // idem
{
  type: 'music_playback_state',
  trackId, title, filename, isPlaying,
  position, positionAt,   // segundos + timestamp de quando foi capturado
  duration, volume, activeTagUid, timestamp,
}
```

**Decisão importante**: nada de broadcast a cada 1s. Todo uso de WS hoje no projeto é evento discreto e de baixa frequência — não existe precedente de stream contínuo, e `wsServer.broadcast` manda pra todo mundo sem filtro. Em vez disso: broadcast só em transições reais (tag presente/removida, play/pause/volume, fim de faixa), cada uma levando `{position, positionAt}`; o frontend interpola a posição localmente (`position + (Date.now()-positionAt)/1000` enquanto tocando). Um re-broadcast a cada ~10s enquanto `isPlaying` serve de rede de segurança contra drift, sem chegar perto de chatter por segundo.

## Frontend

### `frontend/src/contexts/AppContext.tsx`

1. Corrigir o callback do WS (linha ~92) pra discriminar por tipo/shape antes de tratar como `NFCMessage`, em vez do check de truthy atual.
2. Novo estado independente do fluxo de mensagem: `musicPlayback` (do broadcast `music_playback_state`) e `routeBeforeMusic` — **não reaproveitar** `routeBeforeMessage`/o timer de 10s, porque duração de música não tem relação com duração de mensagem.
3. Efeito de interrupção: quando `musicPlayback?.activeTagUid` estiver setado e a rota atual não for `/music` nem `/message` (mensagem tem prioridade se as duas colidirem), guarda a rota atual e navega pra `/music`.
4. Efeito de retorno: **orientado a evento, não a timer** — quando `activeTagUid` virar `null` (tag removida/parada), volta pra rota salva. Isso é o que resolve corretamente músicas mais longas ou mais curtas que 10s.
5. `NAVIGATION_ROUTES` continua `['/', '/forecast', '/exchange']` — `/music` fica de fora do carrossel, mesma lógica de exclusão implícita que `/message` já usa hoje.

### Novos arquivos/mudanças

- `frontend/src/types.ts`: `MusicTrack`, `NfcTagMapping`, `MusicPlaybackState`.
- `frontend/src/services/websocket.ts`: tipar o callback como união discriminada em vez de assumir sempre `NFCMessage`.
- `frontend/src/services/api.ts`: adicionar métodos de música (`getTracks`, `uploadTrack`, `deleteTrack`, `getTagMappings`, `getPlayerStatus`, `playMusic`, `pauseMusic`, `restartMusic`, `setVolume`) — usar a classe `ApiService` já existente em vez do fetch cru que a `Galeria.tsx` usa, estabelecendo o padrão pretendido pra código novo.
- `frontend/src/screens/MusicScreen.tsx` (novo): lê `musicPlayback` via `useApp()` (não precisa de hook de polling — o dado já chega via WS/contexto). Interpola a posição localmente a cada ~500ms enquanto tocando. Mostra título da faixa, `mm:ss / mm:ss`, barra de progresso (`Frame boxShadow="$in"`, no estilo das outras telas), e controles: play/pause, "reiniciar" (não "pular" — deixar claro na UI que não existe fila), volume +/-. Early-return `null` se não houver faixa ativa, igual ao padrão do `MessageScreen.tsx`.
- `frontend/src/App.tsx`: adicionar `<Route path="/music" element={<MusicScreen />} />`.

## Verificação

**Sem hardware físico (dev machine):**
1. `nfcReader.init()` deve falhar graciosamente sem a porta serial disponível — servidor sobe normalmente.
2. Instalar `mpv` localmente e validar o socket IPC manualmente antes de confiar no wrapper (`mpv --idle --input-ipc-server=/tmp/mpvsocket &`, depois `echo '{"command":["loadfile","test.mp3"]}' | socat - /tmp/mpvsocket`).
3. Via `/admin/music`, subir um MP3 de teste e mapear um UID fictício.
4. Simular o scan pelo endpoint dev-only:
   ```
   curl -X POST localhost:3001/api/nfc-tag/simulate -d '{"uid":"04A224B2","event":"present"}' -H 'Content-Type: application/json'
   ```
   Confirmar áudio tocando na máquina dev, `GET /api/music/player/status` com `isPlaying:true` e posição avançando, e o broadcast `music_playback_state` chegando (via devtools ou `wscat`).
5. Rodar `npm run dev` e confirmar no navegador: navegação automática pra `/music` ao simular presença, progresso avançando, pause funcionando de verdade, e retorno à rota anterior ao simular remoção (testar com faixa >10s pra provar que não é mais timer fixo).
6. Regressão do bug corrigido: disparar `POST /api/nfc` (mensagem) e um upload de galeria enquanto a música está parada — confirmar que `gallery_updated` não força mais navegação pra `/message`, e que mensagem "ganha" se colidir com um tag-present.

**Só no Pi real:**
- Colocar a chave do módulo PN532 no modo **HSU/UART** (não I2C).
- UART: no Pi Zero W, o Bluetooth ocupa o UART primário (PL011) por padrão, deixando só a mini-UART (`/dev/ttyS0`) exposta nos pinos GPIO — testar com `/dev/ttyS0` primeiro (é o mesmo caminho que o README da lib recomenda pro Pi 3). Se a mini-UART se mostrar instável (o clock dela varia com a frequência da CPU), o fallback é `dtoverlay=disable-bt` no `/boot/config.txt` pra liberar o UART completo (PL011) nos pinos, desativando o Bluetooth do Pi (sem perda pro projeto, já que o Zero W usa WiFi pra tudo, não Bluetooth).
- Tags físicas devem ser **NTAG (213/215/216) ou Mifare Ultralight** — os NTAG215 que o usuário já possui servem. O cartão S50 (Mifare Classic) que veio de brinde no kit do PN532 **não vai funcionar** com essa lib — guardar pra outro uso ou descartar.
- Saída ALSA do MAX98357A: após o `dtoverlay` de DAC + reboot, `aplay -l` pra achar o índice da placa e configurar em `musicPlayer.js` (`--audio-device=alsa/hw:X,0`).
- Instalar `pn532`/`serialport`/`node-mpv` primeiro isolado no Pi (`npm install` numa pasta de teste) antes de integrar tudo — `serialport` também compila addon nativo, e o Pi Zero é ARMv6/Node 14, então vale confirmar cedo que a instalação funciona sem binário pré-compilado disponível.
- Sem supervisor pro `mpv`: se o processo Express cair, o `mpv` cai junto (filho do processo) — aceitável pro v1, sem retry automático.

## Arquivos críticos

- `backend/server.js` — novas rotas + wiring de startup
- `backend/state.js` — extensão com tracks/tags/player state
- `backend/nfcReader.js`, `backend/musicPlayer.js`, `backend/musicController.js` — novos
- `frontend/src/contexts/AppContext.tsx` — fix do bug + novo fluxo de interrupção
- `frontend/src/services/websocket.ts`, `frontend/src/services/api.ts`
- `frontend/src/types.ts`
- `frontend/src/screens/MusicScreen.tsx` — novo
- `frontend/src/App.tsx` — nova rota

## Hardware (lista de compra)

- Raspberry Pi Zero W (já em posse)
- MAX98357A — DAC I2S + amplificador Classe D
- Mini speaker passivo 4Ω / 3W
- Módulo leitor PN532 V3 (I2C/SPI/HSU via chave seletora, usar em modo **HSU/UART**) — comprado: [TENSTAR ROBOT PN532 NFC RFID Wireless Module V3, AliExpress](https://pt.aliexpress.com/item/1005005973913526.html), R$18,62, já vem com 1 cartão S50 (Mifare Classic) incluso — **não compatível com a lib escolhida**, serve só de curiosidade/outro uso
- Tags: os **NTAG215** que o usuário já possui — compatíveis com a lib `pn532` (NTAG/Mifare Ultralight). Não usar Mifare Classic com essa lib.
