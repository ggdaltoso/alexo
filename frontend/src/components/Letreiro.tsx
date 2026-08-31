import { useCallback, useLayoutEffect, useRef, useState } from 'react';

/**
 * Texto que fica parado, rola até revelar o fim, e volta ao início.
 *
 * Ciclo: 3s parado no começo -> rola -> pausa no fim -> volta -> repete.
 *
 * Por que tem JavaScript aqui, se a versão anterior era só CSS: esta precisa
 * parar exatamente quando o fim do texto encosta na borda direita, e essa
 * distância é `largura do texto - largura da caixa`. Em CSS, translateX(%) é
 * relativo ao próprio elemento e margin(%) ao pai -- não há como combinar as
 * duas bases num calc(). Daria com container queries (cqw), mas isso é Chrome
 * 105+ e o Pi roda o 88.
 *
 * O que é medido aqui é só a distância; a animação em si continua no CSS.
 */

// Só anima se sobrar mais que isto, em pixels. Rolar dois pixels chama atenção
// para nada e fica pior que o texto cortado.
const MINIMO_PARA_ROLAR = 4;

interface Props {
  texto: string;
  className?: string;
}

export function Letreiro({ texto, className = '' }: Props) {
  const caixa = useRef<HTMLDivElement | null>(null);
  const [distancia, setDistancia] = useState(0);

  const medir = useCallback((el: HTMLDivElement | null) => {
    caixa.current = el;
    if (!el) return;
    // Callback ref + ResizeObserver: o painel entra e sai da tela conforme a
    // música, então o nó não existe no primeiro render e um useEffect([])
    // mediria nulo -- e, com deps vazias, nunca mais rodaria.
    const obs = new ResizeObserver(() => {
      const sobra = el.scrollWidth - el.clientWidth;
      setDistancia(sobra > MINIMO_PARA_ROLAR ? sobra : 0);
    });
    obs.observe(el);
  }, []);

  useLayoutEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const sobra = el.scrollWidth - el.clientWidth;
    setDistancia(sobra > MINIMO_PARA_ROLAR ? sobra : 0);
  }, [texto]);

  return (
    <div ref={medir} className={`overflow-hidden whitespace-nowrap ${className}`}>
      <span
        className={distancia ? 'alexo-letreiro' : undefined}
        style={distancia ? ({ '--rolagem': `-${distancia}px` } as React.CSSProperties) : undefined}
      >
        {texto}
      </span>
    </div>
  );
}
