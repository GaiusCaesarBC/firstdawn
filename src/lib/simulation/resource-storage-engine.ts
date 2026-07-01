import type { Prisma } from "@prisma/client";

import type {
  HumanAgent,
  HumanCausalEvent,
  HumanKnowledge,
  HumanMemory,
  HumanMvaState,
  HumanRelationship,
  HumanTickResult,
} from "./human-types";
import { getHumanMvaStateAtTick } from "./human-engine";
import { getFamilyGenerationsStateFromHumanState } from "./family-generations-engine";
import {
  getSettlementStateAtTick,
  type Settlement,
  type SettlementTickResult,
} from "./settlement-engine";

export const RESOURCE_STORAGE_SYSTEM_ID = "resource-storage";
export const RESOURCE_STORAGE_TICK_RESULT_CACHE_KEY = "resource-storage:tick-result";

export type ResourceOwnershipMode = "shared" | "family-first" | "personal-reserve" | "private-future";
export type ResourceReservation = "children" | "elders" | "family" | "settlement" | null;

export type ResourceTypeDefinition = {
  id: string;
  label: string;
  category: "food" | "water" | "fuel" | "building" | "medicine" | "tool" | "material";
  baseShelfLifeTicks: number | null;
  spoilageRate: number;
  storageDensity: number;
  tags: readonly string[];
};

export type StoredResource = {
  id: string;
  type: string;
  quantity: number;
  quality: number;
  freshness: number;
  createdTick: string;
  storedTick: string;
  expiresTick: string | null;
  producerHumanId: string | null;
  settlementId: string | null;
  locationCellId: string;
  reservedFor: ResourceReservation;
  tags: string[];
};

export type SettlementStorageHistoryEntry = {
  tick: string;
  type: string;
  resourceType: string | null;
  quantity: number;
  humanId: string | null;
  summary: string;
};

export type SettlementStorage = {
  id: string;
  settlementId: string;
  createdTick: string;
  lastUpdatedTick: string;
  resources: StoredResource[];
  capacity: number;
  preservationQuality: number;
  spoilageRate: number;
  accessibility: number;
  ownershipMode: ResourceOwnershipMode;
  history: SettlementStorageHistoryEntry[];
};

export type HumanInventorySummary = {
  humanId: string;
  familyId: string | null;
  settlementId: string | null;
  personalInventory: StoredResource[];
  familyInventory: StoredResource[];
  recentDeposits: SettlementStorageHistoryEntry[];
  recentWithdrawals: SettlementStorageHistoryEntry[];
  contributionHistory: SettlementStorageHistoryEntry[];
};

export type ResourceStorageEventKind =
  | "First Shared Food Cache"
  | "First Winter Preparation"
  | "Food Shortage"
  | "Food Surplus"
  | "First Stored Firewood"
  | "Resource Crisis"
  | "Settlement Sustained Through Winter"
  | "Largest Community Contribution"
  | "Resource Deposit"
  | "Resource Withdrawal"
  | "Resource Spoilage";

export type ResourceStorageSystemEvent = {
  id: string;
  worldId: string;
  tick: string;
  kind: ResourceStorageEventKind;
  title: string;
  summary: string;
  importance: number;
  settlementId: string;
  cellId: string;
  humanIds: string[];
  resourceType: string | null;
  quantity: number;
};

export type SettlementResourceSummary = {
  settlementId: string;
  storageId: string;
  totalQuantity: number;
  capacity: number;
  capacityUsed: number;
  foodSupply: number;
  waterSupply: number;
  firewood: number;
  constructionMaterials: number;
  spoilage: number;
  dailyConsumption: number;
  largestContributors: Array<{ humanId: string; quantity: number }>;
  mostNeededResources: string[];
  resourceTrends: Array<{ type: string; quantity: number; delta: number }>;
};

export type ResourceStorageResult = {
  worldId: string;
  tick: string;
  storages: SettlementStorage[];
  settlementSummaries: SettlementResourceSummary[];
  humanInventories: HumanInventorySummary[];
  events: ResourceStorageSystemEvent[];
  scoring: Array<{
    humanId: string;
    settlementId: string | null;
    depositScore: number;
    withdrawalScore: number;
    reasons: Record<string, number>;
  }>;
};

export type ResourceStorageScoringWeights = typeof DEFAULT_RESOURCE_STORAGE_SCORING;

const RESOURCE_HISTORY_LIMIT = 36;
const HUMAN_HISTORY_LIMIT = 12;
const TYPE_REGISTRY = new Map<string, ResourceTypeDefinition>();

export const DEFAULT_RESOURCE_STORAGE_SCORING = Object.freeze({
  depositThreshold: 0.58,
  withdrawalThreshold: 0.46,
  excessSupplies: 0.24,
  familySecure: 0.18,
  trustSettlement: 0.18,
  homeSettlement: 0.16,
  storageAvailable: 0.14,
  settlementPermanence: 0.1,
  hungerWithdrawal: 0.38,
  thirstWithdrawal: 0.42,
  familyCare: 0.18,
  shelterPreparation: 0.12,
  settlementSupport: 0.12,
});

const INITIAL_RESOURCE_TYPES: readonly ResourceTypeDefinition[] = Object.freeze([
  { id: "food", label: "Food", category: "food", baseShelfLifeTicks: 18, spoilageRate: 0.075, storageDensity: 1, tags: ["edible", "perishable"] },
  { id: "fresh-water", label: "Fresh Water", category: "water", baseShelfLifeTicks: 36, spoilageRate: 0.025, storageDensity: 1.2, tags: ["drinkable", "stale-risk"] },
  { id: "firewood", label: "Firewood", category: "fuel", baseShelfLifeTicks: null, spoilageRate: 0, storageDensity: 0.65, tags: ["fuel", "weather-preparation"] },
  { id: "stone", label: "Stone", category: "building", baseShelfLifeTicks: null, spoilageRate: 0, storageDensity: 0.35, tags: ["construction", "durable"] },
  { id: "wood", label: "Wood", category: "building", baseShelfLifeTicks: null, spoilageRate: 0.004, storageDensity: 0.55, tags: ["construction", "material"] },
  { id: "plant-fiber", label: "Plant Fiber", category: "material", baseShelfLifeTicks: 80, spoilageRate: 0.006, storageDensity: 0.4, tags: ["fiber", "material"] },
  { id: "animal-hides", label: "Animal Hides", category: "material", baseShelfLifeTicks: 48, spoilageRate: 0.018, storageDensity: 0.45, tags: ["hide", "material"] },
  { id: "medicinal-plants", label: "Medicinal Plants", category: "medicine", baseShelfLifeTicks: 24, spoilageRate: 0.045, storageDensity: 0.25, tags: ["medicine", "perishable"] },
  { id: "simple-tools", label: "Simple Tools", category: "tool", baseShelfLifeTicks: null, spoilageRate: 0.002, storageDensity: 0.2, tags: ["tool", "durable"] },
  { id: "construction-materials", label: "Construction Materials", category: "building", baseShelfLifeTicks: null, spoilageRate: 0.002, storageDensity: 0.3, tags: ["construction", "durable"] },
]);

for (const definition of INITIAL_RESOURCE_TYPES) {
  TYPE_REGISTRY.set(definition.id, definition);
}

function round(value: number, digits = 6): number {
  const factor = 10 ** digits;

  return Object.is(value, -0) ? 0 : Math.round(value * factor) / factor;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, round(value)));
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))].sort();
}

function average(values: readonly number[]): number {
  return values.length === 0 ? 0 : round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function typeDefinition(resourceType: string): ResourceTypeDefinition {
  return TYPE_REGISTRY.get(resourceType) ?? {
    id: resourceType,
    label: resourceType,
    category: "material",
    baseShelfLifeTicks: null,
    spoilageRate: 0,
    storageDensity: 1,
    tags: [],
  };
}

export function registerResourceType(definition: ResourceTypeDefinition): void {
  TYPE_REGISTRY.set(definition.id, {
    ...definition,
    spoilageRate: clamp01(definition.spoilageRate),
    storageDensity: Math.max(0.01, round(definition.storageDensity)),
    tags: unique(definition.tags),
  });
}

export function getResourceTypes(): ResourceTypeDefinition[] {
  return [...TYPE_REGISTRY.values()].sort((left, right) => left.category.localeCompare(right.category) || left.id.localeCompare(right.id));
}

function storageId(settlementId: string): string {
  return `${settlementId}:storage`;
}

function quantityByType(resources: readonly StoredResource[], resourceType: string): number {
  return round(resources.filter((resource) => resource.type === resourceType).reduce((sum, resource) => sum + resource.quantity, 0));
}

function quantityByCategory(resources: readonly StoredResource[], category: ResourceTypeDefinition["category"]): number {
  return round(resources.filter((resource) => typeDefinition(resource.type).category === category).reduce((sum, resource) => sum + resource.quantity, 0));
}

function storageUsed(resources: readonly StoredResource[]): number {
  return round(resources.reduce((sum, resource) => sum + resource.quantity * typeDefinition(resource.type).storageDensity, 0));
}

function residentAgents(settlement: Settlement, agents: readonly HumanAgent[]): HumanAgent[] {
  return agents.filter((agent) =>
    agent.isAlive &&
    (settlement.occupiedCells.includes(agent.currentCellId) ||
      settlement.occupiedCells.includes(agent.homeCellId) ||
      settlement.occupiedCells.includes(agent.homeProfile?.primaryHomeCellId ?? ""))
  ).sort((left, right) => left.id.localeCompare(right.id));
}

function relationshipsFrom(relationships: readonly HumanRelationship[], humanId: string): HumanRelationship[] {
  return relationships.filter((relationship) => relationship.fromAgentId === humanId || relationship.humanId === humanId);
}

function trustScore(agent: HumanAgent, relationships: readonly HumanRelationship[]): number {
  const socialTrust = average(relationshipsFrom(relationships, agent.id).map((relationship) => relationship.trust));

  return clamp01(agent.emotions.trust * 0.58 + socialTrust * 0.32 + agent.emotions.attachment * 0.1);
}

function familySecure(agent: HumanAgent, agents: readonly HumanAgent[]): number {
  const family = agent.familyId
    ? agents.filter((candidate) => candidate.familyId === agent.familyId && candidate.isAlive)
    : [agent];
  const worstHunger = Math.max(...family.map((candidate) => candidate.needs.hunger));
  const worstThirst = Math.max(...family.map((candidate) => candidate.needs.thirst));
  const childrenFed = family
    .filter((candidate) => candidate.ageStage === "Infant" || candidate.ageStage === "Child" || candidate.ageStage === "Adolescent")
    .every((candidate) => candidate.needs.hunger < 0.68 && candidate.needs.thirst < 0.7);

  return clamp01((1 - worstHunger) * 0.38 + (1 - worstThirst) * 0.38 + (childrenFed ? 0.24 : 0));
}

function excessSupplyScore(agent: HumanAgent): number {
  return clamp01((1 - agent.needs.hunger) * 0.38 + (1 - agent.needs.thirst) * 0.34 + (1 - agent.needs.safety) * 0.16 + agent.confidence * 0.12);
}

function homeSettlementScore(agent: HumanAgent, settlement: Settlement): number {
  const homeCellId = agent.homeProfile?.primaryHomeCellId ?? agent.homeCellId;
  const affinity = agent.homeProfile?.cellAffinities[settlement.homeCellId] ?? agent.familiarityByCell[settlement.homeCellId] ?? 0;

  return clamp01((homeCellId === settlement.homeCellId ? 0.62 : 0) + (settlement.occupiedCells.includes(homeCellId) ? 0.18 : 0) + affinity * 0.2);
}

function preservationQuality(settlement: Settlement, knowledge: readonly HumanKnowledge[]): number {
  const relevantKnowledge = knowledge.filter((entry) =>
    !entry.isForgotten &&
    (entry.category === "food" || entry.category === "water" || entry.tags.includes("storage") || entry.tags.includes("survival")) &&
    settlement.founderIds.includes(entry.agentId)
  );
  const knowledgeScore = average(relevantKnowledge.map((entry) => entry.confidence * 0.5 + entry.mastery * 0.5));
  const fire = settlement.storedResources.fire > 0 || settlement.structures.includes("Shared Fire") ? 0.18 : 0;
  const shelter = settlement.structures.includes("Simple Shelter") ? 0.18 : 0;

  return clamp01(0.32 + settlement.permanence * 0.16 + fire + shelter + knowledgeScore * 0.16);
}

function createStorage(settlement: Settlement, tick: bigint, knowledge: readonly HumanKnowledge[]): SettlementStorage {
  const capacity = round(18 + settlement.currentPopulation * 5 + settlement.permanence * 36);
  const preservation = preservationQuality(settlement, knowledge);

  return {
    id: storageId(settlement.id),
    settlementId: settlement.id,
    createdTick: tick.toString(),
    lastUpdatedTick: tick.toString(),
    resources: [],
    capacity,
    preservationQuality: preservation,
    spoilageRate: round(1 - preservation),
    accessibility: clamp01(0.48 + settlement.importance * 0.24 + settlement.permanence * 0.18),
    ownershipMode: "shared",
    history: [],
  };
}

function resourceId(input: {
  settlementId: string;
  resourceType: string;
  tick: bigint;
  producerHumanId: string | null;
  ordinal: number;
}): string {
  return `${input.settlementId}:resource:${input.resourceType}:${input.tick.toString()}:${input.producerHumanId ?? "ambient"}:${input.ordinal}`;
}

function createResource(input: {
  settlement: Settlement;
  resourceType: string;
  quantity: number;
  quality: number;
  freshness: number;
  tick: bigint;
  producerHumanId: string | null;
  reservedFor?: ResourceReservation;
  ordinal: number;
}): StoredResource {
  const definition = typeDefinition(input.resourceType);
  const expiresTick = definition.baseShelfLifeTicks === null ? null : (input.tick + BigInt(definition.baseShelfLifeTicks)).toString();

  return {
    id: resourceId({
      settlementId: input.settlement.id,
      resourceType: input.resourceType,
      tick: input.tick,
      producerHumanId: input.producerHumanId,
      ordinal: input.ordinal,
    }),
    type: input.resourceType,
    quantity: round(input.quantity, 3),
    quality: clamp01(input.quality),
    freshness: clamp01(input.freshness),
    createdTick: input.tick.toString(),
    storedTick: input.tick.toString(),
    expiresTick,
    producerHumanId: input.producerHumanId,
    settlementId: input.settlement.id,
    locationCellId: input.settlement.homeCellId,
    reservedFor: input.reservedFor ?? null,
    tags: unique([input.resourceType, definition.category, ...definition.tags]),
  };
}

function historyEntry(input: {
  tick: bigint;
  type: string;
  resourceType: string | null;
  quantity: number;
  humanId: string | null;
  summary: string;
}): SettlementStorageHistoryEntry {
  return {
    tick: input.tick.toString(),
    type: input.type,
    resourceType: input.resourceType,
    quantity: round(input.quantity, 3),
    humanId: input.humanId,
    summary: input.summary,
  };
}

function applySpoilage(storage: SettlementStorage, tick: bigint): { storage: SettlementStorage; spoiledQuantity: number; entries: SettlementStorageHistoryEntry[] } {
  const entries: SettlementStorageHistoryEntry[] = [];
  let spoiledQuantity = 0;
  const resources = storage.resources.flatMap((resource) => {
    const definition = typeDefinition(resource.type);

    if (definition.spoilageRate <= 0) {
      return [resource];
    }

    const elapsedTicks = Math.max(0, Number(tick - BigInt(resource.storedTick)));
    const freshnessLoss = definition.spoilageRate * elapsedTicks * (1 - storage.preservationQuality * 0.62);
    const nextFreshness = clamp01(resource.freshness - freshnessLoss);
    const expired = resource.expiresTick !== null && tick >= BigInt(resource.expiresTick);
    const loss = expired || nextFreshness <= 0.08
      ? resource.quantity
      : resource.quantity * Math.max(0, resource.freshness - nextFreshness) * 0.35;
    const quantity = round(Math.max(0, resource.quantity - loss), 3);

    if (loss > 0.01) {
      spoiledQuantity += loss;
      entries.push(historyEntry({
        tick,
        type: "Spoilage",
        resourceType: resource.type,
        quantity: loss,
        humanId: null,
        summary: `${typeDefinition(resource.type).label} lost freshness in shared storage.`,
      }));
    }

    return quantity <= 0 ? [] : [{
      ...resource,
      quantity,
      freshness: nextFreshness,
      quality: clamp01(resource.quality - (loss > 0 ? definition.spoilageRate * 0.12 : 0)),
    }];
  });

  return {
    storage: {
      ...storage,
      resources,
      lastUpdatedTick: tick.toString(),
      history: [...storage.history, ...entries].slice(-RESOURCE_HISTORY_LIMIT),
    },
    spoiledQuantity: round(spoiledQuantity, 3),
    entries,
  };
}

function availableCapacity(storage: SettlementStorage): number {
  return Math.max(0, storage.capacity - storageUsed(storage.resources));
}

function chooseDepositResources(agent: HumanAgent): Array<{ resourceType: string; quantity: number; quality: number; freshness: number }> {
  const deposits: Array<{ resourceType: string; quantity: number; quality: number; freshness: number }> = [];
  const foodExcess = clamp01(0.66 - agent.needs.hunger);
  const waterExcess = clamp01(0.64 - agent.needs.thirst);
  const weatherPreparation = clamp01(agent.confidence * 0.36 + agent.homeProfile.cellAffinities[agent.homeCellId] * 0.28 + agent.emotions.attachment * 0.2);

  if (foodExcess > 0.16) {
    deposits.push({ resourceType: "food", quantity: round(0.6 + foodExcess * 2.4, 3), quality: 0.66 + agent.confidence * 0.16, freshness: 0.92 });
  }

  if (waterExcess > 0.18) {
    deposits.push({ resourceType: "fresh-water", quantity: round(0.5 + waterExcess * 2, 3), quality: 0.72, freshness: 0.96 });
  }

  if (weatherPreparation > 0.28) {
    deposits.push({ resourceType: "firewood", quantity: round(0.35 + weatherPreparation * 0.9, 3), quality: 0.62 + agent.confidence * 0.12, freshness: 1 });
  }

  return deposits;
}

function scoreDeposit(input: {
  agent: HumanAgent;
  settlement: Settlement;
  agents: readonly HumanAgent[];
  relationships: readonly HumanRelationship[];
  storage: SettlementStorage;
  weights: ResourceStorageScoringWeights;
}): { score: number; reasons: Record<string, number> } {
  const reasons = {
    excessSupplies: excessSupplyScore(input.agent),
    familySecure: familySecure(input.agent, input.agents),
    trustSettlement: trustScore(input.agent, input.relationships),
    homeSettlement: homeSettlementScore(input.agent, input.settlement),
    storageAvailable: clamp01(availableCapacity(input.storage) / Math.max(1, input.storage.capacity)),
    settlementPermanence: input.settlement.permanence,
  };
  const score = clamp01(
    reasons.excessSupplies * input.weights.excessSupplies +
    reasons.familySecure * input.weights.familySecure +
    reasons.trustSettlement * input.weights.trustSettlement +
    reasons.homeSettlement * input.weights.homeSettlement +
    reasons.storageAvailable * input.weights.storageAvailable +
    reasons.settlementPermanence * input.weights.settlementPermanence,
  );

  return { score, reasons };
}

function resourceNeed(agent: HumanAgent, resources: readonly StoredResource[]): { resourceType: string; need: number } | null {
  const foodNeed = clamp01(agent.needs.hunger + (agent.ageStage === "Infant" || agent.ageStage === "Child" ? 0.12 : 0) - quantityByType(resources, "food") * 0.01);
  const waterNeed = clamp01(agent.needs.thirst + (agent.ageStage === "Infant" || agent.ageStage === "Child" ? 0.1 : 0) - quantityByType(resources, "fresh-water") * 0.01);

  if (waterNeed >= foodNeed && waterNeed > 0.58) {
    return { resourceType: "fresh-water", need: waterNeed };
  }

  if (foodNeed > 0.58) {
    return { resourceType: "food", need: foodNeed };
  }

  return null;
}

function scoreWithdrawal(input: {
  agent: HumanAgent;
  settlement: Settlement;
  resources: readonly StoredResource[];
  relationships: readonly HumanRelationship[];
  weights: ResourceStorageScoringWeights;
}): { score: number; resourceType: string | null; reasons: Record<string, number> } {
  const need = resourceNeed(input.agent, input.resources);
  const familyCare = input.agent.ageStage === "Infant" || input.agent.ageStage === "Child" || input.agent.ageStage === "Elder"
    ? 1
    : input.agent.childIds.length > 0
      ? 0.72
      : 0;
  const reasons = {
    hunger: input.agent.needs.hunger,
    thirst: input.agent.needs.thirst,
    familyCare,
    shelterPreparation: input.agent.currentGoal?.type === "Seek Shelter" ? 1 : 0,
    settlementSupport: homeSettlementScore(input.agent, input.settlement) * trustScore(input.agent, input.relationships),
    available: need ? clamp01(quantityByType(input.resources, need.resourceType) / 3) : 0,
  };
  const score = clamp01(
    reasons.hunger * input.weights.hungerWithdrawal +
    reasons.thirst * input.weights.thirstWithdrawal +
    reasons.familyCare * input.weights.familyCare +
    reasons.shelterPreparation * input.weights.shelterPreparation +
    reasons.settlementSupport * input.weights.settlementSupport,
  );

  return { score, resourceType: need?.resourceType ?? null, reasons };
}

function withdrawResource(
  storage: SettlementStorage,
  resourceType: string,
  quantity: number,
): { storage: SettlementStorage; withdrawn: number } {
  let remaining = quantity;
  let withdrawn = 0;
  const resources = [...storage.resources]
    .sort((left, right) => left.freshness - right.freshness || left.id.localeCompare(right.id))
    .flatMap((resource) => {
      if (resource.type !== resourceType || remaining <= 0) {
        return [resource];
      }

      const taken = Math.min(resource.quantity, remaining);
      remaining = round(remaining - taken, 3);
      withdrawn = round(withdrawn + taken, 3);
      const quantityLeft = round(resource.quantity - taken, 3);

      return quantityLeft <= 0 ? [] : [{ ...resource, quantity: quantityLeft }];
    });

  return { storage: { ...storage, resources }, withdrawn };
}

function eventFor(input: {
  worldId: string;
  tick: bigint;
  settlementId: string;
  cellId: string;
  kind: ResourceStorageEventKind;
  summary: string;
  importance: number;
  humanIds: readonly string[];
  resourceType: string | null;
  quantity: number;
}): ResourceStorageSystemEvent {
  return {
    id: `${input.settlementId}:resource-event:${input.kind.toLowerCase().replaceAll(" ", "-")}:${input.tick.toString()}:${input.resourceType ?? "mixed"}`,
    worldId: input.worldId,
    tick: input.tick.toString(),
    kind: input.kind,
    title: input.kind,
    summary: input.summary,
    importance: input.importance,
    settlementId: input.settlementId,
    cellId: input.cellId,
    humanIds: unique(input.humanIds),
    resourceType: input.resourceType,
    quantity: round(input.quantity, 3),
  };
}

function storageEvents(input: {
  worldId: string;
  tick: bigint;
  settlement: Settlement;
  storage: SettlementStorage;
  previous: SettlementStorage | null;
  deposits: SettlementStorageHistoryEntry[];
  withdrawals: SettlementStorageHistoryEntry[];
  spoiledQuantity: number;
}): ResourceStorageSystemEvent[] {
  const previousFood = input.previous ? quantityByType(input.previous.resources, "food") : 0;
  const previousFirewood = input.previous ? quantityByType(input.previous.resources, "firewood") : 0;
  const food = quantityByType(input.storage.resources, "food");
  const water = quantityByType(input.storage.resources, "fresh-water");
  const firewood = quantityByType(input.storage.resources, "firewood");
  const events: ResourceStorageSystemEvent[] = [];

  if (previousFood <= 0 && food > 0) {
    events.push(eventFor({ worldId: input.worldId, tick: input.tick, settlementId: input.settlement.id, cellId: input.settlement.homeCellId, kind: "First Shared Food Cache", summary: `${input.settlement.name} formed its first shared food cache.`, importance: 0.76, humanIds: input.deposits.map((entry) => entry.humanId ?? ""), resourceType: "food", quantity: food }));
  }

  if (previousFirewood <= 0 && firewood > 0) {
    events.push(eventFor({ worldId: input.worldId, tick: input.tick, settlementId: input.settlement.id, cellId: input.settlement.homeCellId, kind: "First Stored Firewood", summary: `${input.settlement.name} stored firewood for shared use.`, importance: 0.62, humanIds: input.deposits.map((entry) => entry.humanId ?? ""), resourceType: "firewood", quantity: firewood }));
  }

  if (food >= Math.max(4, input.settlement.currentPopulation * 1.5) && previousFood < food) {
    events.push(eventFor({ worldId: input.worldId, tick: input.tick, settlementId: input.settlement.id, cellId: input.settlement.homeCellId, kind: "Food Surplus", summary: `${input.settlement.name} has more stored food than immediate needs.`, importance: 0.48, humanIds: input.settlement.founderIds, resourceType: "food", quantity: food }));
  }

  if (food <= 0.25 && water <= 0.25 && input.settlement.currentPopulation > 0) {
    events.push(eventFor({ worldId: input.worldId, tick: input.tick, settlementId: input.settlement.id, cellId: input.settlement.homeCellId, kind: "Resource Crisis", summary: `${input.settlement.name} has almost no stored food or water.`, importance: 0.82, humanIds: input.settlement.founderIds, resourceType: null, quantity: food + water }));
  } else if (food <= input.settlement.currentPopulation * 0.25 && input.settlement.currentPopulation > 0) {
    events.push(eventFor({ worldId: input.worldId, tick: input.tick, settlementId: input.settlement.id, cellId: input.settlement.homeCellId, kind: "Food Shortage", summary: `${input.settlement.name} has a low shared food cache.`, importance: 0.68, humanIds: input.settlement.founderIds, resourceType: "food", quantity: food }));
  }

  if (input.spoiledQuantity > 0.05) {
    events.push(eventFor({ worldId: input.worldId, tick: input.tick, settlementId: input.settlement.id, cellId: input.settlement.homeCellId, kind: "Resource Spoilage", summary: `${input.settlement.name} lost stored supplies to spoilage.`, importance: 0.52, humanIds: [], resourceType: null, quantity: input.spoiledQuantity }));
  }

  const largestDeposit = [...input.deposits].sort((left, right) => right.quantity - left.quantity || (left.humanId ?? "").localeCompare(right.humanId ?? ""))[0];

  if (largestDeposit && largestDeposit.quantity >= 2) {
    events.push(eventFor({ worldId: input.worldId, tick: input.tick, settlementId: input.settlement.id, cellId: input.settlement.homeCellId, kind: "Largest Community Contribution", summary: `${largestDeposit.humanId ?? "A citizen"} made a large shared contribution.`, importance: 0.58, humanIds: largestDeposit.humanId ? [largestDeposit.humanId] : [], resourceType: largestDeposit.resourceType, quantity: largestDeposit.quantity }));
  }

  return events.sort((left, right) => left.id.localeCompare(right.id));
}

function applyDeposits(input: {
  worldId: string;
  tick: bigint;
  settlement: Settlement;
  storage: SettlementStorage;
  agents: readonly HumanAgent[];
  relationships: readonly HumanRelationship[];
  weights: ResourceStorageScoringWeights;
  ordinalOffset: number;
}): { storage: SettlementStorage; deposits: SettlementStorageHistoryEntry[]; scoring: ResourceStorageResult["scoring"] } {
  let storage = input.storage;
  let ordinal = input.ordinalOffset;
  const deposits: SettlementStorageHistoryEntry[] = [];
  const scoring: ResourceStorageResult["scoring"] = [];

  for (const agent of residentAgents(input.settlement, input.agents)) {
    const depositScore = scoreDeposit({ agent, settlement: input.settlement, agents: input.agents, relationships: input.relationships, storage, weights: input.weights });
    const withdrawalScore = scoreWithdrawal({ agent, settlement: input.settlement, resources: storage.resources, relationships: input.relationships, weights: input.weights });

    scoring.push({
      humanId: agent.id,
      settlementId: input.settlement.id,
      depositScore: depositScore.score,
      withdrawalScore: withdrawalScore.score,
      reasons: { ...depositScore.reasons, withdrawalNeed: withdrawalScore.score },
    });

    if (depositScore.score < input.weights.depositThreshold || availableCapacity(storage) <= 0.1) {
      continue;
    }

    for (const deposit of chooseDepositResources(agent)) {
      const capacity = availableCapacity(storage);
      if (capacity <= 0.1) break;
      const acceptedQuantity = Math.min(deposit.quantity, capacity / typeDefinition(deposit.resourceType).storageDensity);
      if (acceptedQuantity <= 0.05) continue;
      ordinal += 1;
      const resource = createResource({
        settlement: input.settlement,
        resourceType: deposit.resourceType,
        quantity: acceptedQuantity,
        quality: deposit.quality,
        freshness: deposit.freshness,
        tick: input.tick,
        producerHumanId: agent.id,
        reservedFor: agent.childIds.length > 0 ? "children" : null,
        ordinal,
      });
      const entry = historyEntry({
        tick: input.tick,
        type: "Deposit",
        resourceType: deposit.resourceType,
        quantity: acceptedQuantity,
        humanId: agent.id,
        summary: `${agent.id} contributed ${typeDefinition(deposit.resourceType).label} to shared storage.`,
      });

      storage = {
        ...storage,
        resources: [...storage.resources, resource],
        lastUpdatedTick: input.tick.toString(),
        history: [...storage.history, entry].slice(-RESOURCE_HISTORY_LIMIT),
      };
      deposits.push(entry);
    }
  }

  return { storage, deposits, scoring };
}

function applyWithdrawals(input: {
  tick: bigint;
  settlement: Settlement;
  storage: SettlementStorage;
  agents: readonly HumanAgent[];
  relationships: readonly HumanRelationship[];
  weights: ResourceStorageScoringWeights;
}): { storage: SettlementStorage; withdrawals: SettlementStorageHistoryEntry[]; scoring: ResourceStorageResult["scoring"] } {
  let storage = input.storage;
  const withdrawals: SettlementStorageHistoryEntry[] = [];
  const scoring: ResourceStorageResult["scoring"] = [];
  const agents = residentAgents(input.settlement, input.agents).sort((left, right) => {
    const leftPriority = left.ageStage === "Infant" || left.ageStage === "Child" ? 2 : left.ageStage === "Elder" ? 1 : 0;
    const rightPriority = right.ageStage === "Infant" || right.ageStage === "Child" ? 2 : right.ageStage === "Elder" ? 1 : 0;

    return rightPriority - leftPriority || Math.max(right.needs.hunger, right.needs.thirst) - Math.max(left.needs.hunger, left.needs.thirst) || left.id.localeCompare(right.id);
  });

  for (const agent of agents) {
    const withdrawalScore = scoreWithdrawal({ agent, settlement: input.settlement, resources: storage.resources, relationships: input.relationships, weights: input.weights });

    scoring.push({
      humanId: agent.id,
      settlementId: input.settlement.id,
      depositScore: 0,
      withdrawalScore: withdrawalScore.score,
      reasons: withdrawalScore.reasons,
    });

    if (!withdrawalScore.resourceType || withdrawalScore.score < input.weights.withdrawalThreshold) {
      continue;
    }

    const quantity = withdrawalScore.resourceType === "fresh-water" ? 0.7 : 0.8;
    const result = withdrawResource(storage, withdrawalScore.resourceType, quantity);

    if (result.withdrawn <= 0) {
      continue;
    }

    const entry = historyEntry({
      tick: input.tick,
      type: "Withdrawal",
      resourceType: withdrawalScore.resourceType,
      quantity: result.withdrawn,
      humanId: agent.id,
      summary: `${agent.id} drew ${typeDefinition(withdrawalScore.resourceType).label} from shared storage.`,
    });

    storage = {
      ...result.storage,
      lastUpdatedTick: input.tick.toString(),
      history: [...result.storage.history, entry].slice(-RESOURCE_HISTORY_LIMIT),
    };
    withdrawals.push(entry);
  }

  return { storage, withdrawals, scoring };
}

function previousStorageFor(settlement: Settlement, previous: ResourceStorageResult | null): SettlementStorage | null {
  return previous?.storages.find((storage) => storage.settlementId === settlement.id) ?? null;
}

function buildSummary(storage: SettlementStorage, previous: SettlementStorage | null, settlement: Settlement): SettlementResourceSummary {
  const contributorTotals = new Map<string, number>();
  for (const entry of storage.history.filter((item) => item.type === "Deposit" && item.humanId)) {
    contributorTotals.set(entry.humanId!, round((contributorTotals.get(entry.humanId!) ?? 0) + entry.quantity, 3));
  }
  const resources = getResourceTypes().map((definition) => {
    const quantity = quantityByType(storage.resources, definition.id);
    const previousQuantity = previous ? quantityByType(previous.resources, definition.id) : 0;
    return { type: definition.id, quantity, delta: round(quantity - previousQuantity, 3) };
  }).filter((entry) => entry.quantity > 0 || entry.delta !== 0);
  const foodSupply = quantityByType(storage.resources, "food");
  const waterSupply = quantityByType(storage.resources, "fresh-water");
  const firewood = quantityByType(storage.resources, "firewood");
  const constructionMaterials = round(quantityByType(storage.resources, "construction-materials") + quantityByType(storage.resources, "wood") + quantityByType(storage.resources, "stone"));
  const needed = [
    foodSupply < Math.max(1, settlement.currentPopulation * 0.75) ? "food" : "",
    waterSupply < Math.max(1, settlement.currentPopulation * 0.75) ? "fresh-water" : "",
    firewood < 1 ? "firewood" : "",
    constructionMaterials < 1 && settlement.permanence > 0.45 ? "construction-materials" : "",
  ];

  return {
    settlementId: settlement.id,
    storageId: storage.id,
    totalQuantity: round(storage.resources.reduce((sum, resource) => sum + resource.quantity, 0)),
    capacity: storage.capacity,
    capacityUsed: clamp01(storageUsed(storage.resources) / Math.max(1, storage.capacity)),
    foodSupply,
    waterSupply,
    firewood,
    constructionMaterials,
    spoilage: round(storage.history.filter((entry) => entry.type === "Spoilage").reduce((sum, entry) => sum + entry.quantity, 0)),
    dailyConsumption: round(storage.history.filter((entry) => entry.type === "Withdrawal").reduce((sum, entry) => sum + entry.quantity, 0)),
    largestContributors: [...contributorTotals.entries()]
      .map(([humanId, quantity]) => ({ humanId, quantity }))
      .sort((left, right) => right.quantity - left.quantity || left.humanId.localeCompare(right.humanId))
      .slice(0, 5),
    mostNeededResources: unique(needed),
    resourceTrends: resources,
  };
}

function buildHumanInventories(input: {
  agents: readonly HumanAgent[];
  settlements: readonly Settlement[];
  storages: readonly SettlementStorage[];
}): HumanInventorySummary[] {
  return input.agents.map((agent) => {
    const settlement = input.settlements.find((candidate) =>
      candidate.occupiedCells.includes(agent.currentCellId) ||
      candidate.occupiedCells.includes(agent.homeCellId) ||
      candidate.occupiedCells.includes(agent.homeProfile?.primaryHomeCellId ?? "")
    ) ?? null;
    const storage = settlement ? input.storages.find((entry) => entry.settlementId === settlement.id) ?? null : null;
    const personalInventory = chooseDepositResources(agent).map((resource, index) => createResource({
      settlement: settlement ?? {
        id: `${agent.worldId}:personal:${agent.id}`,
        homeCellId: agent.currentCellId,
      } as Settlement,
      resourceType: resource.resourceType,
      quantity: resource.quantity,
      quality: resource.quality,
      freshness: resource.freshness,
      tick: BigInt(agent.lastDecision?.scoredAtTick ?? "0"),
      producerHumanId: agent.id,
      ordinal: index,
    })).map((resource) => ({ ...resource, settlementId: null }));
    const familyInventory = storage?.resources.filter((resource) => resource.producerHumanId && input.agents.some((candidate) => candidate.id === resource.producerHumanId && candidate.familyId === agent.familyId)) ?? [];
    const history = storage?.history ?? [];

    return {
      humanId: agent.id,
      familyId: agent.familyId,
      settlementId: settlement?.id ?? null,
      personalInventory,
      familyInventory,
      recentDeposits: history.filter((entry) => entry.type === "Deposit" && entry.humanId === agent.id).slice(-HUMAN_HISTORY_LIMIT),
      recentWithdrawals: history.filter((entry) => entry.type === "Withdrawal" && entry.humanId === agent.id).slice(-HUMAN_HISTORY_LIMIT),
      contributionHistory: history.filter((entry) => entry.humanId === agent.id).slice(-HUMAN_HISTORY_LIMIT),
    };
  }).sort((left, right) => left.humanId.localeCompare(right.humanId));
}

export function getResourceStorageStateFromHumanState(input: {
  worldId: string;
  tick: bigint;
  state: HumanMvaState;
  settlements: SettlementTickResult;
  previousStorage?: ResourceStorageResult | null;
  weights?: ResourceStorageScoringWeights;
}): ResourceStorageResult {
  const weights = input.weights ?? DEFAULT_RESOURCE_STORAGE_SCORING;
  const storages: SettlementStorage[] = [];
  const summaries: SettlementResourceSummary[] = [];
  const events: ResourceStorageSystemEvent[] = [];
  const scoring: ResourceStorageResult["scoring"] = [];
  const activeSettlements = input.settlements.settlements.filter((settlement) => settlement.status !== "abandoned");

  for (const settlement of activeSettlements) {
    const previous = previousStorageFor(settlement, input.previousStorage ?? null);
    const baseStorage = previous
      ? {
        ...previous,
        capacity: round(18 + settlement.currentPopulation * 5 + settlement.permanence * 36),
        preservationQuality: preservationQuality(settlement, input.state.knowledge),
        accessibility: clamp01(0.48 + settlement.importance * 0.24 + settlement.permanence * 0.18),
        lastUpdatedTick: input.tick.toString(),
      }
      : createStorage(settlement, input.tick, input.state.knowledge);
    const spoiled = applySpoilage(baseStorage, input.tick);
    const withdrawal = applyWithdrawals({
      tick: input.tick,
      settlement,
      storage: spoiled.storage,
      agents: input.state.agents,
      relationships: input.state.relationships,
      weights,
    });
    const deposit = applyDeposits({
      worldId: input.worldId,
      tick: input.tick,
      settlement,
      storage: withdrawal.storage,
      agents: input.state.agents,
      relationships: input.state.relationships,
      weights,
      ordinalOffset: withdrawal.storage.resources.length,
    });
    const storage = {
      ...deposit.storage,
      spoilageRate: round(1 - deposit.storage.preservationQuality),
    };

    storages.push(storage);
    summaries.push(buildSummary(storage, previous, settlement));
    events.push(...storageEvents({
      worldId: input.worldId,
      tick: input.tick,
      settlement,
      storage,
      previous,
      deposits: deposit.deposits,
      withdrawals: withdrawal.withdrawals,
      spoiledQuantity: spoiled.spoiledQuantity,
    }));
    scoring.push(...deposit.scoring, ...withdrawal.scoring);
  }

  return {
    worldId: input.worldId,
    tick: input.tick.toString(),
    storages: storages.sort((left, right) => left.settlementId.localeCompare(right.settlementId)),
    settlementSummaries: summaries.sort((left, right) => left.settlementId.localeCompare(right.settlementId)),
    humanInventories: buildHumanInventories({ agents: input.state.agents, settlements: activeSettlements, storages }),
    events: events.sort((left, right) => left.id.localeCompare(right.id)),
    scoring: scoring.sort((left, right) => right.depositScore - left.depositScore || right.withdrawalScore - left.withdrawalScore || left.humanId.localeCompare(right.humanId)).slice(0, 48),
  };
}

export function getResourceStorageStateAtTick(input: {
  world: { id: string; seed?: string | null };
  tick: bigint;
  humanResult?: HumanTickResult | null;
  settlementResult?: SettlementTickResult | null;
  weights?: ResourceStorageScoringWeights;
}): ResourceStorageResult {
  const humanResult = input.humanResult ?? getHumanMvaStateAtTick(input.world, input.tick);
  const previousHumanResult = input.tick > 0n ? getHumanMvaStateAtTick(input.world, input.tick - 1n) : null;
  const settlementResult = input.settlementResult ?? getSettlementStateAtTick({
    world: input.world,
    tick: input.tick,
    humanResult,
    previousHumanResult,
  });
  const familyResult = getFamilyGenerationsStateFromHumanState({
    worldId: input.world.id,
    tick: input.tick,
    state: humanResult.state,
    previousState: previousHumanResult?.state ?? null,
    settlements: settlementResult,
  });
  const previousStorage = input.tick > 0n
    ? getResourceStorageStateAtTick({ world: input.world, tick: input.tick - 1n, weights: input.weights })
    : null;

  return getResourceStorageStateFromHumanState({
    worldId: input.world.id,
    tick: input.tick,
    state: familyResult.state,
    settlements: settlementResult,
    previousStorage,
    weights: input.weights,
  });
}

export function resourceStorageEventToCausalEvent(event: ResourceStorageSystemEvent): HumanCausalEvent {
  return {
    id: event.id,
    worldId: event.worldId,
    tick: event.tick,
    type: `Resource Storage ${event.kind}`,
    title: event.title,
    summary: event.summary,
    agentIds: event.humanIds,
    cellId: event.cellId,
    causes: {
      settlementId: event.settlementId,
      resourceType: event.resourceType ?? "mixed",
      quantity: event.quantity,
    },
    effects: {
      importance: event.importance,
      storageMilestone: event.kind,
    } as Record<string, Prisma.InputJsonValue>,
    memoryIds: [],
    chroniclerVisible: true,
    agentVisible: true,
  };
}

export function resourceStorageEventsForMemories(events: readonly ResourceStorageSystemEvent[]): HumanMemory[] {
  return events.flatMap((event) =>
    event.humanIds.map((humanId) => ({
      id: `${humanId}:resource-memory:${event.kind.toLowerCase().replaceAll(" ", "-")}:${event.tick}`,
      worldId: event.worldId,
      agentId: humanId,
      type: event.kind,
      category: "Resource Storage Memory",
      subjectId: event.settlementId,
      locationCellId: event.cellId,
      createdTick: event.tick,
      lastRecalledTick: event.tick,
      importance: clamp01(event.importance),
      emotionalWeight: clamp01(event.importance),
      source: "resource-storage-engine",
      relatedEntityId: event.settlementId,
      relatedHumanId: null,
      tags: unique(["storage", event.resourceType ?? "", event.kind.toLowerCase().replaceAll(" ", "-")]),
      notes: event.summary,
      recallCount: 1,
      exposureCount: 1,
      tick: event.tick,
      cellId: event.cellId,
      participants: event.humanIds,
      eventType: event.kind,
      summary: event.summary,
      emotionAtEncoding: {
        fear: 0,
        distress: 0,
        comfort: 0.5,
        curiosity: 0.5,
        trust: 0.5,
        attachment: 0.5,
        loneliness: 0,
        relief: 0.5,
      },
      needContext: {
        hunger: 0,
        thirst: 0,
        fatigue: 0,
        safety: 0,
        social: 0,
      },
      salience: clamp01(event.importance),
      confidence: 0.9,
      valence: event.kind.includes("Shortage") || event.kind.includes("Crisis") || event.kind.includes("Spoilage") ? 0.18 : 0.78,
      sourceEventId: event.id,
      causalLinks: ["storage", "settlement"],
    }))
  );
}
