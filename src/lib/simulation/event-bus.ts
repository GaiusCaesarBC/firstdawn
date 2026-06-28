import type { SimulationSystemResult } from "./systems/types";

export type TickEventName =
  | "beforeTick"
  | "afterTick"
  | "beforeSystem"
  | "afterSystem"
  | "tickCompleted";

export type TickEventPayload = {
  worldId: string;
  tick: bigint;
  systemName?: string;
  systemLabel?: string;
  result?: SimulationSystemResult;
  success?: boolean;
  durationMs?: number;
  metadata?: Record<string, unknown>;
};

export type TickEventHandler = (payload: TickEventPayload) => void | Promise<void>;

export class TickEventBus {
  private readonly handlers = new Map<TickEventName, Set<TickEventHandler>>();

  subscribe(eventName: TickEventName, handler: TickEventHandler): () => void {
    const handlers = this.handlers.get(eventName) ?? new Set<TickEventHandler>();
    handlers.add(handler);
    this.handlers.set(eventName, handlers);

    return () => {
      handlers.delete(handler);
    };
  }

  async emit(eventName: TickEventName, payload: TickEventPayload): Promise<void> {
    const handlers = this.handlers.get(eventName);

    if (!handlers) {
      return;
    }

    for (const handler of handlers) {
      await handler(payload);
    }
  }
}

export const simulationEventBus = new TickEventBus();
