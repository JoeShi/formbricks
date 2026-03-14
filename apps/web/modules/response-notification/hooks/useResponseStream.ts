"use client";

import { useEffect, useRef, useState } from "react";
import { TStreamEvent } from "../lib/types";

export const useResponseStream = (environmentId: string): { lastEvent: TStreamEvent | null } => {
  const [lastEvent, setLastEvent] = useState<TStreamEvent | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const url = new URL(`/api/v1/client/${environmentId}/responses/stream`, window.location.origin);

    const eventSource = new EventSource(url.toString());
    eventSourceRef.current = eventSource;

    eventSource.addEventListener("response", (e: MessageEvent) => {
      const data = JSON.parse(e.data) as TStreamEvent;
      setLastEvent(data);
    });

    // Browser's built-in EventSource handles reconnection automatically
    return () => {
      eventSource.close();
    };
  }, [environmentId]);

  return { lastEvent };
};
