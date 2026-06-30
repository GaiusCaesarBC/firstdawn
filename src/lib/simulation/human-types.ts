import type { Prisma } from "@prisma/client";

export const HUMAN_SYSTEM_ID = "humans";
export const HUMAN_MVA_DAY_TICKS = 24;
export const HUMAN_ADULT_AGE_YEARS = 18;
export const FIRST_HUMAN_AGE_YEARS = 20;
export const FIRST_HUMAN_START_CELL_ID = "cell-09-18";

export type HumanSex = "male" | "female";

export type HumanNeedKey = "hunger" | "thirst" | "fatigue" | "safety" | "social";

export type HumanNeeds = Record<HumanNeedKey, number>;

export type HumanEmotionState = {
  fear: number;
  distress: number;
  comfort: number;
  curiosity: number; // Aggregate curiosity for legacy displays; derived from profile
  trust: number;
  attachment: number;
  loneliness: number;
  relief: number;
};

// Curiosity dimensions influence motivations and utility scoring
export type HumanCuriosityProfile = {
  environmental: number; // interest in surroundings/landforms/weather
  social: number; // interest in people and their behavior
  technical: number; // interest in techniques, tools, shelters
  noveltySeeking: number; // drive to try new things
  riskTolerance: number; // willingness to accept uncertainty for information
};

export type HumanMotivationKey =
  | "explore"
  | "learn"
  | "socialize"
  | "restVoluntary"
  | "improveShelter"
  | "observeSurroundings"
  | "practiceSkills"
  | "teach"
  | "collectObjects";

export type HumanMotivations = Record<HumanMotivationKey, number>;

export type HumanGoal = {
  id: string;
  text: string;
  createdTick: string;
  expiresTick: string;
};

export type HumanPersonality = {
  boldness: number;
  sociability: number;
  curiosity: number;
  patience: number;
  empathy: number;
  riskTolerance: number;
  teachAffinity: number;
};

export type HumanBelief = {
  claim: string;
  confidence: number;
  valence: number;
  lastUpdatedTick: string;
};

export type HumanBeliefDictionary = Record<string, HumanBelief>;

export type HumanTheoryOfMindEstimate = {
  targetAgentId: string;
  believedNeeds: HumanNeeds;
  believedEmotion: Pick<HumanEmotionState, "fear" | "comfort" | "loneliness" | "trust">;
  believedIntent: HumanActionType | "unknown";
  confidence: number;
  lastUpdatedTick: string;
};

export type HumanAgent = {
  id: string;
  worldId: string;
  sex: HumanSex;
  isAlive: boolean;
  birthTick: string;
  ageDays: number;
  approxAgeYears: number;
  currentCellId: string;
  homeCellId: string;
  motherId: string | null;
  fatherId: string | null;
  generation: number;
  needs: HumanNeeds;
  emotions: HumanEmotionState;
  curiosityProfile: HumanCuriosityProfile;
  motivations: HumanMotivations;
  confidence: number; // grows with repeated safe success, reduces fear
  familiarityByCell: Record<string, number>; // situational familiarity
  safetyStreak: number; // consecutive safe ticks
  currentGoal: HumanGoal | null;
  personality: HumanPersonality;
  beliefs: HumanBeliefDictionary;
  theoryOfMind: Record<string, HumanTheoryOfMindEstimate>;
  lastDecision: HumanDecision | null;
};

export type HumanRelationship = {
  worldId: string;
  fromAgentId: string;
  toAgentId: string;
  kinship: "none" | "parent" | "child" | "sibling" | "partner";
  familiarity: number;
  trust: number;
  affection: number;
  fear: number;
  resentment: number;
  dependency: number;
  attraction: number;
  companionship: number;
  lastInteractionTick: string | null;
};

export type HumanMemory = {
  id: string;
  worldId: string;
  agentId: string;
  tick: string;
  cellId: string;
  participants: string[];
  eventType: string;
  summary: string;
  emotionAtEncoding: HumanEmotionState;
  needContext: HumanNeeds;
  salience: number;
  confidence: number;
  valence: number;
  sourceEventId: string;
  causalLinks: string[];
};

export type HumanCommunicationRecord = {
  id: string;
  worldId: string;
  tick: string;
  speakerAgentId: string;
  listenerAgentIds: string[];
  cellId: string;
  intent: "greet" | "requestHelp" | "offerHelp" | "warn" | "teach";
  topic: string;
  utteranceMeaning: string;
  emotionalTone: "calm" | "warm" | "urgent" | "distressed";
  understandingScore: number;
};

export type HumanTeachingRecord = {
  id: string;
  worldId: string;
  tick: string;
  teacherAgentId: string;
  learnerAgentId: string;
  topic: string;
  targetBelief: string;
  method: "spoken" | "demonstration";
  learnerAttention: number;
  successScore: number;
};

export type HumanCausalEvent = {
  id: string;
  worldId: string;
  tick: string;
  type: string;
  title: string;
  summary: string;
  agentIds: string[];
  cellId: string;
  causes: Record<string, Prisma.InputJsonValue>;
  effects: Record<string, Prisma.InputJsonValue>;
  memoryIds: string[];
  chroniclerVisible: true;
  agentVisible: boolean;
};

export type ChroniclerEntry = {
  eventId: string;
  tick: string;
  title: string;
  summary: string;
  causalSummary: string;
};

export type ChroniclerReport = {
  worldId: string;
  observedEventCount: number;
  entries: ChroniclerEntry[];
};

export type HumanActionType =
  | "rest"
  | "drink"
  | "eat"
  | "seekSafety"
  | "communicate"
  | "teach"
  | "court"
  | "observeHuman"
  | "observeEnvironment"
  | "explore"
  | "collectObject"
  | "practiceSkill";

export type HumanActionCandidate = {
  type: HumanActionType;
  targetAgentId?: string;
  expectedUtility: number;
  causes: Record<string, Prisma.InputJsonValue>;
};

export type HumanDecision = {
  action: HumanActionType;
  targetAgentId: string | null;
  utility: number;
  scoredAtTick: string;
  causes: Record<string, Prisma.InputJsonValue>;
};

export type HumanReproductionEligibility = {
  allowed: boolean;
  reasons: string[];
};

export type HumanMvaState = {
  worldId: string;
  tick: string;
  agents: HumanAgent[];
  relationships: HumanRelationship[];
  memories: HumanMemory[];
  communications: HumanCommunicationRecord[];
  teachingAttempts: HumanTeachingRecord[];
  causalEvents: HumanCausalEvent[];
};

export type HumanTickResult = {
  state: HumanMvaState;
  newEvents: HumanCausalEvent[];
  chroniclerReport: ChroniclerReport;
};
