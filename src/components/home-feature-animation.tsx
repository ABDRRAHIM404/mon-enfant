"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Play, Square } from "lucide-react";

export function HomeFeatureAnimation({
  name,
  description,
}: {
  name: string;
  description: string;
}) {
  const tile = useRef<HTMLElement>(null);
  const playCount = useRef(0);
  const [playing, setPlaying] = useState<number | null>(null);
  const timer = useRef<number | undefined>(undefined);

  function play() {
    setPlaying(++playCount.current);
  }

  function stop() {
    window.clearTimeout(timer.current);
    setPlaying(null);
  }

  useEffect(() => {
    const target = tile.current;
    if (!target || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        if (
          playCount.current === 0 &&
          !window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ) {
          setPlaying(++playCount.current);
        }
        observer.disconnect();
      },
      { threshold: 0.5 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const asset = `/brand/demo-${name}`;
  return (
    <figure ref={tile} className="home-feature-animation">
      <div className="home-feature-media">
        <Image
          src={
            playing === null ? `${asset}.webp` : `${asset}.gif?play=${playing}`
          }
          alt={description}
          width={640}
          height={384}
          unoptimized
          onLoad={() => {
            if (playing === null) return;
            window.clearTimeout(timer.current);
            timer.current = window.setTimeout(stop, 4650);
          }}
          onError={playing === null ? undefined : stop}
        />
      </div>
      <figcaption>
        {description}
        <button
          type="button"
          aria-label={`${playing === null ? "Lire" : "Arrêter"} l’animation — ${description}`}
          onClick={playing === null ? play : stop}
        >
          {playing === null ? (
            <Play aria-hidden="true" />
          ) : (
            <Square aria-hidden="true" />
          )}
        </button>
      </figcaption>
    </figure>
  );
}
