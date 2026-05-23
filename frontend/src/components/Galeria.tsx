import { useEffect, useRef, useState } from 'react';
import { API_CONFIG } from '../config/api';

interface GalleryItem {
  id: string;
  filename: string;
  url: string;
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
      setImages(data);
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
      <div className="w-1/2 h-full shrink-0 bg-[#111] flex items-center justify-center">
        <span className="text-[#444] text-[0.5rem] text-center">Galeria vazia</span>
      </div>
    );
  }

  const img = images[current];
  const src = img.url.startsWith('http') ? img.url : `${API_CONFIG.BASE_URL}${img.url}`;

  return (
    <div className="w-1/2 h-full shrink-0 overflow-hidden relative bg-black">
      <img
        key={img.id}
        src={src}
        alt=""
        className={`w-full h-full object-cover block transition-opacity duration-[600ms] ${fade ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  );
}
