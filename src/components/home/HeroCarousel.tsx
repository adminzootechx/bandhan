"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useReducedMotion } from "framer-motion";
import Image from "@/components/ui/SiteImage";

const slides = [
  {
    image: "/images/hero-japan.webp",
    title: "Japan — Land of Cherry Blossoms",
    alt: "Japan, Land of Cherry Blossoms. Mount Fuji, Japanese temples, a red torii gate, and a woman in a floral kimono.",
    href: "/packages?search=Japan",
  },
  {
    image: "/images/hero-three-sisters.webp",
    title: "3 Sisters — Assam, Meghalaya & Arunachal Pradesh",
    alt: "3 Sisters: Assam, Meghalaya and Arunachal Pradesh. Tea gardens, one-horned rhinoceroses, a monastery, and a waterfall.",
    href: "/packages/3-sisters-tour",
  },
  {
    image: "/images/hero-ayodhya-varanasi.webp",
    title: "Ayodhya Varanasi — A Spiritual Gateway",
    alt: "Ayodhya Varanasi, A Spiritual Gateway. Ayodhya, Chitrakoot, Prayagraj, Varanasi and Bodhgaya, with temples and the Ganga aarti.",
    href: "/packages?search=Ayodhya",
  },
  {
    image: "/images/hero-singapore-malaysia-thailand.webp",
    title: "Singapore, Malaysia & Thailand",
    alt: "Singapore, Malaysia, Thailand. Three countries, endless adventure. The Merlion, Marina Bay, Petronas Towers and Bangkok temples.",
    href: "/packages?search=Singapore+Malaysia+Thailand",
  },
];

export default function HeroCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [focused, setFocused] = useState(false);
  const [touching, setTouching] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const reducedMotion = useReducedMotion();
  const isPaused = focused || touching || Boolean(reducedMotion);

  const move = (direction: number) => {
    setActiveIndex((index) => (index + direction + slides.length) % slides.length);
  };

  useEffect(() => {
    if (isPaused) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        setActiveIndex((index) => (index + 1) % slides.length);
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [activeIndex, isPaused]);

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured holidays"
      // Pointer interactions should not leave autoplay paused. Keep the
      // current banner still while someone navigates its links by keyboard.
      onPointerDownCapture={() => setFocused(false)}
      onFocusCapture={(event) => setFocused(event.target.matches(":focus-visible"))}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          setFocused(true);
          move(event.key === "ArrowLeft" ? -1 : 1);
        }
      }}
    >
      <h1 className="sr-only">Discover unforgettable holidays with Bandhan Tours</h1>
      <div
        className="relative aspect-[3/1] w-full touch-pan-y overflow-hidden bg-[#fff5f8]"
        onTouchStart={(event) => {
          touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
          setTouching(true);
        }}
        onTouchEnd={(event) => {
          if (touchStart.current) {
            const dx = event.changedTouches[0].clientX - touchStart.current.x;
            const dy = event.changedTouches[0].clientY - touchStart.current.y;
            if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
              event.preventDefault();
              move(dx < 0 ? 1 : -1);
            }
          }
          touchStart.current = null;
          setTouching(false);
        }}
        onTouchCancel={() => {
          touchStart.current = null;
          setTouching(false);
        }}
      >
        {slides.map((slide, index) => (
          <div
            key={slide.image}
            role="group"
            aria-roledescription="slide"
            aria-label={`${index + 1} of ${slides.length}: ${slide.title}`}
            aria-hidden={index !== activeIndex}
            inert={index !== activeIndex}
            className={`absolute inset-0 transition-opacity duration-500 motion-reduce:transition-none ${index === activeIndex ? "z-10 opacity-100" : "pointer-events-none opacity-0"}`}
          >
            <Link
              href={slide.href}
              tabIndex={index === activeIndex ? 0 : -1}
              aria-label={`Explore ${slide.title}`}
              className="relative block h-full w-full focus-visible:outline-4 focus-visible:-outline-offset-4 focus-visible:outline-navy"
              draggable={false}
            >
              <Image
                src={slide.image}
                alt={slide.alt}
                width={3750}
                height={1250}
                sizes="100vw"
                quality={90}
                preload={index === 0}
                className="block h-full w-full object-contain"
                draggable={false}
              />
            </Link>
          </div>
        ))}
      </div>
      <div className="mx-auto flex max-w-7xl items-center justify-center px-3 py-1 sm:px-6 sm:py-2">
        <div className="flex items-center" aria-label="Choose a banner">
          {slides.map((slide, index) => (
            <button
              key={slide.image}
              type="button"
              aria-label={`Show banner ${index + 1}: ${slide.title}`}
              aria-current={index === activeIndex ? "true" : undefined}
              onClick={() => setActiveIndex(index)}
              className="flex h-11 w-8 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-primary sm:w-10"
            >
              <span className={`h-2 rounded-full transition-all motion-reduce:transition-none ${index === activeIndex ? "w-6 bg-navy dark:bg-slate-200" : "w-2 bg-primary/25 dark:bg-white/25"}`} />
            </button>
          ))}
        </div>
      </div>
      <p className="sr-only" aria-live={isPaused ? "polite" : "off"} aria-atomic="true">{slides[activeIndex].title}</p>
    </div>
  );
}
