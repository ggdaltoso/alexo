import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { AppProvider } from './contexts/AppContext';
import { Galeria } from './components/Galeria';
import { MusicPlayer } from './components/MusicPlayer';

import '@react95/core/GlobalStyle';
import './win95.css';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      {/*
        Layout em duas colunas:

          Galeria       | telas (carrossel)
          MusicPlayer   | barra de progresso

        O BrowserRouter e o AppProvider passaram a envolver as DUAS colunas. Antes
        ficavam só na direita, mas o MusicPlayer vive na esquerda e precisa do
        `musicPlayback` do contexto -- e o AppProvider usa useNavigate, então tem
        de estar dentro do Router.
      */}
      <BrowserRouter>
        <AppProvider>
          <div className="flex w-full h-full gap-2">
            <div className="w-1/2 h-full shrink-0 flex flex-col gap-2 overflow-hidden">
              <Galeria />
              <MusicPlayer />
            </div>
            <div className="w-1/2 h-full shrink-0 overflow-hidden">
              <App />
            </div>
          </div>
        </AppProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
