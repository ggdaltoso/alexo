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
const GRADE = 64;

// CENTRO é a fronteira entre as duas células do meio, ou seja, o centro real
// da grade. Medir a partir daqui, amostrando o CENTRO de cada célula
// (x + 0.5), é o que mantém o desenho simétrico nos dois eixos.
const CENTRO = GRADE / 2;

/*
 * As proporções vêm do desenho original de 32x32, então dobrar a grade só
 * aumenta a resolução -- não muda o formato.
 *
 * Em 32x32 a silhueta se afastava de um círculo perfeito em até 3,1 px na
 * tela; em 64x64 são 1,2 px. É esse o ganho: o mesmo relógio, menos serrilhado.
 */
const RAIO = GRADE * 0.421875; // 13,5 em 32
const PONTEIRO_HORAS = GRADE * 0.1875; // 6 em 32
const PONTEIRO_MINUTOS = GRADE * 0.3125; // 10 em 32
const MIOLO = GRADE / 16; // 2 em 32

/*
 * Espessura da borda em células.
 *
 * Dobrar a grade sem mexer aqui afinaria o contorno pela metade: a célula cai
 * de 4 px para 2 px na tela. Duas camadas devolvem os mesmos 4 px de antes.
 */
const CAMADAS_BORDA = 2;

// Mesma razão: em 32x32 o ponteiro tinha 1 célula, que valia 4 px na tela.
const ESPESSURA_PONTEIRO = 2;

const BRANCO = '#ffffff';
const PRETO = '#000000';

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

    desenhaFace(ctx);

    const horas = date.getHours() % 12;
    const minutos = date.getMinutes();

    // Ponteiro das horas: mais curto e avança com os minutos.
    desenhaPonteiro(ctx, ((horas + minutos / 60) * 2 * Math.PI) / 12, PONTEIRO_HORAS);
    desenhaPonteiro(ctx, (minutos * 2 * Math.PI) / 60, PONTEIRO_MINUTOS);

    // O miolo por cima, para cobrir a junção dos dois ponteiros.
    ctx.fillStyle = PRETO;
    ctx.fillRect(CENTRO - MIOLO / 2, CENTRO - MIOLO / 2, MIOLO, MIOLO);
  }, [date]);

  return (
    <canvas
      ref={canvasRef}
      width={GRADE}
      height={GRADE}
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
 * qualquer ângulo. Empilhar CAMADAS_BORDA cascas sucessivas engrossa o
 * contorno sem reintroduzir a variação. E como cada casca é a fronteira de uma
 * região 4-conexa, o contorno é fechado: não há por onde o fundo alcançar a
 * face.
 */
const MOSTRADOR = (() => {
  const dentro = (grade: boolean[][], x: number, y: number) =>
    x >= 0 && x < GRADE && y >= 0 && y < GRADE && grade[y][x];

  const disco: boolean[][] = [];
  for (let y = 0; y < GRADE; y++) {
    disco[y] = [];
    for (let x = 0; x < GRADE; x++) {
      const dx = x + 0.5 - CENTRO;
      const dy = y + 0.5 - CENTRO;
      disco[y][x] = Math.sqrt(dx * dx + dy * dy) < RAIO;
    }
  }

  const borda: boolean[][] = disco.map((linha) => linha.map(() => false));
  const restante: boolean[][] = disco.map((linha) => linha.slice());

  for (let camada = 0; camada < CAMADAS_BORDA; camada++) {
    const casca: boolean[][] = [];
    for (let y = 0; y < GRADE; y++) {
      casca[y] = [];
      for (let x = 0; x < GRADE; x++) {
        casca[y][x] =
          restante[y][x] &&
          (!dentro(restante, x - 1, y) ||
            !dentro(restante, x + 1, y) ||
            !dentro(restante, x, y - 1) ||
            !dentro(restante, x, y + 1));
      }
    }
    for (let y = 0; y < GRADE; y++) {
      for (let x = 0; x < GRADE; x++) {
        if (casca[y][x]) {
          borda[y][x] = true;
          restante[y][x] = false;
        }
      }
    }
  }

  return { disco, borda };
})();

function desenhaFace(ctx: CanvasRenderingContext2D) {
  ctx.clearRect(0, 0, GRADE, GRADE);

  for (let y = 0; y < GRADE; y++) {
    for (let x = 0; x < GRADE; x++) {
      if (MOSTRADOR.borda[y][x]) ctx.fillStyle = PRETO;
      else if (MOSTRADOR.disco[y][x]) ctx.fillStyle = BRANCO;
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
 * O carimbo é de ESPESSURA_PONTEIRO células pelo mesmo motivo da borda: com a
 * grade em 64 a célula vale 2 px na tela, e um ponteiro de 1 célula ficaria com
 * metade da espessura de antes.
 *
 * O `round` menos meia espessura centra o carimbo na fronteira entre células,
 * que é onde CENTRO fica -- é o que mantém os dois ponteiros alinhados entre si
 * e com o miolo.
 *
 * `angulo` vem com 0 = meio-dia; o -90° põe o zero para cima.
 */
function desenhaPonteiro(
  ctx: CanvasRenderingContext2D,
  angulo: number,
  comprimento: number,
) {
  ctx.fillStyle = PRETO;

  const a = angulo - Math.PI / 2;
  const cos = Math.cos(a);
  const sen = Math.sin(a);

  for (let r = 0; r <= comprimento; r += 0.5) {
    const x = Math.round(CENTRO + cos * r) - ESPESSURA_PONTEIRO / 2;
    const y = Math.round(CENTRO + sen * r) - ESPESSURA_PONTEIRO / 2;
    ctx.fillRect(x, y, ESPESSURA_PONTEIRO, ESPESSURA_PONTEIRO);
  }
}
