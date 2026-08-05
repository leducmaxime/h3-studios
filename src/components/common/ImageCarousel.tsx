"use client";

import { useEffect, useCallback, useState } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";

interface ImageCarouselProps {
  images: { src: string; alt: string }[];
  autoPlay?: boolean;
  interval?: number;
  priorityFirst?: boolean;
  /**
   * Compact mode for small cards (booking studio mini-cards): the carousel
   * fills its parent's fixed height instead of aspect-video, and the dots
   * overlay the photo (bottom-right) instead of sitting below it — nothing
   * gets clipped by the card's overflow-hidden. Default (false) is the
   * original /les-studios presentation, unchanged.
   */
  compact?: boolean;
}

export function ImageCarousel({
  images,
  autoPlay = true,
  interval = 3000,
  priorityFirst = false,
  compact = false,
}: ImageCarouselProps) {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!api) return;

    setCount(api.scrollSnapList().length);
    setCurrent(api.selectedScrollSnap());

    api.on("select", () => {
      setCurrent(api.selectedScrollSnap());
    });
  }, [api]);

  useEffect(() => {
    if (!api || !autoPlay) return;

    const timer = setInterval(() => {
      api.scrollNext();
    }, interval);

    return () => clearInterval(timer);
  }, [api, autoPlay, interval]);

  const scrollTo = useCallback(
    (index: number) => {
      api?.scrollTo(index);
    },
    [api]
  );

  return (
    <div className={compact ? "relative h-full" : "relative"}>
      <Carousel
        setApi={setApi}
        className={compact ? "w-full h-full [&>div]:h-full" : "w-full"}
        opts={{ loop: true }}
      >
        <CarouselContent className={compact ? "ml-0 h-full" : "ml-0"}>
          {images.map((image, index) => (
            <CarouselItem key={index} className={compact ? "pl-0 h-full" : "pl-0"}>
              <img
                src={image.src}
                alt={image.alt}
                width={1200}
                height={675}
                className={compact ? "h-full w-full object-cover" : "aspect-video w-full object-cover"}
                loading={index === 0 && priorityFirst ? "eager" : "lazy"}
                fetchPriority={index === 0 && priorityFirst ? "high" : "auto"}
                decoding="async"
              />
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
      <div
        className={
          compact
            ? "absolute bottom-1.5 right-2 z-10 flex gap-1.5"
            : "mt-2 flex justify-center gap-2"
        }
      >
        {Array.from({ length: count }).map((_, index) => (
          <button
            key={index}
            onClick={() => scrollTo(index)}
            className={`rounded-full transition-colors ${
              compact
                ? "h-1.5 w-1.5 shadow-[0_0_3px_rgba(0,0,0,0.9)]"
                : "h-2 w-2"
            } ${index === current ? "bg-white" : "bg-white/50"}`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
