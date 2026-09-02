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
const MIN_TO_SCROLL = 4;

interface Props {
  text: string;
  className?: string;
}

export function Marquee({ text, className = '' }: Props) {
  const box = useRef<HTMLDivElement | null>(null);
  const [distance, setDistance] = useState(0);

  const measure = useCallback((el: HTMLDivElement | null) => {
    box.current = el;
    if (!el) return;
    // Callback ref + ResizeObserver: o painel entra e sai da tela conforme a
    // música, então o nó não existe no primeiro render e um useEffect([])
    // mediria nulo -- e, com deps vazias, nunca mais rodaria.
    const observer = new ResizeObserver(() => {
      const overflow = el.scrollWidth - el.clientWidth;
      setDistance(overflow > MIN_TO_SCROLL ? overflow : 0);
    });
    observer.observe(el);
  }, []);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const overflow = el.scrollWidth - el.clientWidth;
    setDistance(overflow > MIN_TO_SCROLL ? overflow : 0);
  }, [text]);

  return (
    <div ref={measure} className={`overflow-hidden whitespace-nowrap ${className}`}>
      <span
        className={distance ? 'alexo-letreiro' : undefined}
        style={distance ? ({ '--rolagem': `-${distance}px` } as React.CSSProperties) : undefined}
      >
        {text}
      </span>
    </div>
  );
}
