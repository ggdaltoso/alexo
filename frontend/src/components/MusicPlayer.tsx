import { useEffect, useState } from 'react';
import { Frame } from '@react95/core/Frame';
import { TitleBar } from '@react95/core/TitleBar';
import { Range } from '@react95/core/Range';
import { Mmsys120 } from '@react95/icons';
import { useApp } from '../contexts';

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

function mmss(segundos: number) {
  const s = Math.max(0, Math.floor(segundos));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function MusicPlayer() {
  const { musicPlayback } = useApp();
  const [agora, setAgora] = useState(Date.now());

  const tocando = musicPlayback?.isPlaying ?? false;

  useEffect(() => {
    // Só conta tempo enquanto toca. Parado, a posição é a que o backend mandou.
    if (!tocando) return;
    const id = setInterval(() => setAgora(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [tocando]);

  const vazio = !musicPlayback || !musicPlayback.title;

  // Interpolação local: o backend manda {position, positionAt} nas transições e
  // o resto do tempo o relógio daqui completa. É o que evita um broadcast por
  // segundo para todos os clientes.
  const posicao = vazio
    ? 0
    : musicPlayback!.position + (tocando ? (agora - musicPlayback!.positionAt) / 1000 : 0);

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
      <TitleBar title="Música" icon={<Mmsys120 variant="16x16_4" />} />

      <Frame className="flex flex-col gap-1 overflow-hidden" p="$3" pr="$4" bgColor="$material">
        {vazio ? (
          <span className="truncate opacity-60">Nada tocando</span>
        ) : (
          <>
            <span className="truncate">
              {tocando ? '▶' : '‖'} {musicPlayback!.title}
            </span>
            <span className="truncate opacity-60 text-[0.7em]">
              {musicPlayback!.album}
              {musicPlayback!.trackCount > 0 &&
                ` · ${musicPlayback!.trackIndex + 1}/${musicPlayback!.trackCount}`}
            </span>
            <div className="flex items-center gap-2">
              {/*
                Inerte de propósito: o painel mostra, não comanda. `disabled`
                deixaria o cursor cinza e sugeriria "quebrado", então o que
                desliga a interação é pointer-events + tabIndex -- visualmente
                continua um controle normal, só que não responde ao toque.
                O onChange vazio existe só para o React não reclamar de input
                controlado sem handler.
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
              <span className="text-[0.7em] whitespace-nowrap opacity-60">
                {/* duration é nula até o mpv carregar a faixa: mostrar --:-- é
                    mais honesto que 00:00, que parece uma faixa de duração zero */}
                {mmss(posicao)} / {duracao ? mmss(duracao) : '--:--'}
              </span>
            </div>
          </>
        )}
      </Frame>
    </Frame>
  );
}
