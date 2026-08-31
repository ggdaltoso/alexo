import { useEffect, useState } from 'react';
import { Frame } from '@react95/core/Frame';
import { Range } from '@react95/core/Range';
import { useApp } from '../contexts';
import { Letreiro } from './Letreiro';

/**
 * Painel do player, fixo abaixo da Galeria.
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
const JANELA_APOS_PARAR_MS = 60000;

function mmss(segundos: number) {
  const s = Math.max(0, Math.floor(segundos));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function MusicPlayer() {
  const { musicPlayback } = useApp();
  const [agora, setAgora] = useState(Date.now());

  const tocando = musicPlayback?.isPlaying ?? false;
  const temFaixa = Boolean(musicPlayback?.title);
  const paradoEm = musicPlayback?.stateChangedAt ?? 0;

  useEffect(() => {
    // Só conta tempo enquanto toca. Parado, a posição é a que o backend mandou.
    if (!tocando) return;
    const id = setInterval(() => setAgora(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [tocando]);

  useEffect(() => {
    // Um único timer marcado para o fim da janela, em vez de ficar consultando o
    // relógio: o painel só precisa re-renderizar uma vez, no instante em que
    // deixa de ser visível. Num Pi Zero, um setInterval eterno para isso seria
    // desperdício.
    if (tocando || !temFaixa) return;
    const restante = JANELA_APOS_PARAR_MS - (Date.now() - paradoEm);
    if (restante <= 0) return;
    const id = setTimeout(() => setAgora(Date.now()), restante + 50);
    return () => clearTimeout(id);
  }, [tocando, temFaixa, paradoEm]);

  // Visível tocando, e por mais um minuto depois de parar.
  const visivel = temFaixa && (tocando || agora - paradoEm < JANELA_APOS_PARAR_MS);

  if (!visivel) return null;

  // Interpolação local: o backend manda {position, positionAt} nas transições e
  // o resto do tempo o relógio daqui completa. É o que evita um broadcast por
  // segundo para todos os clientes.
  const posicao =
    musicPlayback!.position +
    (tocando ? (agora - musicPlayback!.positionAt) / 1000 : 0);

  const duracao = musicPlayback?.duration ?? null;
  // Enquanto o mpv não carregou a faixa, `duration` é nula: max=0 deixa o cursor
  // encostado na esquerda, que é honesto -- não sabemos onde estamos.
  const limite = duracao ?? 0;
  const atual = Math.min(posicao, limite);

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
          <Letreiro
            texto={
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
            max={limite}
            step="any"
            value={atual}
            onChange={() => {}}
            tabIndex={-1}
            aria-hidden
          />
          <span className="text-[1em] whitespace-nowrap">
            {/* duration é nula até o mpv carregar a faixa: mostrar --:-- é mais
                honesto que 00:00, que parece uma faixa de duração zero */}
            {mmss(posicao)} / {duracao ? mmss(duracao) : '--:--'}
          </span>
        </div>
      </Frame>
    </Frame>
  );
}
