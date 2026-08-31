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
const GRADE = 32;

// 16.0 é a fronteira entre os pixels 15 e 16, ou seja, o centro real da
// grade. Medir a partir daqui, amostrando o CENTRO de cada pixel (x + 0.5),
// é o que mantém o desenho simétrico nos dois eixos.
const CENTRO = GRADE / 2;

const RAIO_FACE = 12.0;
const RAIO_BORDA = 13.5;

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
    desenhaPonteiro(ctx, ((horas + minutos / 60) * 2 * Math.PI) / 12, 6);
    desenhaPonteiro(ctx, (minutos * 2 * Math.PI) / 60, 10);

    // O miolo por cima, para cobrir a junção dos dois ponteiros.
    ctx.fillStyle = PRETO;
    ctx.fillRect(15, 15, 2, 2);
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
 * Face e borda saem de uma classificação única por distância, em vez de
 * pintar a face e depois traçar a borda por amostragem angular.
 *
 * A versão anterior fazia `for (angle = 0; angle < 360; angle += 5)` num raio
 * 13: são 72 amostras para uma circunferência de ~82 px, então a borda saía
 * furada -- na linha y=10 não havia contorno nenhum. E a face parava em
 * `distance < 12.5` enquanto a borda ficava em 13, deixando 17 pixels no meio
 * que não eram nem brancos nem pretos: era por ali que o fundo da página
 * aparecia.
 *
 * Classificando cada pixel uma vez só, os dois defeitos somem por construção:
 * não existe pixel entre a face e a borda, e a borda não tem como ter furos.
 */
function desenhaFace(ctx: CanvasRenderingContext2D) {
  ctx.clearRect(0, 0, GRADE, GRADE);

  for (let y = 0; y < GRADE; y++) {
    for (let x = 0; x < GRADE; x++) {
      const dx = x + 0.5 - CENTRO;
      const dy = y + 0.5 - CENTRO;
      const distancia = Math.sqrt(dx * dx + dy * dy);

      if (distancia < RAIO_FACE) {
        ctx.fillStyle = BRANCO;
      } else if (distancia < RAIO_BORDA) {
        ctx.fillStyle = PRETO;
      } else {
        continue; // fora do relógio: fica transparente
      }

      ctx.fillRect(x, y, 1, 1);
    }
  }
}

/*
 * Caminha do centro para fora pintando o pixel que contém cada ponto. Meio
 * pixel por passo garante que não fique buraco na diagonal, e repintar o
 * mesmo pixel não custa nada nessa escala.
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
    const x = Math.floor(CENTRO + cos * r);
    const y = Math.floor(CENTRO + sen * r);
    ctx.fillRect(x, y, 1, 1);
  }
}
