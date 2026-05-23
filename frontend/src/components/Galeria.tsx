import { useEffect, useRef, useState } from 'react';
import { API_CONFIG } from '../config/api';
import { Frame } from '@react95/core/Frame';
import { TitleBar } from '@react95/core/TitleBar';
import { Wangimg128 } from '@react95/icons';

interface GalleryItem {
  id: string;
  filename: string;
  url: string;
  order: number;
  uploadedAt: number;
}

const SLIDE_INTERVAL_MS = 5 * 60 * 1000;
const POLL_INTERVAL_MS = 30 * 1000;

export function Galeria() {
  const [images, setImages] = useState<GalleryItem[]>([]);
  const [current, setCurrent] = useState(0);
  const [fade, setFade] = useState(true);
  const slideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function fetchImages() {
    try {
      const res = await fetch(`${API_CONFIG.BASE_URL}/api/gallery`);
      if (!res.ok) return;
      const data: GalleryItem[] = await res.json();
      setImages([...data].sort((a, b) => a.order - b.order));
    } catch {
      // silently ignore network errors
    }
  }

  useEffect(() => {
    fetchImages();
    const pollId = setInterval(fetchImages, POLL_INTERVAL_MS);
    return () => clearInterval(pollId);
  }, []);

  useEffect(() => {
    if (images.length < 2) return;

    function advance() {
      setFade(false);
      setTimeout(() => {
        setCurrent((prev) => (prev + 1) % images.length);
        setFade(true);
      }, 600);
      slideTimer.current = setTimeout(advance, SLIDE_INTERVAL_MS);
    }

    slideTimer.current = setTimeout(advance, SLIDE_INTERVAL_MS);
    return () => {
      if (slideTimer.current) clearTimeout(slideTimer.current);
    };
  }, [images]);

  if (images.length === 0) {
    return (
      <Frame
        className="w-1/2 h-full flex flex-col shrink-0 overflow-hidden relative bg-black"
        p="$1"
        boxShadow="$out"
      >
        <TitleBar title="Galeria" icon={<Wangimg128 variant="16x16_4" />} />

        <Frame className="flex-1 min-h-0 overflow-hidden" p="$3" pr="$4" bgColor="$material">
          <Frame className="w-full h-full flex items-center justify-center overflow-hidden" bg="white" boxShadow="$in" pt="$2" pl="$2">
            <span>Galeria vazia</span>
          </Frame>
        </Frame>
      </Frame>
    );
  }

  const img = images[current];
  const src = img.url.startsWith('http') ? img.url : `${API_CONFIG.BASE_URL}${img.url}`;

  return (
    <Frame
      className="w-1/2 h-full flex flex-col shrink-0 overflow-hidden relative bg-black"
      p="$1"
      boxShadow="$out"
    >
      <TitleBar title="Galeria" icon={<Wangimg128 variant="16x16_4" />} />

      <Frame className="flex-1 min-h-0 overflow-hidden" p="$3" pr="$4" as="figure" bgColor="$material">
        <Frame className="w-full h-full overflow-hidden" bg="white" boxShadow="$in" pt="$1" pl="$1">
          <img
            key={img.id}
            src={src}
            alt=""
            className={`w-full h-full object-cover block transition-opacity duration-[600ms] ${fade ? 'opacity-100' : 'opacity-0'}`}
          />
        </Frame>
      </Frame>
    </Frame>
  );
}
