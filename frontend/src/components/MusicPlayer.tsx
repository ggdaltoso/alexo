import { useEffect, useState } from 'react';
import { Frame } from '@react95/core/Frame';
import { Range } from '@react95/core/Range';
import { useApp } from '../contexts';
import { Marquee } from './Marquee';

/**
 * Painel do player, fixo abaixo da Gallery.
 *
 * Sem controles de propósito: quem comanda é a tag NFC. Botões aqui competiriam
 * com o gesto físico e criariam estados contraditórios -- pausar na tela com a
 * tag ainda encostada, por exemplo.
 */

// Só o suficiente para o segundo virar sem soluço. O dado em si chega por
// WebSocket em transições; isto aqui é interpolação local.
const TICK_MS = 500;

/**
 * Quanto tempo o painel continua visível depois que a música para.
 *
 * O painel não fica na tela o tempo todo: ele aparece quando há música tocando e
 * some um minuto depois de parar. Sumir na hora seria brusco -- tirar a tag para
 * trocar de álbum faria a UI piscar -- e ficar para sempre desperdiçaria um
 * quarto da tela mostrando "Nada tocando".
 */
const WINDOW_AFTER_STOP_MS = 60000;

function mmss(segundos: number) {
  const s = Math.max(0, Math.floor(segundos));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function MusicPlayer() {
  const { musicPlayback } = useApp();
  const [now, setNow] = useState(Date.now());

  const playing = musicPlayback?.isPlaying ?? false;
  const hasTrack = Boolean(musicPlayback?.title);
  const stoppedAt = musicPlayback?.stateChangedAt ?? 0;

  useEffect(() => {
    // Só conta tempo enquanto toca. Parado, a posição é a que o backend mandou.
    if (!playing) return;
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [playing]);

  useEffect(() => {
    // Um único timer marcado para o fim da janela, em vez de ficar consultando o
    // relógio: o painel só precisa re-renderizar uma vez, no instante em que
    // deixa de ser visível. Num Pi Zero, um setInterval eterno para isso seria
    // desperdício.
    if (playing || !hasTrack) return;
    const remaining = WINDOW_AFTER_STOP_MS - (Date.now() - stoppedAt);
    if (remaining <= 0) return;
    const id = setTimeout(() => setNow(Date.now()), remaining + 50);
    return () => clearTimeout(id);
  }, [playing, hasTrack, stoppedAt]);

  // Visível tocando, e por mais um minuto depois de parar.
  const visible = hasTrack && (playing || now - stoppedAt < WINDOW_AFTER_STOP_MS);

  if (!visible) return null;

  // Interpolação local: o backend manda {position, positionAt} nas transições e
  // o resto do tempo o relógio daqui completa. É o que evita um broadcast por
  // segundo para todos os clientes.
  const position =
    musicPlayback!.position +
    (playing ? (now - musicPlayback!.positionAt) / 1000 : 0);

  const duration = musicPlayback?.duration ?? null;
  // Enquanto o mpv não carregou a faixa, `duration` é nula: max=0 deixa o cursor
  // encostado na esquerda, que é honesto -- não sabemos onde estamos.
  const limit = duration ?? 0;
  const current = Math.min(position, limit);

  return (
    <Frame
      className="w-full flex flex-col shrink-0 overflow-hidden"
      p="$1"
      boxShadow="$out"
    >
      <Frame
        className="flex flex-col gap-1 overflow-hidden"
        p="$3"
        pr="$4"
        pb="$10"
        bgColor="$material"
      >
        <Frame
          bgColor="black"
          boxShadow="$in"
          className="overflow-hidden"
          px="$4"
          color="$materialTextInvert"
        >
          <Marquee
            text={
              `${musicPlayback!.album} - ${musicPlayback!.title}` +
              (musicPlayback!.trackCount > 0
                ? ` · ${musicPlayback!.trackIndex + 1}/${musicPlayback!.trackCount}`
                : '')
            }
          />
        </Frame>
        <div className="flex items-center gap-1">
          {/*
            Inerte de propósito: o painel mostra, não comanda. `disabled`
            deixaria o cursor cinza e sugeriria "quebrado", então o que desliga a
            interação é pointer-events + tabIndex -- visualmente continua um
            controle normal, só que não responde ao toque. O onChange vazio
            existe só para o React não reclamar de input controlado sem handler.
          */}
          <Range
            className="w-full pointer-events-none"
            min={0}
            max={limit}
            step="any"
            value={current}
            onChange={() => {}}
            tabIndex={-1}
            aria-hidden
          />
          <span className="text-[1em] whitespace-nowrap">
            {/* duration é nula até o mpv carregar a faixa: mostrar --:-- é mais
                honesto que 00:00, que parece uma faixa de duração zero */}
            {mmss(position)} / {duration ? mmss(duration) : '--:--'}
          </span>
        </div>
      </Frame>
    </Frame>
  );
}
