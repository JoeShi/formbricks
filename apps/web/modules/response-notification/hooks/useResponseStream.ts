"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TConnectionStatus, TStreamEvent } from "../lib/types";

export interface TUseResponseStreamReturn {
  lastEvent: TStreamEvent | null;
  connectionStatus: TConnectionStatus;
  reconnect: () => void;
}

const MAX_RETRY_DELAY_MS = 30_000;
const INITIAL_RETRY_DELAY_MS = 1_000;

export const useResponseStream = (environmentId: string): TUseResponseStreamReturn => {
  const [lastEvent, setLastEvent] = useState<TStreamEvent | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<TConnectionStatus>("connecting");
  const eventSourceRef = useRef<EventSource | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const url = new URL(`/api/v1/client/${environmentId}/responses/stream`, window.location.origin);

    const eventSource = new EventSource(url.toString());
    eventSourceRef.current = eventSource;
    setConnectionStatus("connecting");

    eventSource.addEventListener("connected", () => {
      setConnectionStatus("connected");
      retryCountRef.current = 0;
    });

    eventSource.addEventListener("response", (e: MessageEvent) => {
      const data = JSON.parse(e.data) as TStreamEvent;
      setLastEvent(data);
    });

    eventSource.addEventListener("heartbeat", () => {
      // Heartbeat received — connection is alive
    });

    eventSource.onerror = () => {
      eventSource.close();
      setConnectionStatus("disconnected");

      const delay = Math.min(INITIAL_RETRY_DELAY_MS * Math.pow(2, retryCountRef.current), MAX_RETRY_DELAY_MS);
      retryCountRef.current += 1;

      retryTimerRef.current = setTimeout(() => {
        connect();
      }, delay);
    };
  }, [environmentId]);

  const reconnect = useCallback(() => {
    retryCountRef.current = 0;
    connect();
  }, [connect]);

  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
    };
  }, [connect]);

  return { lastEvent, connectionStatus, reconnect };
};
