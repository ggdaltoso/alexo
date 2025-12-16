import { Frame, TitleBar } from '@react95/core';
import { useApp } from '../contexts';
import { Bulb, Wmsui322223, Message } from '@react95/icons';
import { MessageType } from 'src/types';

const MESSAGE_ICONS = {
  info: <Wmsui322223 variant="16x16_4" />,
  warning: <Bulb variant="32x32_4" />,
};

const MessageTypeIcon: React.FC<{ type: MessageType }> = ({ type }) => {
  const icon = MESSAGE_ICONS[type] || '💬';
  return <span>{icon}</span>;
};

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
      p="$2"
      gap="$2"
      display="flex"
      flexDirection="column"
      h="100%"
    >
      <TitleBar icon={<Message variant="16x16_4" />} title="Message" />
      <Frame
        boxShadow="$in"
        bgColor="$material"
        p="$8"
        h="100%"
        className="text-xl"
      >
        {currentMessage.message}
      </Frame>

      <Frame display="flex" gap="$2">
        <Frame
          boxShadow="$in"
          bgColor="$material"
          p="$4"
          className="flex  grow"
        >
          <MessageTypeIcon type={currentMessage.type} />
        </Frame>
        <Frame
          boxShadow="$in"
          bgColor="$material"
          p="$4"
          className="flex items-center justify-center leading-none"
        >
          {formattedTime}
        </Frame>
      </Frame>
    </Frame>
  );
}
