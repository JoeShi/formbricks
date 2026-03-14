import { EventEmitter } from "events";
import { IResponseEventBus, TResponseEvent, TResponseEventCallback } from "./types";

class EventEmitterBus implements IResponseEventBus {
  private emitter = new EventEmitter();

  constructor() {
    // Remove listener limit warnings for high-concurrency environments
    this.emitter.setMaxListeners(0);
  }

  publish(event: TResponseEvent): void {
    this.emitter.emit(`response:${event.environmentId}`, event);
  }

  subscribe(environmentId: string, callback: TResponseEventCallback): () => void {
    const channel = `response:${environmentId}`;
    this.emitter.on(channel, callback);
    return () => {
      this.emitter.off(channel, callback);
    };
  }

  getSubscriberCount(environmentId: string): number {
    return this.emitter.listenerCount(`response:${environmentId}`);
  }
}

// Singleton instance — replaceable with Redis pub/sub later
export const responseEventBus: IResponseEventBus = new EventEmitterBus();
