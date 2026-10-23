import { useState, useEffect, useCallback, useRef } from 'react';

interface Position {
  x: number;
  y: number;
}

interface UseDraggableOptions {
  width?: number;
  height?: number;
  defaultWidth?: number;
  defaultHeight?: number;
  storageKey?: string;
  margin?: number;
}

export function useDraggable({
  width,
  height,
  defaultWidth = 380,
  defaultHeight = 520,
  storageKey = 'tabletell_copilot_orb_pos',
  margin = 12
}: UseDraggableOptions = {}) {
  const currentW = width ?? defaultWidth;
  const currentH = height ?? defaultHeight;

  // Viewport clamping function
  const clampPosition = useCallback((x: number, y: number, w = currentW, h = currentH): Position => {
    if (typeof window === 'undefined') return { x, y };
    const maxX = Math.max(margin, window.innerWidth - w - margin);
    const maxY = Math.max(margin, window.innerHeight - h - margin);
    return {
      x: Math.min(Math.max(margin, x), maxX),
      y: Math.min(Math.max(margin, y), maxY)
    };
  }, [currentW, currentH, margin]);

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
    // Default: anchored in bottom-right corner
    const winW = typeof window !== 'undefined' ? window.innerWidth : 1400;
    const winH = typeof window !== 'undefined' ? window.innerHeight : 900;
    const initialX = Math.max(margin, winW - currentW - 24);
    const initialY = Math.max(margin, winH - currentH - 24);
    return { x: initialX, y: initialY };
  });

  const [isDragging, setIsDragging] = useState(false);
  const positionRef = useRef<Position>(position);
  positionRef.current = position;

  const dragStartRef = useRef<{
    pointerId: number;
    mouseX: number;
    mouseY: number;
    startX: number;
    startY: number;
    moved: boolean;
  }>({
    pointerId: -1,
    mouseX: 0,
    mouseY: 0,
    startX: 0,
    startY: 0,
    moved: false
  });

  const hasDraggedRef = useRef(false);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Only primary mouse button or touch
    if (e.button !== 0) return;
    
    // Prevent default drag/selection
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);

    hasDraggedRef.current = false;
    dragStartRef.current = {
      pointerId: e.pointerId,
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: positionRef.current.x,
      startY: positionRef.current.y,
      moved: false
    };
    setIsDragging(true);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    const deltaX = e.clientX - dragStartRef.current.mouseX;
    const deltaY = e.clientY - dragStartRef.current.mouseY;

    if (Math.hypot(deltaX, deltaY) > 4) {
      dragStartRef.current.moved = true;
      hasDraggedRef.current = true;
    }

    const rawX = dragStartRef.current.startX + deltaX;
    const rawY = dragStartRef.current.startY + deltaY;
    const clamped = clampPosition(rawX, rawY);

    positionRef.current = clamped;
    setPosition(clamped);
  }, [isDragging, clampPosition]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {
      // ignore
    }

    setIsDragging(false);

    try {
      localStorage.setItem(storageKey, JSON.stringify(positionRef.current));
    } catch {
      // ignore
    }
  }, [isDragging, storageKey]);

  // Click handler that suppresses clicks if user was dragging
  const handleSafeClick = useCallback((callback: () => void) => {
    if (hasDraggedRef.current) {
      hasDraggedRef.current = false;
      return;
    }
    callback();
  }, []);

  // Window resize listener to keep element within viewport
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
    hasDraggedRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleSafeClick,
    clampPosition
  };
}
