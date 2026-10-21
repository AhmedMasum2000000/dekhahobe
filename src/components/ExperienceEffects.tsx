import { useEffect, useRef } from 'react';
import { Pause, Play } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useMotion } from '@/store/motion';

export function MotionToggle({ className = '' }: { className?: string }) {
  const { paused, reduced, toggle } = useMotion();
  return (
    <button type="button" className={`motion-toggle ${className}`} onClick={toggle}
      aria-pressed={paused || reduced} disabled={reduced} data-testid="motion-toggle"
      aria-label={reduced ? 'Reduced motion is enabled on your device' : paused ? 'Enable animations' : 'Pause animations'}>
      {paused || reduced ? <Play size={13} aria-hidden /> : <Pause size={13} aria-hidden />}
      <span>{reduced ? 'Reduced motion' : paused ? 'Motion off' : 'Pause motion'}</span>
    </button>
  );
}

/** One observer and one frame per scroll; no scroll-driven React rerenders. */
export function ExperienceEffects() {
  const { pathname } = useLocation();
  const { paused, reduced } = useMotion();
  const progress = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let frame = 0;
    const paint = () => {
      frame = 0;
      const height = document.documentElement.scrollHeight - window.innerHeight;
      if (progress.current) progress.current.style.transform = `scaleX(${height > 0 ? Math.min(1, Math.max(0, window.scrollY / height)) : 0})`;
    };
    const scroll = () => { if (!frame) frame = requestAnimationFrame(paint); };
    paint();
    window.addEventListener('scroll', scroll, { passive: true });
    window.addEventListener('resize', scroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', scroll);
      window.removeEventListener('resize', scroll);
    };
  }, [pathname]);

  useEffect(() => {
    if (paused || reduced || typeof IntersectionObserver === 'undefined') return;
    const elements = new Set<Element>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) {
        entry.target.classList.add('is-revealed');
        observer.unobserve(entry.target);
      }
    }, { rootMargin: '0px 0px -24px 0px', threshold: 0.04 });
    const prepare = () => {
      document.querySelectorAll('[data-reveal]').forEach((element) => {
        if (elements.has(element)) return;
        elements.add(element);
        element.classList.add('reveal-ready');
        observer.observe(element);
      });
    };
    prepare();
    const mutation = new MutationObserver(prepare);
    const main = document.querySelector('main');
    if (main) mutation.observe(main, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      mutation.disconnect();
      elements.forEach((element) => element.classList.remove('reveal-ready', 'is-revealed'));
    };
  }, [pathname, paused, reduced]);
  return <div className="reading-progress" ref={progress} aria-hidden />;
}
