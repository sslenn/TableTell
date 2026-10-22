import { useState, useEffect, useCallback, useRef } from 'react';

interface Position {
  x: number;
  y: number;
}

interface UseDraggableOptions {
  defaultWidth?: number;
  defaultHeight?: number;
  storageKey?: string;
}

export function useDraggable({
  defaultWidth = 380,
  defaultHeight = 520,
  storageKey = 'tabletell_assistant_pos'
}: UseDraggableOptions = {}) {
  const [position, setPosition] = useState<Position>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          return parsed;
        }
      }
    } catch {
      // fallback
    }
    // Default: anchored towards bottom-right
    const initialX = Math.max(16, (typeof window !== 'undefined' ? window.innerWidth : 1200) - defaultWidth - 24);
    const initialY = Math.max(16, (typeof window !== 'undefined' ? window.innerHeight : 800) - defaultHeight - 32);
    return { x: initialX, y: initialY };
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number }>({
    mouseX: 0,
    mouseY: 0,
    startX: 0,
    startY: 0
  });

  // Clamp within viewport
  const clampPosition = useCallback((x: number, y: number): Position => {
    const maxX = Math.max(16, window.innerWidth - defaultWidth - 16);
    const maxY = Math.max(16, window.innerHeight - defaultHeight - 16);
    return {
      x: Math.min(Math.max(16, x), maxX),
      y: Math.min(Math.max(16, y), maxY)
    };
  }, [defaultWidth, defaultHeight]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Only drag with primary mouse button
    if (e.button !== 0) return;
    e.preventDefault();

    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: position.x,
      startY: position.y
    };
  }, [position]);

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: PointerEvent) => {
      const deltaX = e.clientX - dragStartRef.current.mouseX;
      const deltaY = e.clientY - dragStartRef.current.mouseY;

      const rawX = dragStartRef.current.startX + deltaX;
      const rawY = dragStartRef.current.startY + deltaY;

      const clamped = clampPosition(rawX, rawY);
      setPosition(clamped);
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      try {
        localStorage.setItem(storageKey, JSON.stringify(position));
      } catch {
        // ignore
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging, clampPosition, position, storageKey]);

  // Adjust on window resize
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => clampPosition(prev.x, prev.y));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [clampPosition]);

  return {
    position,
    setPosition,
    isDragging,
    handlePointerDown
  };
}
