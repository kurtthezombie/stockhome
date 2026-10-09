"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

const loadingMessages = {
  home: [
    "Loading your home… convincing the socks to reunite.",
    "Loading your home… the kettle has entered the chat.",
    "Loading your home… checking if the plants paid rent.",
    "Loading your home… fluffing the digital cushions.",
    "Loading your home… locating the good scissors.",
    "Loading your home… negotiating with the junk drawer.",
  ],
  overview: [
    "Loading your overview… putting all our eggs in a dashboard.",
    "Loading your overview… the numbers are getting dressed.",
    "Loading your overview… conducting a household census. Socks count twice.",
    "Loading your overview… asking the pantry for a status report.",
    "Loading your overview… turning mild chaos into tidy numbers.",
    "Loading your overview… checking the household's vital snacks.",
  ],
  inventory: [
    "Loading your stock… asking the cereal to be serially organized.",
    "Loading your stock… investigating the mystery jar.",
    "Loading your stock… the cans are forming a queue.",
    "Loading your stock… checking the fridge's cold, hard facts.",
    "Loading your stock… finding the rice. It's grain business.",
    "Loading your stock… giving the spice rack a pep talk.",
  ],
  tasks: [
    "Loading tasks… the dust has declined to vacuum itself.",
    "Loading tasks… putting procrastination on the schedule.",
    "Loading tasks… reminding the laundry it has responsibilities.",
    "Loading tasks… recruiting tomorrow-you. References pending.",
    "Loading tasks… sorting the to-dos from the to-don't-wannas.",
    "Loading tasks… the dishes have requested a meeting.",
  ],
  groceries: [
    "Loading your list… checking whether cheese counts as a plan.",
    "Loading your list… asking the bananas to pace themselves.",
    "Loading your list… giving impulse snacks a background check.",
    "Loading your list… trying to remember why we came to this aisle.",
    "Loading your list… bread is rising to the occasion.",
    "Loading your list… milk would like a plus-one: cookies.",
  ],
} as const;

const lastMessages: Partial<Record<keyof typeof loadingMessages, number>> = {};

export function LoadingStatus({ children, className, messageGroup }: {
  children: React.ReactNode;
  className?: string;
  messageGroup?: keyof typeof loadingMessages;
}) {
  const [messageIndex, setMessageIndex] = useState<number | null>(null);
  const messages = messageGroup ? loadingMessages[messageGroup] : null;

  useEffect(() => {
    if (!messageGroup) return;
    const count = loadingMessages[messageGroup].length;
    const storageKey = `stockhome:loading-message:${messageGroup}`;
    let previous = lastMessages[messageGroup];
    try {
      const saved = window.sessionStorage.getItem(storageKey);
      if (saved !== null) previous = Number(saved);
    } catch { /* Keep variety in memory when browser storage is unavailable. */ }
    const hasPrevious = previous !== undefined && Number.isInteger(previous) && previous >= 0 && previous < count;
    let index = Math.floor(Math.random() * (count - (hasPrevious ? 1 : 0)));
    if (hasPrevious && previous !== undefined && index >= previous) index += 1;

    const showMessage = () => {
      lastMessages[messageGroup] = index;
      try { window.sessionStorage.setItem(storageKey, String(index)); } catch { /* Storage is optional. */ }
      setMessageIndex(index);
    };
    // Choose after hydration so the server and initial browser markup match.
    const start = window.setTimeout(showMessage, 0);
    const timer = window.setInterval(() => {
      index = (index + 1) % count;
      showMessage();
    }, 4000);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(timer);
    };
  }, [messageGroup]);

  const message = messages && messageIndex !== null
    ? messages[messageIndex % messages.length]
    : children;

  return (
    <span role="status" className={cn("inline-flex items-center justify-center gap-2", className)}>
      <span aria-hidden="true" className="size-4 shrink-0 rounded-full border-2 border-current border-r-transparent motion-safe:animate-spin" />
      {messages ? <>
        <span className="sr-only">{children}</span>
        <span aria-hidden="true">{message}</span>
      </> : <span>{children}</span>}
    </span>
  );
}
