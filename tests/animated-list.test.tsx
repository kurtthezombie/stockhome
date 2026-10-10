import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { AnimatedList } from "@/components/ui/animated-list";

test("reorders existing rows without losing focus, cancels animations, and respects reduced motion", () => {
  const originalAnimate = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "animate");
  const cancel = vi.fn();
  const animate = vi.fn(() => ({ cancel }));
  Object.defineProperty(HTMLElement.prototype, "animate", { configurable: true, value: animate });
  const offset = vi.spyOn(HTMLElement.prototype, "offsetTop", "get").mockImplementation(function (this: HTMLElement) {
    return Number(this.dataset.row ?? 0) * 48;
  });
  let reducedMotion = false;
  vi.stubGlobal("matchMedia", () => ({ matches: !reducedMotion }));
  const list = (ids: string[]) => <AnimatedList>{ids.map((id, index) => <button key={id} data-motion-id={id} data-row={index}>{id}</button>)}</AnimatedList>;
  try {
    const view = render(list(["Rice", "Milk"]));
    screen.getByRole("button", { name: "Rice" }).focus();
    view.rerender(list(["Milk", "Rice"]));
    expect(screen.getByRole("button", { name: "Rice" })).toHaveFocus();
    expect(animate).toHaveBeenCalledTimes(2);
    view.unmount();
    expect(cancel).toHaveBeenCalledTimes(2);
    reducedMotion = true;
    animate.mockClear();
    const reduced = render(list(["Rice", "Milk"]));
    reduced.rerender(list(["Milk", "Rice"]));
    expect(animate).not.toHaveBeenCalled();
    reduced.unmount();
  } finally {
    offset.mockRestore();
    if (originalAnimate) Object.defineProperty(HTMLElement.prototype, "animate", originalAnimate);
    else Reflect.deleteProperty(HTMLElement.prototype, "animate");
    vi.unstubAllGlobals();
  }
});
