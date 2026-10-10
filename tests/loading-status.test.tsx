import { act, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { LoadingStatus } from "@/components/ui/loading-status";

test("varies the starting joke, remembers it across visits, and cleans up rotation", () => {
  vi.useFakeTimers();
  vi.spyOn(Math, "random").mockReturnValue(0);
  window.sessionStorage.setItem("stockhome:loading-message:home", "0");
  try {
    const first = render(<LoadingStatus messageGroup="home">Loading your home</LoadingStatus>);
    act(() => { vi.advanceTimersByTime(0); });
    expect(screen.getByText(/the kettle has entered the chat/)).toBeInTheDocument();
    expect(first.container.querySelector(".sr-only")).toHaveTextContent("Loading your home");
    act(() => { vi.advanceTimersByTime(4000); });
    expect(screen.getByText(/checking if the plants paid rent/)).toBeInTheDocument();
    first.unmount();
    act(() => { vi.runOnlyPendingTimers(); });
    expect(vi.getTimerCount()).toBe(0);

    const next = render(<LoadingStatus messageGroup="home">Loading your home</LoadingStatus>);
    act(() => { vi.advanceTimersByTime(0); });
    expect(screen.getByText(/convincing the socks to reunite/)).toBeInTheDocument();
    next.unmount();
    act(() => { vi.runOnlyPendingTimers(); });
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    vi.useRealTimers();
    window.sessionStorage.removeItem("stockhome:loading-message:home");
  }
});
