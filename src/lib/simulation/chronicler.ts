import type {
  ChroniclerReport,
  HumanCausalEvent,
  HumanMvaState,
} from "./human-types";

function describeCauseKeys(event: HumanCausalEvent): string {
  const keys = Object.keys(event.causes);

  if (keys.length === 0) {
    return "no recorded causal inputs";
  }

  return keys.sort().join(", ");
}

export function createChroniclerReport(
  state: Readonly<HumanMvaState>,
  events: readonly HumanCausalEvent[],
): ChroniclerReport {
  const visibleEvents = events.filter((event) => event.chroniclerVisible);

  return {
    worldId: state.worldId,
    observedEventCount: visibleEvents.length,
    entries: visibleEvents.map((event) => ({
      eventId: event.id,
      tick: event.tick,
      title: event.title,
      summary: event.summary,
      causalSummary: `Causal inputs: ${describeCauseKeys(event)}.`,
    })),
  };
}
