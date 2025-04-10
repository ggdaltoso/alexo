import { useEffect, useRef, useState } from 'react';

interface PixelatedClockProps {
  date?: Date;
  size?: number;
  secondHandColor?: string;
}

export default function PixelatedClock({
  date,
  size = 200,
  secondHandColor = '#ff0000',
}: PixelatedClockProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [time, setTime] = useState(date || new Date());

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setTime((prevTime) => {
        const newTime = new Date(prevTime.getTime());
        newTime.setSeconds(newTime.getSeconds() + 1);
        return newTime;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Sync with the `date` prop if it changes
  useEffect(() => {
    if (date) {
      setTime(date);
    }
  }, [date]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions
    canvas.width = size;
    canvas.height = size;

    // Calculate pixel size (we'll use a 32x32 grid)
    const pixelSize = size / 32;

    // Draw clock face
    drawClockFace(ctx, pixelSize);

    // Get hours, minutes, and seconds from the time
    const hours = time.getHours() % 12;
    const minutes = time.getMinutes();
    const seconds = time.getSeconds();

    // Draw hour hand
    drawHourHand(ctx, hours, minutes, pixelSize);

    // Draw minute hand
    drawMinuteHand(ctx, minutes, pixelSize);

    // Draw second hand
    drawSecondHand(ctx, seconds, pixelSize, secondHandColor);
  }, [time, size, secondHandColor]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className="pixelated"
      style={{
        imageRendering: 'pixelated',
        width: size,
        height: size,
      }}
      aria-label={`Pixelated clock showing ${time.toLocaleTimeString()}`}
    />
  );
}

function drawClockFace(ctx: CanvasRenderingContext2D, pixelSize: number) {
  // Clear the canvas first (transparent background)
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  // Draw a filled white circle for the clock face
  ctx.fillStyle = '#ffffff';

  // Fill the inner area of the clock with white
  for (let y = 4; y < 28; y++) {
    for (let x = 4; x < 28; x++) {
      // Calculate distance from center (16,16)
      const distX = x - 16;
      const distY = y - 16;
      const distance = Math.sqrt(distX * distX + distY * distY);

      // Fill if inside the circle (radius ~12)
      if (distance < 12.5) {
        ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
      }
    }
  }

  // Draw black border (continuous circle)
  ctx.fillStyle = '#000000';

  // Draw the circle border using a more continuous approach
  for (let angle = 0; angle < 360; angle += 5) {
    const radian = (angle * Math.PI) / 180;

    // Outer edge of the circle (radius 13)
    const outerX = Math.round(16 + 13 * Math.cos(radian));
    const outerY = Math.round(16 + 13 * Math.sin(radian));

    // Draw the outer pixel
    ctx.fillRect(outerX * pixelSize, outerY * pixelSize, pixelSize, pixelSize);
  }

  // Draw center dot
  ctx.fillRect(15 * pixelSize, 15 * pixelSize, 2 * pixelSize, 2 * pixelSize);
}

function drawHourHand(
  ctx: CanvasRenderingContext2D,
  hours: number,
  minutes: number,
  pixelSize: number,
) {
  ctx.fillStyle = '#000000';

  // Calculate hour hand angle (including minutes contribution)
  const hourAngle = ((hours + minutes / 60) * (Math.PI * 2)) / 12 - Math.PI / 2;

  // Hour hand is shorter
  const hourHandLength = 6;

  // Calculate hour hand endpoint
  const hourX = Math.round(16 + Math.cos(hourAngle) * hourHandLength);
  const hourY = Math.round(16 + Math.sin(hourAngle) * hourHandLength);

  // Draw hour hand
  drawLine(ctx, 16, 16, hourX, hourY, pixelSize);
}

function drawMinuteHand(
  ctx: CanvasRenderingContext2D,
  minutes: number,
  pixelSize: number,
) {
  ctx.fillStyle = '#000000';

  // Calculate minute hand angle
  const minuteAngle = (minutes * (Math.PI * 2)) / 60 - Math.PI / 2;

  // Minute hand is longer
  const minuteHandLength = 10;

  // Calculate minute hand endpoint
  const minuteX = Math.round(16 + Math.cos(minuteAngle) * minuteHandLength);
  const minuteY = Math.round(16 + Math.sin(minuteAngle) * minuteHandLength);

  // Draw minute hand
  drawLine(ctx, 16, 16, minuteX, minuteY, pixelSize);
}

function drawSecondHand(
  ctx: CanvasRenderingContext2D,
  seconds: number,
  pixelSize: number,
  color: string,
) {
  ctx.fillStyle = color;

  // Calculate second hand angle
  const secondAngle = (seconds * (Math.PI * 2)) / 60 - Math.PI / 2;

  // Second hand is the longest
  const secondHandLength = 12;

  // Calculate second hand endpoint
  const secondX = Math.round(16 + Math.cos(secondAngle) * secondHandLength);
  const secondY = Math.round(16 + Math.sin(secondAngle) * secondHandLength);

  // Draw second hand
  drawLine(ctx, 16, 16, secondX, secondY, pixelSize);
}

function drawLine(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  pixelSize: number,
) {
  // Bresenham's line algorithm for pixelated line
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    ctx.fillRect(x0 * pixelSize, y0 * pixelSize, pixelSize, pixelSize);

    if (x0 === x1 && y0 === y1) break;

    const e2 = 2 * err;
    if (e2 > -dy) {
      if (x0 === x1) break;
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      if (y0 === y1) break;
      err += dx;
      y0 += sy;
    }
  }
}
