"use client";

import { useLayoutEffect, useRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Position = { left: number; top: number };

// Keep stable item keys and animate only the visual move after React updates the list.
export function AnimatedList({ as: Tag = "div", className, ...props }: HTMLAttributes<HTMLElement> & { as?: "div" | "ul" }) {
  const container = useRef<HTMLElement | null>(null);
  const previous = useRef(new Map<string, Position>());

  useLayoutEffect(() => {
    if (!container.current) return;
    const positions = new Map<string, Position>();
    const animations: Animation[] = [];
    const canAnimate = window.matchMedia?.("(prefers-reduced-motion: no-preference)").matches;
    for (const element of Array.from(container.current.children)) {
      if (!(element instanceof HTMLElement) || !element.dataset.motionId) continue;
      const id = element.dataset.motionId;
      const position = { left: element.offsetLeft, top: element.offsetTop };
      const old = previous.current.get(id);
      positions.set(id, position);
      if (canAnimate && old && element.animate && (old.left !== position.left || old.top !== position.top)) {
        animations.push(element.animate([
          { transform: `translate(${old.left - position.left}px, ${old.top - position.top}px)` },
          { transform: "translate(0, 0)" },
        ], { duration: 220, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }));
      }
    }
    previous.current = positions;
    return () => animations.forEach((animation) => animation.cancel());
  });

  return <Tag {...props} ref={(element: HTMLElement | null) => { container.current = element; }} className={cn("relative motion-stagger", className)} />;
}
