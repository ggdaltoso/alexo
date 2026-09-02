import { useCallback, useRef, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ForecastDashboard } from './screens/ForecastDashboard';
import CalendarScreen from './screens/CalendarScreen';
import MessageScreen from './screens/MessageScreen';
import { Clock } from './screens/Clock';
import { ExchangeRateScreen } from './screens/ExchangeRateScreen';
import { TodoScreen } from './screens/TodoScreen';
import { useApp } from './contexts';
import { Loader } from 'lucide-react';
import { Frame, ProgressBar } from '@react95/core';

export default function App() {
  const { weatherLoading: loading, timerProgress } = useApp();

  /*
   * O ProgressBar do React95 exige largura em PIXELS, não em porcentagem.
   *
   * Ele desenha o rótulo duas vezes -- uma no fundo e outra dentro da parte
   * preenchida, recortada -- para o texto inverter de cor conforme a barra
   * avança. As duas cópias só ficam alinhadas se a de dentro tiver a largura
   * total da barra; com `width="100%"` os 100% passam a valer sobre o recorte, e
   * o percentual aparece duas vezes, torto.
   *
   * Medir o container é o que substitui o antigo `window.innerWidth / 2`, que
   * dava px mas ignorava o padding do body e o gap entre as colunas -- a barra
   * ficava mais larga que a coluna. Além disso era lido uma vez só, no primeiro
   * render, então não acompanhava redimensionamento.
   */
  const [barWidth, setBarWidth] = useState(0);
  const observer = useRef<ResizeObserver | null>(null);

  /*
   * Callback ref, e não useRef + useEffect([]).
   *
   * O `if (loading)` abaixo devolve outra árvore: no primeiro render a barra não
   * existe. Um efeito com deps vazias rodaria nesse momento, encontraria a ref
   * nula, sairia -- e nunca mais rodaria, deixando a largura em 0 para sempre.
   * O callback ref dispara quando o nó realmente entra no DOM.
   */
  const measureArea = useCallback((el: HTMLDivElement | null) => {
    observer.current?.disconnect();
    if (!el) return;
    observer.current = new ResizeObserver(([entrada]) =>
      setBarWidth(Math.round(entrada.contentRect.width))
    );
    observer.current.observe(el);
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader className="w-8 h-8 animate-spin text-gray-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-2">
      <div className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/" element={<Clock />} />
          <Route path="/forecast" element={<ForecastDashboard />} />
          <Route path="/calendar" element={<CalendarScreen />} />
          <Route path="/message" element={<MessageScreen />} />
          <Route path="/exchange" element={<ExchangeRateScreen />} />
          <Route path="/todo" element={<TodoScreen />} />
        </Routes>
      </div>
      <div ref={measureArea} className="w-full">
        <Frame width="100%">
          <ProgressBar
            width={`${barWidth}px`}
            percent={Math.min(100, Math.max(0, timerProgress))}
          />
        </Frame>
      </div>
    </div>
  );
}
