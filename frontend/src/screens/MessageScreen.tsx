import { Frame } from '@react95/core';
import { useApp } from '../contexts';

export default function MessageScreen() {
  const { currentMessage } = useApp();

  if (!currentMessage) {
    return;
  }

  const messageDate = new Date(currentMessage.timestamp);
  const formattedTime = messageDate.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Frame
      boxShadow="$out"
      bgColor="$material"
      className="p-1 flex flex-col  gap-1 h-full"
    >
      <Frame boxShadow="$in" bgColor="$material" className="p-2 h-full text-xl">
        {currentMessage.message}
      </Frame>

      <div className="flex gap-1">
        <Frame boxShadow="$in" bgColor="$material" className="flex p-1  grow">
          {currentMessage.type}
        </Frame>
        <Frame
          boxShadow="$in"
          bgColor="$material"
          className="flex items-center justify-center p-1"
        >
          {formattedTime}
        </Frame>
      </div>
    </Frame>
  );
}
