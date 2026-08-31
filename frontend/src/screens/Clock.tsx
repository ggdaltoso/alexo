import PixelatedClock from '../components/PixelatedClock';
import { useTimeZone } from '../hooks/useTimeZone';

const SAO_PAULO_TZ = { label: 'São Paulo', timeZone: 'America/Sao_Paulo' };

export const Clock = () => {
  const time = useTimeZone(SAO_PAULO_TZ.timeZone);

  return (
    <div className="flex flex-col items-center justify-center my-auto h-full gap-2">
      <PixelatedClock size={128} date={time} />
      <div className="block text-4xl font-bold">
        {time.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })}
      </div>
    </div>
  );
};

Clock.displayName = 'Clock';
