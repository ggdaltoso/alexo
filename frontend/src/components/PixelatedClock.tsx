import React from 'react';

function getTime24h() {
  const now = new Date();
  return now.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export default function PixelatedClock() {
  const [time, setTime] = React.useState(getTime24h());
  React.useEffect(() => {
    const interval = setInterval(() => setTime(getTime24h()), 60000);
    return () => clearInterval(interval);
  }, []);
  return (
    <div
      style={{
        width: 480,
        height: 320,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 96,
        fontFamily: 'monospace',
      }}
    >
      {time}
    </div>
  );
}
