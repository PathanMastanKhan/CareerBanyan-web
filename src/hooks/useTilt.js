import { useState, useEffect, useRef } from 'react';

export function useTilt() {
  const ref = useRef(null);
  const [tiltStyle, setTiltStyle] = useState({});
  const enabledRef = useRef(true);
  const rafRef = useRef(null);
  const pendingRef = useRef(null);

  useEffect(() => {
    try {
      const hoverOk = window.matchMedia('(hover: hover)').matches;
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      enabledRef.current = hoverOk && !reduceMotion;
    } catch (e) {
      enabledRef.current = false;
    }
  }, []);

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  const flush = () => {
    rafRef.current = null;
    if (pendingRef.current) setTiltStyle(pendingRef.current);
  };

  const onMouseMove = (e) => {
    if (!enabledRef.current || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const rotateY = (x - 0.5) * 8;
    const rotateX = (0.5 - y) * 8;
    pendingRef.current = {
      transform: `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`,
      transition: 'transform 0.05s linear, box-shadow 0.2s ease',
    };
    if (rafRef.current == null) rafRef.current = requestAnimationFrame(flush);
  };

  const onMouseLeave = () => {
    if (!enabledRef.current) return;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setTiltStyle({
      transform: 'perspective(800px) rotateX(0deg) rotateY(0deg) translateY(0px)',
      transition: 'transform 0.35s ease, box-shadow 0.2s ease',
    });
  };

  return { ref, tiltStyle, onMouseMove, onMouseLeave };
}
