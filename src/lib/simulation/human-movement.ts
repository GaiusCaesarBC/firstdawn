import { createGrid, type SpatialGrid } from "./grid/grid";
import { getHydrologyState } from "./hydrology-engine";
import { strongestKnowledgeByTag } from "./human-knowledge";
import type {
  HumanAgent,
  HumanCausalEvent,
  HumanGoalType,
  HumanKnowledge,
  HumanMemory,
  HumanMovementIntent,
  HumanRelationship,
} from "./human-types";
import { getTerrainState, type TerrainType } from "./terrain-engine";
import { DEFAULT_WORLD_TIME_CONFIG } from "./time-engine";

export type HumanMovementCell = {
  id: string;
  row: number;
  column: number;
  neighborIds: readonly string[];
  foodAvailability: number;
  waterAvailability: number;
  shelterAvailability: number;
  dangerScore: number;
  temperatureStress: number;
  movementCost: number;
  isPassable: boolean;
};

export type HumanMovementEnvironment = {
  cells: ReadonlyMap<string, HumanMovementCell>;
  longitudeDivisions: number;
};

export type HumanMovementScore = {
  cellId: string;
  score: number;
  reasons: readonly string[];
  isCurrentCell: boolean;
};

export type HumanMovementDecision = {
  agent: HumanAgent;
  event: HumanCausalEvent | null;
  scores: readonly HumanMovementScore[];
};

type MovementWorldSource = {
  id?: string;
  seed?: string | null;
};

type MemoryTarget = {
  cellId: string | null;
  score: number;
};

const RECENT_PATH_LIMIT = 12;
const IMPASSABLE_TERRAIN = new Set<TerrainType>(["DEEP_OCEAN", "OCEAN", "SHALLOW_SEA"]);

function round(value: number, digits = 6): number {
  const factor = 10 ** digits;

  return Object.is(value, -0) ? 0 : Math.round(value * factor) / factor;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, round(value)));
}

function stableOffset(seed: string, tick: bigint, label: string): number {
  let hash = 2_166_136_261;
  const input = `${seed}:${tick.toString()}:human-movement:${label}`;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return ((hash >>> 0) % 10_000) / 1_000_000;
}

function parseCellId(cellId: string): { row: number; column: number } | null {
  const match = /^cell-(\d+)-(\d+)$/.exec(cellId);

  return match ? { row: Number(match[1]), column: Number(match[2]) } : null;
}

function cellDistance(environment: HumanMovementEnvironment, fromCellId: string | null | undefined, toCellId: string | null | undefined): number {
  if (!fromCellId || !toCellId || fromCellId === toCellId) {
    return 0;
  }

  const from = environment.cells.get(fromCellId);
  const to = environment.cells.get(toCellId);
  const fromPosition = from ?? parseCellId(fromCellId);
  const toPosition = to ?? parseCellId(toCellId);

  if (!fromPosition || !toPosition) {
    return fromCellId === toCellId ? 0 : 99;
  }

  const rowDistance = Math.abs(fromPosition.row - toPosition.row);
  const rawColumnDistance = Math.abs(fromPosition.column - toPosition.column);
  const wrappedColumnDistance = Math.min(rawColumnDistance, Math.max(0, environment.longitudeDivisions - rawColumnDistance));

  return Math.max(rowDistance, wrappedColumnDistance);
}

function terrainMovementCost(terrainType: TerrainType, ruggedness: number, weatherPenalty: number): number {
  const base = terrainType === "BEACH" ? 0.16
    : terrainType === "PLAINS" ? 0.12
      : terrainType === "PLATEAU" ? 0.2
        : terrainType === "HILLS" ? 0.3
          : terrainType === "MOUNTAINS" ? 0.48
            : terrainType === "HIGH_MOUNTAINS" ? 0.68
              : 0.92;

  return clamp01(base + ruggedness * 0.22 + weatherPenalty);
}

function waterBodyScore(waterBodyType: string): number {
  switch (waterBodyType) {
    case "RIVER_CHANNEL_CANDIDATE":
    case "RIVER_SOURCE_CANDIDATE":
      return 1;
    case "LAKE_CANDIDATE":
      return 0.88;
    case "INLAND_BASIN":
      return 0.48;
    case "COASTAL_WATER":
      return 0.24;
    default:
      return 0;
  }
}

export function buildHumanMovementEnvironment(
  world: MovementWorldSource,
  tick: bigint,
  grid: SpatialGrid = createGrid(),
): HumanMovementEnvironment {
  const movementWorld = {
    ...DEFAULT_WORLD_TIME_CONFIG,
    currentTick: tick,
    seed: world.seed?.trim() || "first-dawn-human-movement",
  };
  const terrainState = getTerrainState(movementWorld as never, grid);
  const hydrologyState = getHydrologyState(movementWorld as never, grid);
  const terrainById = new Map(terrainState.cells.map((cell) => [cell.id, cell]));
  const hydrologyById = new Map(hydrologyState.cells.map((cell) => [cell.id, cell]));
  const cells = new Map<string, HumanMovementCell>();

  for (const gridCell of grid.iterateCells()) {
    const terrain = terrainById.get(gridCell.id);
    const hydrology = hydrologyById.get(gridCell.id);
    if (!terrain || !hydrology) {
      continue;
    }

    const latitudeWarmth = clamp01(1 - Math.abs(gridCell.midpointLatitude) / 92);
    const seasonalWave = Math.sin((Number(tick % 240n) / 240) * Math.PI * 2);
    const estimatedTemperatureC = -12 + latitudeWarmth * 42 + seasonalWave * (gridCell.hemisphere.latitude === "southern" ? -5 : 5);
    const tooCold = Math.max(0, 4 - estimatedTemperatureC) / 34;
    const tooHot = Math.max(0, estimatedTemperatureC - 33) / 28;
    const waterAvailability = Math.max(
      waterBodyScore(hydrology.waterBodyType),
      hydrology.moisturePotential * 0.62,
      hydrology.isRiverCandidate ? 0.84 : 0,
      hydrology.isLakeCandidate ? 0.78 : 0,
    );
    const landFoodBase = IMPASSABLE_TERRAIN.has(terrain.terrainType) ? 0 : 1;
    const terrainFood = terrain.terrainType === "PLAINS" ? 0.48
      : terrain.terrainType === "HILLS" ? 0.36
        : terrain.terrainType === "BEACH" ? 0.18
          : terrain.terrainType === "PLATEAU" ? 0.22
            : 0.12;
    const foodAvailability = clamp01(landFoodBase * (terrainFood + hydrology.moisturePotential * 0.44 + latitudeWarmth * 0.16 - Math.max(tooCold, tooHot) * 0.18));
    const shelterAvailability = Math.max(
      (terrain.terrainType === "HILLS" || terrain.terrainType === "MOUNTAINS" || terrain.terrainType === "PLATEAU") ? 0.48 : 0,
      terrain.terrainType === "PLAINS" ? 0.24 + hydrology.moisturePotential * 0.18 : 0,
      terrain.isCoast ? 0.18 : 0,
    );
    const weatherPenalty = Math.max(tooCold, tooHot) * 0.08;

    cells.set(gridCell.id, {
      id: gridCell.id,
      row: gridCell.row,
      column: gridCell.column,
      neighborIds: gridCell.neighbors,
      foodAvailability: clamp01(foodAvailability),
      waterAvailability: clamp01(waterAvailability),
      shelterAvailability: clamp01(shelterAvailability),
      dangerScore: clamp01(Math.max(terrain.ruggedness * 0.18, Math.max(tooCold, tooHot) * 0.22)),
      temperatureStress: clamp01(Math.max(tooCold, tooHot)),
      movementCost: terrainMovementCost(terrain.terrainType, terrain.ruggedness, weatherPenalty),
      isPassable: !IMPASSABLE_TERRAIN.has(terrain.terrainType),
    });
  }

  return {
    cells,
    longitudeDivisions: grid.summary.longitudeDivisions,
  };
}

function movementIntentForGoal(goalType: HumanGoalType | null | undefined): HumanMovementIntent {
  switch (goalType) {
    case "Find Food":
      return "seek-food";
    case "Find Water":
      return "seek-water";
    case "Explore":
      return "explore";
    case "Escape":
    case "Seek Safety":
    case "Defend Camp":
      return "avoid-danger";
    case "Return Home":
    case "Gather Near Camp":
      return "stay-near-home";
    case "Follow":
    case "Socialize":
    case "Stay Near Family":
    case "Help Other":
      return "follow-trusted";
    case "Seek Shelter":
      return "seek-shelter";
    case "Rest":
      return "rest";
    case "Wander":
      return "wander";
    default:
      return "stay";
  }
}

function relationshipFrom(relationships: readonly HumanRelationship[], fromAgentId: string, toAgentId: string): HumanRelationship | null {
  return relationships.find((relationship) => relationship.fromAgentId === fromAgentId && relationship.toAgentId === toAgentId) ?? null;
}

function memorySignal(memory: HumanMemory): number {
  return clamp01(memory.confidence * 0.48 + memory.importance * 0.34 + memory.emotionalWeight * 0.18);
}

function strongestMemoryTarget(memories: readonly HumanMemory[], tags: readonly string[]): MemoryTarget {
  const [target] = memories
    .filter((memory) => tags.some((tag) => memory.tags.includes(tag)))
    .map((memory) => ({ cellId: memory.locationCellId, score: memorySignal(memory) }))
    .sort((left, right) => right.score - left.score || left.cellId.localeCompare(right.cellId));

  return target ?? { cellId: null, score: 0 };
}

function strongestKnowledgeTarget(knowledge: readonly HumanKnowledge[], agentId: string, tag: string): MemoryTarget {
  const entry = strongestKnowledgeByTag(knowledge, agentId, tag);
  const cellId = entry?.tags.find((value) => /^cell-\d+-\d+$/.test(value)) ?? null;

  return entry && cellId
    ? { cellId, score: clamp01(entry.confidence * entry.mastery) }
    : { cellId: null, score: 0 };
}

function targetApproachScore(environment: HumanMovementEnvironment, currentCellId: string, candidateCellId: string, target: MemoryTarget): number {
  if (!target.cellId) {
    return 0;
  }

  const currentDistance = cellDistance(environment, currentCellId, target.cellId);
  const candidateDistance = cellDistance(environment, candidateCellId, target.cellId);

  if (candidateCellId === target.cellId) {
    return target.score;
  }

  return clamp01(((currentDistance - candidateDistance) / Math.max(1, currentDistance)) * target.score);
}

function knownSafeCells(agent: HumanAgent, memories: readonly HumanMemory[]): string[] {
  return [
    agent.homeProfile?.primaryHomeCellId,
    agent.homeCellId,
    ...(agent.homeProfile?.knownSafeCellIds ?? []),
    ...memories.filter((memory) => memory.tags.includes("safe") || memory.tags.includes("shelter")).map((memory) => memory.locationCellId),
  ].filter((cellId): cellId is string => Boolean(cellId));
}

function bestSafeTarget(environment: HumanMovementEnvironment, agent: HumanAgent, memories: readonly HumanMemory[]): MemoryTarget {
  return knownSafeCells(agent, memories)
    .map((cellId) => ({
      cellId,
      score: clamp01((agent.homeProfile?.cellAffinities[cellId] ?? agent.familiarityByCell[cellId] ?? 0.34) + (cellId === agent.homeCellId ? 0.22 : 0)),
    }))
    .sort((left, right) =>
      cellDistance(environment, agent.currentCellId, left.cellId) - cellDistance(environment, agent.currentCellId, right.cellId) ||
      right.score - left.score ||
      left.cellId.localeCompare(right.cellId)
    )[0] ?? { cellId: null, score: 0 };
}

function relationshipPressure(input: {
  agent: HumanAgent;
  agents: readonly HumanAgent[];
  relationships: readonly HumanRelationship[];
  candidateCellId: string;
  environment: HumanMovementEnvironment;
}): { trusted: number; threat: number; threatEscape: number } {
  let trusted = 0;
  let threat = 0;
  let threatEscape = 0;

  for (const other of input.agents) {
    if (other.id === input.agent.id || !other.isAlive) {
      continue;
    }

    const relation = relationshipFrom(input.relationships, input.agent.id, other.id);
    const trust = relation ? Math.max(relation.trust, relation.affection, relation.kinship !== "none" || relation.status === "Family" ? 0.82 : 0) : 0;
    const fear = relation ? Math.max(relation.fear, relation.status === "Threat" ? 0.92 : 0, relation.rivalry * 0.72, relation.status === "Rival" ? 0.62 : 0) : 0;
    const candidateDistance = cellDistance(input.environment, input.candidateCellId, other.currentCellId);
    const currentDistance = cellDistance(input.environment, input.agent.currentCellId, other.currentCellId);
    const proximity = candidateDistance === 0 ? 1 : candidateDistance === 1 ? 0.45 : 0;

    trusted = Math.max(trusted, trust * proximity);
    threat = Math.max(threat, fear * proximity);
    threatEscape = Math.max(threatEscape, clamp01((candidateDistance - currentDistance) / 2) * fear);
  }

  return { trusted: clamp01(trusted), threat: clamp01(threat), threatEscape: clamp01(threatEscape) };
}

function hasValidStayReason(agent: HumanAgent, currentCell: HumanMovementCell, sameCellTrusted: number): boolean {
  const goalType = agent.currentGoal?.type;

  if (goalType === "Rest" && agent.needs.fatigue >= 0.45) {
    return true;
  }

  if ((goalType === "Stay Near Family" || goalType === "Socialize" || goalType === "Follow") && sameCellTrusted >= 0.46) {
    return true;
  }

  if (goalType === "Find Food" && currentCell.foodAvailability >= 0.66) {
    return true;
  }

  if (goalType === "Find Water" && currentCell.waterAvailability >= 0.66) {
    return true;
  }

  if (goalType === "Seek Shelter" && currentCell.shelterAvailability >= 0.62 && currentCell.dangerScore < 0.48) {
    return true;
  }

  if ((goalType === "Return Home" || goalType === "Gather Near Camp") && agent.currentCellId === (agent.homeProfile?.primaryHomeCellId ?? agent.homeCellId)) {
    return true;
  }

  return false;
}

function movementThreshold(agent: HumanAgent, currentCell: HumanMovementCell, validStayReason: boolean): number {
  if (validStayReason && currentCell.dangerScore < 0.58) {
    return 0.28;
  }

  const urgent = Math.max(agent.needs.hunger, agent.needs.thirst, agent.needs.safety);
  const stuckPressure = Math.min(0.08, agent.stuckTicks * 0.012);
  const urgencyPressure = urgent >= 0.72 ? 0.04 : urgent >= 0.58 ? 0.02 : 0;

  return Math.max(0.015, 0.09 - stuckPressure - urgencyPressure);
}

function scoreCell(input: {
  agent: HumanAgent;
  agents: readonly HumanAgent[];
  relationships: readonly HumanRelationship[];
  memories: readonly HumanMemory[];
  knowledge: readonly HumanKnowledge[];
  environment: HumanMovementEnvironment;
  currentCell: HumanMovementCell;
  candidate: HumanMovementCell;
  tick: bigint;
  seed: string;
}): HumanMovementScore {
  const { agent, candidate, currentCell, environment } = input;
  const goalType = agent.currentGoal?.type ?? null;
  const isCurrentCell = candidate.id === agent.currentCellId;
  const reasons: string[] = [];
  let score = 0;
  const personalMemories = input.memories.filter((memory) => memory.agentId === agent.id);
  const foodTarget = strongestMemoryTarget(personalMemories, ["food"]);
  const waterTarget = strongestMemoryTarget(personalMemories, ["water"]);
  const shelterTarget = strongestMemoryTarget(personalMemories, ["shelter", "safe"]);
  const dangerTarget = strongestMemoryTarget(personalMemories, ["danger", "risk"]);
  const knowledgeFood = strongestKnowledgeTarget(input.knowledge, agent.id, "food");
  const knowledgeWater = strongestKnowledgeTarget(input.knowledge, agent.id, "water");
  const knowledgeShelter = strongestKnowledgeTarget(input.knowledge, agent.id, "shelter");
  const safeTarget = bestSafeTarget(environment, agent, personalMemories);
  const social = relationshipPressure({
    agent,
    agents: input.agents,
    relationships: input.relationships,
    candidateCellId: candidate.id,
    environment,
  });
  const familiarity = agent.familiarityByCell[candidate.id] ?? agent.homeProfile?.cellAffinities[candidate.id] ?? 0;
  const unexplored = familiarity <= 0.02 && !agent.recentPath.includes(candidate.id) ? 1 : 0;
  const recentPenalty = agent.recentPath.slice(-4).includes(candidate.id) && !isCurrentCell ? 0.16 : 0;
  const distanceFromDangerMemory = dangerTarget.cellId
    ? clamp01((cellDistance(environment, candidate.id, dangerTarget.cellId) - cellDistance(environment, agent.currentCellId, dangerTarget.cellId)) / 2) * dangerTarget.score
    : 0;

  if (goalType === "Find Food") {
    const approach = Math.max(targetApproachScore(environment, agent.currentCellId, candidate.id, foodTarget), targetApproachScore(environment, agent.currentCellId, candidate.id, knowledgeFood));
    score += candidate.foodAvailability * 1.42 + approach * 1.1;
    if (candidate.foodAvailability >= currentCell.foodAvailability + 0.08) reasons.push("better food nearby");
    if (approach > 0) reasons.push("remembered food route");
  }

  if (goalType === "Find Water") {
    const approach = Math.max(targetApproachScore(environment, agent.currentCellId, candidate.id, waterTarget), targetApproachScore(environment, agent.currentCellId, candidate.id, knowledgeWater));
    score += candidate.waterAvailability * 1.58 + approach * 1.18;
    if (candidate.waterAvailability >= currentCell.waterAvailability + 0.08) reasons.push("better water nearby");
    if (approach > 0) reasons.push("remembered water route");
  }

  if (goalType === "Seek Shelter") {
    const approach = Math.max(targetApproachScore(environment, agent.currentCellId, candidate.id, shelterTarget), targetApproachScore(environment, agent.currentCellId, candidate.id, knowledgeShelter));
    score += candidate.shelterAvailability * 1.24 + (currentCell.temperatureStress + currentCell.dangerScore) * candidate.shelterAvailability * 0.48 + approach;
    if (candidate.shelterAvailability >= currentCell.shelterAvailability + 0.08) reasons.push("better shelter nearby");
  }

  if (goalType === "Escape" || goalType === "Seek Safety" || goalType === "Defend Camp") {
    const dangerReduction = Math.max(0, currentCell.dangerScore - candidate.dangerScore);
    score += dangerReduction * 2.1 + distanceFromDangerMemory * 0.92 + targetApproachScore(environment, agent.currentCellId, candidate.id, safeTarget) * 0.8;
    if (dangerReduction > 0.08) reasons.push("moving away from danger");
    if (safeTarget.cellId && targetApproachScore(environment, agent.currentCellId, candidate.id, safeTarget) > 0) reasons.push("returning toward safe memory");
  }

  if (goalType === "Return Home" || goalType === "Gather Near Camp") {
    const homeTarget = { cellId: agent.currentGoal?.targetCellId ?? agent.homeProfile?.primaryHomeCellId ?? agent.homeCellId, score: 0.86 };
    score += targetApproachScore(environment, agent.currentCellId, candidate.id, homeTarget) * 1.18 + familiarity * 0.34;
    if (candidate.id === homeTarget.cellId) reasons.push("home cell reached");
  }

  if (goalType === "Stay Near Family" || goalType === "Socialize" || goalType === "Follow" || goalType === "Help Other") {
    score += social.trusted * 1.42;
    if (social.trusted > 0.24) reasons.push("trusted human nearby");
  }

  if (goalType === "Explore") {
    const stuckBoost = Math.min(0.7, agent.stuckTicks * 0.08);
    score += unexplored * (1.02 + agent.curiosityProfile.noveltySeeking * 0.34 + stuckBoost) + (1 - candidate.dangerScore) * 0.16;
    if (unexplored > 0) reasons.push("unknown neighboring cell");
  }

  if (goalType === "Wander" || !goalType) {
    const wanderPressure = 0.18 + agent.curiosityProfile.noveltySeeking * 0.2 + Math.min(0.56, agent.stuckTicks * 0.07);
    score += unexplored * wanderPressure + familiarity * 0.1;
    if (unexplored > 0) reasons.push("low-pressure wandering");
  }

  if (goalType !== "Rest" && agent.stuckTicks >= 4 && !isCurrentCell) {
    score += Math.min(0.62, agent.stuckTicks * 0.075) * (unexplored ? 1.2 : 0.72);
    reasons.push("anti-stuck exploration pressure");
  }

  score += social.threatEscape * 1.08;
  if (social.threatEscape > 0.08) reasons.push("moving away from threat");

  score += familiarity * 0.16;
  if (candidate.id === agent.homeCellId || candidate.id === agent.homeProfile?.primaryHomeCellId) {
    score += agent.needs.fatigue * 0.22 + agent.emotions.attachment * 0.16;
    reasons.push("familiar home area");
  }

  if (isCurrentCell) {
    score += 0.18 + familiarity * 0.16;
    if (goalType === "Rest") score += agent.needs.fatigue * 0.72;
    if (goalType === "Stay Near Family" || goalType === "Socialize") score += social.trusted * 0.72;
  } else {
    score -= candidate.movementCost * (0.34 + agent.needs.fatigue * 0.36);
    score -= recentPenalty;
  }

  score -= candidate.dangerScore * 0.84;
  score -= candidate.temperatureStress * 0.18;
  score -= social.threat * 1.05;

  if (candidate.id === agent.previousCellId && agent.stuckTicks < 3 && goalType !== "Escape" && goalType !== "Seek Safety") {
    score -= 0.12;
  }

  score += stableOffset(input.seed, input.tick, `${agent.id}:${candidate.id}:${goalType ?? "none"}`);

  return {
    cellId: candidate.id,
    score: round(score),
    reasons: reasons.length ? reasons : [isCurrentCell ? "staying remains best" : "locally scored neighbor"],
    isCurrentCell,
  };
}

function movementEvent(input: {
  agent: HumanAgent;
  tick: bigint;
  fromCell: HumanMovementCell;
  toCell: HumanMovementCell;
  score: HumanMovementScore;
  intent: HumanMovementIntent;
  returnedToRememberedLocation: boolean;
}): HumanCausalEvent {
  const nextDistance = input.agent.distanceTraveled + 1;
  const dangerReduction = input.fromCell.dangerScore - input.toCell.dangerScore;
  const isEscape = dangerReduction >= 0.16 && input.fromCell.dangerScore >= 0.42;
  const dangerousPassage = !isEscape && input.toCell.dangerScore >= 0.58;
  const migrationStarted = input.agent.stuckTicks >= 4;
  const longDistance = input.agent.distanceTraveled < 8 && nextDistance >= 8;
  const title = isEscape ? "Dangerous Escape"
    : dangerousPassage ? "Dangerous Passage"
      : input.agent.distanceTraveled === 0 ? "First Movement"
        : input.returnedToRememberedLocation ? "Returned To Remembered Location"
          : migrationStarted ? "Migration Started"
            : longDistance ? "Long-Distance Travel"
              : "Human Movement";
  const type = isEscape ? "Human Dangerous Escape"
    : dangerousPassage ? "Human Dangerous Movement"
      : migrationStarted ? "Human Migration Started"
        : longDistance ? "Human Long-Distance Travel"
          : input.returnedToRememberedLocation ? "Human Returned To Remembered Location"
            : "Human Movement";

  return {
    id: `${input.agent.worldId}:human-movement:${input.tick.toString()}:${input.agent.id}:${input.fromCell.id}:${input.toCell.id}`,
    worldId: input.agent.worldId,
    tick: input.tick.toString(),
    type,
    title,
    summary: `${input.agent.sex} human moved from ${input.fromCell.id} to ${input.toCell.id}: ${input.score.reasons.join(", ")}.`,
    agentIds: [input.agent.id],
    cellId: input.toCell.id,
    causes: {
      goalType: input.agent.currentGoal?.type ?? "none",
      movementIntent: input.intent,
      movementReason: input.score.reasons.join(", "),
      fromCellId: input.fromCell.id,
      currentDanger: input.fromCell.dangerScore,
      targetDanger: input.toCell.dangerScore,
      targetFood: input.toCell.foodAvailability,
      targetWater: input.toCell.waterAvailability,
      targetShelter: input.toCell.shelterAvailability,
      targetMovementCost: input.toCell.movementCost,
      previousStuckTicks: input.agent.stuckTicks,
    },
    effects: {
      toCellId: input.toCell.id,
      previousCellId: input.fromCell.id,
      distanceTraveled: nextDistance,
      explorationCount: input.agent.familiarityByCell[input.toCell.id] ? input.agent.explorationCount : input.agent.explorationCount + 1,
      movementScore: input.score.score,
      eventKind: title,
    },
    memoryIds: [],
    chroniclerVisible: true,
    agentVisible: true,
  };
}

function stuckEvent(agent: HumanAgent, tick: bigint): HumanCausalEvent {
  return {
    id: `${agent.worldId}:human-movement-stuck:${tick.toString()}:${agent.id}:${agent.currentCellId}`,
    worldId: agent.worldId,
    tick: tick.toString(),
    type: "Human Movement Stuck",
    title: "Repeated Stuck Behavior Detected",
    summary: `${agent.sex} human stayed in ${agent.currentCellId} long enough for exploration pressure to rise.`,
    agentIds: [agent.id],
    cellId: agent.currentCellId,
    causes: {
      goalType: agent.currentGoal?.type ?? "none",
      stuckTicks: agent.stuckTicks,
      movementIntent: agent.movementIntent,
    },
    effects: {
      explorationPressureRaised: true,
      stuckTicks: agent.stuckTicks + 1,
    },
    memoryIds: [],
    chroniclerVisible: true,
    agentVisible: false,
  };
}

function movementReason(score: HumanMovementScore): string {
  return score.reasons.join(", ");
}

function isRememberedLocation(agent: HumanAgent, memories: readonly HumanMemory[], cellId: string): boolean {
  return knownSafeCells(agent, memories).includes(cellId);
}

export function evaluateHumanMovement(input: {
  agent: HumanAgent;
  agents: readonly HumanAgent[];
  relationships: readonly HumanRelationship[];
  memories: readonly HumanMemory[];
  knowledge: readonly HumanKnowledge[];
  environment: HumanMovementEnvironment;
  tick: bigint;
  seed: string;
}): HumanMovementDecision {
  const currentCell = input.environment.cells.get(input.agent.currentCellId);

  if (!currentCell || !input.agent.isAlive) {
    return { agent: input.agent, event: null, scores: [] };
  }

  const candidates = [
    currentCell,
    ...currentCell.neighborIds
      .map((cellId) => input.environment.cells.get(cellId))
      .filter((cell): cell is HumanMovementCell => Boolean(cell?.isPassable)),
  ];
  const scores = candidates
    .map((candidate) => scoreCell({ ...input, currentCell, candidate }))
    .sort((left, right) => right.score - left.score || left.cellId.localeCompare(right.cellId));
  const stayScore = scores.find((score) => score.cellId === currentCell.id) ?? scores[0];
  const bestScore = scores[0] ?? stayScore;
  const sameCellTrusted = relationshipPressure({
    agent: input.agent,
    agents: input.agents,
    relationships: input.relationships,
    candidateCellId: input.agent.currentCellId,
    environment: input.environment,
  }).trusted;
  const validStayReason = hasValidStayReason(input.agent, currentCell, sameCellTrusted);
  const threshold = movementThreshold(input.agent, currentCell, validStayReason);
  const shouldMove = bestScore && !bestScore.isCurrentCell && stayScore && bestScore.score > stayScore.score + threshold;
  const intent = shouldMove ? movementIntentForGoal(input.agent.currentGoal?.type) : validStayReason && input.agent.currentGoal?.type === "Rest" ? "rest" : "stay";

  if (!shouldMove) {
    const stuckTicks = input.agent.stuckTicks + 1;
    const nextAgent: HumanAgent = {
      ...input.agent,
      destinationCellId: input.agent.currentCellId,
      movementIntent: intent,
      movementReason: validStayReason ? `valid stay: ${movementReason(stayScore)}` : movementReason(stayScore),
      stuckTicks,
    };
    const event = !validStayReason && (stuckTicks === 5 || (stuckTicks > 5 && stuckTicks % 6 === 0))
      ? stuckEvent(nextAgent, input.tick)
      : null;

    return { agent: nextAgent, event, scores };
  }

  const targetCell = input.environment.cells.get(bestScore.cellId) ?? currentCell;
  const alreadyVisited = (input.agent.familiarityByCell[targetCell.id] ?? 0) > 0;
  const returnedToRememberedLocation = targetCell.id !== currentCell.id && isRememberedLocation(input.agent, input.memories.filter((memory) => memory.agentId === input.agent.id), targetCell.id);
  const nextAgent: HumanAgent = {
    ...input.agent,
    currentCellId: targetCell.id,
    previousCellId: currentCell.id,
    destinationCellId: targetCell.id,
    movementIntent: intent,
    movementReason: movementReason(bestScore),
    lastMovedTick: input.tick.toString(),
    recentPath: [...input.agent.recentPath, targetCell.id].slice(-RECENT_PATH_LIMIT),
    stuckTicks: 0,
    distanceTraveled: input.agent.distanceTraveled + 1,
    explorationCount: alreadyVisited ? input.agent.explorationCount : input.agent.explorationCount + 1,
    familiarityByCell: {
      ...input.agent.familiarityByCell,
      [targetCell.id]: clamp01((input.agent.familiarityByCell[targetCell.id] ?? 0) + 0.18),
    },
  };

  return {
    agent: nextAgent,
    event: movementEvent({
      agent: input.agent,
      tick: input.tick,
      fromCell: currentCell,
      toCell: targetCell,
      score: bestScore,
      intent,
      returnedToRememberedLocation,
    }),
    scores,
  };
}

export function updateHumanMovements(input: {
  agents: readonly HumanAgent[];
  relationships: readonly HumanRelationship[];
  memories: readonly HumanMemory[];
  knowledge: readonly HumanKnowledge[];
  environment: HumanMovementEnvironment;
  tick: bigint;
  seed: string;
}): { agents: HumanAgent[]; events: HumanCausalEvent[]; scoresByAgentId: ReadonlyMap<string, readonly HumanMovementScore[]> } {
  const decisions = input.agents.map((agent) => evaluateHumanMovement({ ...input, agent, agents: input.agents }));
  const scoresByAgentId = new Map(decisions.map((decision) => [decision.agent.id, decision.scores]));

  return {
    agents: decisions.map((decision) => decision.agent),
    events: decisions.flatMap((decision) => decision.event ? [decision.event] : []),
    scoresByAgentId,
  };
}

export function createHumanMovementCell(input: Partial<HumanMovementCell> & { id: string; neighborIds?: readonly string[] }): HumanMovementCell {
  const parsed = parseCellId(input.id) ?? { row: 0, column: 0 };

  return {
    id: input.id,
    row: input.row ?? parsed.row,
    column: input.column ?? parsed.column,
    neighborIds: input.neighborIds ?? [],
    foodAvailability: clamp01(input.foodAvailability ?? 0),
    waterAvailability: clamp01(input.waterAvailability ?? 0),
    shelterAvailability: clamp01(input.shelterAvailability ?? 0),
    dangerScore: clamp01(input.dangerScore ?? 0),
    temperatureStress: clamp01(input.temperatureStress ?? 0),
    movementCost: clamp01(input.movementCost ?? 0.12),
    isPassable: input.isPassable ?? true,
  };
}

export function createHumanMovementEnvironment(cells: readonly HumanMovementCell[], longitudeDivisions = 36): HumanMovementEnvironment {
  return {
    cells: new Map(cells.map((cell) => [cell.id, cell])),
    longitudeDivisions,
  };
}