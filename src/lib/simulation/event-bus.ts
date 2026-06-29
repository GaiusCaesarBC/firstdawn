import type { SimulationSystemEvent, SimulationSystemResult } from "./systems/types";

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

export type CollectedSimulationEvent = SimulationSystemEvent & {
  worldId: string;
  tick: bigint;
  systemId: string;
};

export class DeterministicSystemEventBus {
  private readonly events: CollectedSimulationEvent[] = [];

  emit(systemId: string, worldId: string, tick: bigint, event: SimulationSystemEvent): void {
    this.events.push({
      ...event,
      worldId,
      tick,
      systemId,
    });
  }

  collect(): CollectedSimulationEvent[] {
    return [...this.events];
  }

  countForSystem(systemId: string): number {
    return this.events.filter((event) => event.systemId === systemId).length;
  }
}

export const simulationEventBus = new TickEventBus();
