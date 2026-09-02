import { useEffect, useRef } from 'react';

interface PixelatedClockProps {
  date: Date;
  size?: number;
}

/*
 * O canvas tem 32x32 de verdade e é esticado por CSS até `size`.
 *
 * Antes ele era criado já no tamanho final e cada "pixel" virava um fillRect
 * de size/32 -- com size=120 isso dá 3,75, então os retângulos caíam em
 * coordenadas fracionárias e o navegador antialiasava as bordas. O
 * `image-rendering: pixelated` no style não ajudava, porque não havia nada
 * para ampliar: a imagem já estava na resolução final, só que borrada.
 *
 * Desenhando em 32x32 e deixando o CSS ampliar, cada célula é um pixel
 * inteiro e o `pixelated` faz o vizinho-mais-próximo, que é o visual
 * pretendido.
 */
const GRID = 64;

// CENTER é a fronteira entre as duas células do meio, ou seja, o centro real
// da grade. Medir a partir daqui, amostrando o CENTER de cada célula
// (x + 0.5), é o que mantém o desenho simétrico nos dois eixos.
const CENTER = GRID / 2;

/*
 * As proporções vêm do desenho original de 32x32, então dobrar a grade só
 * aumenta a resolução -- não muda o formato.
 *
 * Em 32x32 a silhueta se afastava de um círculo perfeito em até 3,1 px na
 * tela; em 64x64 são 1,2 px. É esse o ganho: o mesmo relógio, menos serrilhado.
 */
const RADIUS = GRID * 0.421875; // 13,5 em 32
const HOUR_HAND = GRID * 0.1875; // 6 em 32
const MINUTE_HAND = GRID * 0.3125; // 10 em 32
const HUB = GRID / 16; // 2 em 32

/*
 * Espessura da borda em células.
 *
 * Dobrar a grade sem mexer aqui afinaria o contorno pela metade: a célula cai
 * de 4 px para 2 px na tela. Duas camadas devolvem os mesmos 4 px de antes.
 */
const BORDER_LAYERS = 2;

// Mesma razão: em 32x32 o ponteiro tinha 1 célula, que valia 4 px na tela.
const HAND_THICKNESS = 2;

const WHITE = '#ffffff';
const BLACK = '#000000';

export default function PixelatedClock({
  date,
  size = 200,
}: PixelatedClockProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    drawFace(ctx);

    const hours = date.getHours() % 12;
    const minutes = date.getMinutes();

    // Ponteiro das horas: mais curto e avança com os minutos.
    drawHand(ctx, ((hours + minutes / 60) * 2 * Math.PI) / 12, HOUR_HAND);
    drawHand(ctx, (minutes * 2 * Math.PI) / 60, MINUTE_HAND);

    // O miolo por cima, para cobrir a junção dos dois ponteiros.
    ctx.fillStyle = BLACK;
    ctx.fillRect(CENTER - HUB / 2, CENTER - HUB / 2, HUB, HUB);
  }, [date]);

  return (
    <canvas
      ref={canvasRef}
      width={GRID}
      height={GRID}
      style={{
        imageRendering: 'pixelated',
        width: size,
        height: size,
      }}
      aria-label={`Relógio marcando ${date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })}`}
    />
  );
}

/*
 * O mostrador, pré-calculado uma vez.
 *
 * Ele não depende da hora -- só os ponteiros mudam --, então recalcular a cada
 * segundo seria desperdício num Zero W. Como só depende das constantes acima,
 * sai no carregamento do módulo.
 *
 * A borda é a casca do disco, e não um anel entre dois raios.
 *
 * A versão original traçava a borda por amostragem angular -- `for (angle = 0;
 * angle < 360; angle += 5)` -- com amostras de menos para a circunferência,
 * então ela saía furada. E a face parava num raio menor que o da borda,
 * deixando células que não eram nem brancas nem pretas: era por ali que o
 * fundo da página aparecia.
 *
 * Um anel definido por dois raios conserta o vazamento mas engorda nas
 * diagonais: as duas circunferências rasterizam de forma diferente conforme o
 * ângulo, e a espessura ia a 3 células nos 45° contra 1 nos eixos. Eram os
 * blocos pretos grossos nos cantos.
 *
 * Tirando a borda da silhueta, cada casca tem 1 célula por construção em
 * qualquer ângulo. Empilhar BORDER_LAYERS cascas sucessivas engrossa o
 * contorno sem reintroduzir a variação. E como cada casca é a fronteira de uma
 * região 4-conexa, o contorno é fechado: não há por onde o fundo alcançar a
 * face.
 */
const FACE = (() => {
  const inside = (grade: boolean[][], x: number, y: number) =>
    x >= 0 && x < GRID && y >= 0 && y < GRID && grade[y][x];

  const disc: boolean[][] = [];
  for (let y = 0; y < GRID; y++) {
    disc[y] = [];
    for (let x = 0; x < GRID; x++) {
      const dx = x + 0.5 - CENTER;
      const dy = y + 0.5 - CENTER;
      disc[y][x] = Math.sqrt(dx * dx + dy * dy) < RADIUS;
    }
  }

  const border: boolean[][] = disc.map((row) => row.map(() => false));
  const remaining: boolean[][] = disc.map((row) => row.slice());

  for (let layer = 0; layer < BORDER_LAYERS; layer++) {
    const shell: boolean[][] = [];
    for (let y = 0; y < GRID; y++) {
      shell[y] = [];
      for (let x = 0; x < GRID; x++) {
        shell[y][x] =
          remaining[y][x] &&
          (!inside(remaining, x - 1, y) ||
            !inside(remaining, x + 1, y) ||
            !inside(remaining, x, y - 1) ||
            !inside(remaining, x, y + 1));
      }
    }
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        if (shell[y][x]) {
          border[y][x] = true;
          remaining[y][x] = false;
        }
      }
    }
  }

  return { disc, border };
})();

function drawFace(ctx: CanvasRenderingContext2D) {
  ctx.clearRect(0, 0, GRID, GRID);

  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (FACE.border[y][x]) ctx.fillStyle = BLACK;
      else if (FACE.disc[y][x]) ctx.fillStyle = WHITE;
      else continue; // fora do relógio: fica transparente

      ctx.fillRect(x, y, 1, 1);
    }
  }
}

/*
 * Caminha do centro para fora carimbando um quadrado em cada ponto. Meia
 * célula por passo garante que não fique buraco na diagonal, e recarimbar a
 * mesma célula não custa nada nessa escala.
 *
 * O carimbo é de HAND_THICKNESS células pelo mesmo motivo da borda: com a
 * grade em 64 a célula vale 2 px na tela, e um ponteiro de 1 célula ficaria com
 * metade da espessura de antes.
 *
 * O `round` menos meia espessura centra o carimbo na fronteira entre células,
 * que é onde CENTER fica -- é o que mantém os dois ponteiros alinhados entre si
 * e com o miolo.
 *
 * `angulo` vem com 0 = meio-dia; o -90° põe o zero para cima.
 */
function drawHand(
  ctx: CanvasRenderingContext2D,
  angle: number,
  length: number,
) {
  ctx.fillStyle = BLACK;

  const a = angle - Math.PI / 2;
  const cos = Math.cos(a);
  const sin = Math.sin(a);

  for (let r = 0; r <= length; r += 0.5) {
    const x = Math.round(CENTER + cos * r) - HAND_THICKNESS / 2;
    const y = Math.round(CENTER + sin * r) - HAND_THICKNESS / 2;
    ctx.fillRect(x, y, HAND_THICKNESS, HAND_THICKNESS);
  }
}
