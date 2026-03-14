import { TResponse } from "@formbricks/types/responses";

export interface TResponseEvent {
  id: string;
  environmentId: string;
  surveyId: string;
  surveyName: string;
  event: "responseCreated" | "responseFinished";
  response: Pick<TResponse, "id" | "createdAt" | "data" | "finished">;
  timestamp: Date;
}

export type TResponseEventCallback = (event: TResponseEvent) => void;

export interface IResponseEventBus {
  publish(event: TResponseEvent): void;
  subscribe(environmentId: string, callback: TResponseEventCallback): () => void;
  getSubscriberCount(environmentId: string): number;
}

export type TStreamEvent = {
  id: string;
  surveyId: string;
  surveyName: string;
  event: "responseCreated" | "responseFinished";
  responseId: string;
  responseData: Record<string, string | number | string[]>;
  finished: boolean;
  createdAt: string;
};

export type TConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

const truncate = (text: string, maxLength: number = 80): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
};

export const formatResponsePreview = (data: TStreamEvent["responseData"]): string => {
  const entries = Object.entries(data);
  if (entries.length === 0) return "";
  const [, firstValue] = entries[0];
  const valueStr = Array.isArray(firstValue) ? firstValue.join(", ") : String(firstValue);
  return truncate(valueStr);
};
