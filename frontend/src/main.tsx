import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { AppProvider } from './contexts/AppContext';
import { Gallery } from './components/Gallery';
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

          Gallery       | telas (carrossel)
          MusicPlayer   | barra de progresso

        O BrowserRouter e o AppProvider passaram a envolver as DUAS colunas. Antes
        ficavam só na direita, mas o MusicPlayer vive na esquerda e precisa do
        `musicPlayback` do contexto -- e o AppProvider usa useNavigate, então tem
        de estar dentro do Router.
      */}
      <BrowserRouter>
        <AppProvider>
          {/*
            flex-1, e não w-1/2: duas metades MAIS o gap dão 100% + 16px, e a
            coluna da direita passava por cima do padding direito do body. Com
            flex-1 as colunas dividem o que sobra depois do gap.

            min-w-0 é obrigatório junto: sem ele um filho de flex não encolhe
            abaixo do tamanho do próprio conteúdo, e o overflow volta pela
            primeira imagem larga da galeria.
          */}
          <div className="flex w-full h-full gap-2">
            <div className="flex-1 min-w-0 h-full flex flex-col gap-2 overflow-hidden">
              <Gallery />
              <MusicPlayer />
            </div>
            <div className="flex-1 min-w-0 h-full overflow-hidden">
              <App />
            </div>
          </div>
        </AppProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
