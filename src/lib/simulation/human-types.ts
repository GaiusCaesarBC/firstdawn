import type { Prisma } from "@prisma/client";

export const HUMAN_SYSTEM_ID = "humans";
export const HUMAN_MVA_DAY_TICKS = 24;
export const HUMAN_ADULT_AGE_YEARS = 18;
export const FIRST_HUMAN_AGE_YEARS = 20;
export const FIRST_HUMAN_START_CELL_ID = "cell-09-18";

export type HumanSex = "male" | "female";

export type HumanAgeStage = "Infant" | "Child" | "Adolescent" | "Adult" | "Elder";

export type HumanSkinTone =
  | "deep-brown"
  | "brown"
  | "medium-brown"
  | "olive"
  | "tan"
  | "fair";

export type HumanHairColor =
  | "black"
  | "dark-brown"
  | "brown"
  | "auburn"
  | "sandy"
  | "gray";

export type HumanHairStyle =
  | "short"
  | "cropped"
  | "shoulder"
  | "long"
  | "braided"
  | "wrapped";

export type HumanFacialHair =
  | "none"
  | "stubble"
  | "short-beard"
  | "full-beard";

export type HumanBodyBuild =
  | "slender"
  | "average"
  | "sturdy"
  | "broad";

export type HumanFaceShape =
  | "oval"
  | "round"
  | "long"
  | "square";

export type HumanBodyHeight =
  | "short"
  | "average"
  | "tall";

export type HumanShoulderWidth =
  | "narrow"
  | "average"
  | "wide";

export type HumanClothingStyle =
  | "simple-tunic"
  | "woven-dress"
  | "tunic-trousers"
  | "wrapped-robe"
  | "belted-wrap";

export type HumanSleeveLength =
  | "short"
  | "elbow"
  | "long";

export type HumanTrouserStyle =
  | "none"
  | "straight"
  | "wrapped"
  | "loose";

export type HumanFootwearStyle =
  | "bare"
  | "primitive-shoes"
  | "leg-wraps";

export type HumanPosture =
  | "upright"
  | "relaxed"
  | "stooped";

export type HumanClothingColor =
  | "cream"
  | "tan"
  | "brown"
  | "gray"
  | "faded-green"
  | "muted-blue";

export type HumanEyeColor =
  | "dark-brown"
  | "brown"
  | "hazel"
  | "gray"
  | "blue";

export type HumanAppearance = {
  version: 2;
  seed: string;
  skinTone: HumanSkinTone;
  hairColor: HumanHairColor;
  hairStyle: HumanHairStyle;
  facialHair: HumanFacialHair;
  faceShape: HumanFaceShape;
  bodyBuild: HumanBodyBuild;
  bodyHeight: HumanBodyHeight;
  shoulderWidth: HumanShoulderWidth;
  clothingStyle: HumanClothingStyle;
  clothingColor: HumanClothingColor;
  accentColor: HumanClothingColor;
  sleeveLength: HumanSleeveLength;
  trouserStyle: HumanTrouserStyle;
  beltColor: HumanClothingColor;
  footwearStyle: HumanFootwearStyle;
  posture: HumanPosture;
  eyeColor: HumanEyeColor;
};

export type HumanFamilyHistoryEntry = {
  tick: string;
  type: string;
  summary: string;
  relatedHumanIds: string[];
  settlementId: string | null;
};

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

export type HumanGoalType =
  | "Find Food"
  | "Find Water"
  | "Rest"
  | "Return Home"
  | "Gather Near Camp"
  | "Defend Camp"
  | "Seek Shelter"
  | "Wander"
  | "Explore"
  | "Socialize"
  | "Observe"
  | "Stay Near Family"
  | "Help Other"
  | "Learn"
  | "Follow"
  | "Seek Safety"
  | "Escape";

export type HumanGoalStatus =
  | "Pending"
  | "Active"
  | "Completed"
  | "Failed"
  | "Interrupted";

export type HumanGoalReason =
  | "Hungry"
  | "Thirst"
  | "Tired"
  | "Cold"
  | "Danger Nearby"
  | "Following Parent"
  | "Asked For Help"
  | "Asked To Follow"
  | "Asked To Learn"
  | "Searching For Shelter"
  | "Curiosity"
  | "Lonely"
  | "Staying Oriented"
  | "Returning Home"
  | "Camp Comfort"
  | "Camp Threatened"
  | "Low Pressure"
  | "Existing Goal Still Valid";

export type HumanGoal = {
  id: string;
  type: HumanGoalType;
  priority: number;
  createdTick: string;
  targetId: string | null;
  targetCellId: string | null;
  progress: number;
  confidence: number;
  reason: HumanGoalReason;
  status: HumanGoalStatus;
};

export type HumanMovementIntent =
  | "seek-food"
  | "seek-water"
  | "explore"
  | "avoid-danger"
  | "return-safe"
  | "follow-trusted"
  | "avoid-threat"
  | "seek-shelter"
  | "wander"
  | "stay-near-home"
  | "rest"
  | "stay";
export type HumanGoalHistoryEntry = {
  goal: HumanGoal;
  tick: string;
  event: "Started" | "Completed" | "Failed" | "Interrupted" | "Changed";
  reason: HumanGoalReason;
  previousGoalId: string | null;
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
  appearance: HumanAppearance;
  isAlive: boolean;
  birthTick: string;
  ageDays: number;
  approxAgeYears: number;

  currentCellId: string;
  previousCellId: string | null;
  destinationCellId: string | null;

  movementIntent: HumanMovementIntent;
  movementReason: string;
  lastMovedTick: string | null;

  recentPath: string[];
  stuckTicks: number;
  distanceTraveled: number;
  explorationCount: number;

  homeCellId: string;
  homeProfile: HumanHomeProfile;

  motherId: string | null;
  fatherId: string | null;
  generation: number;

  biologicalParentIds: string[];
  guardianIds: string[];
  childIds: string[];
  siblingIds: string[];

  mateId: string | null;
  familyId: string | null;
  lineageId: string | null;

  ageStage: HumanAgeStage;

  birthplaceCellId: string;
  birthplaceSettlementId: string | null;

  inheritedHomeCellId: string | null;
  inheritedSettlementId: string | null;

  ancestryTags: string[];
  familyHistory: HumanFamilyHistoryEntry[];

  needs: HumanNeeds;
  emotions: HumanEmotionState;

  reproductiveState?: {
    lastReproductionTick: string | null;
    fertility: number;
    pregnancyProgress: number;
    partnerId: string | null;
  };

  curiosityProfile: HumanCuriosityProfile;
  motivations: HumanMotivations;

  confidence: number;
  familiarityByCell: Record<string, number>;
  safetyStreak: number;

  currentGoal: HumanGoal | null;
  goalHistory: HumanGoalHistoryEntry[];

  personality: HumanPersonality;
  beliefs: HumanBeliefDictionary;
  theoryOfMind: Record<string, HumanTheoryOfMindEstimate>;

  lastDecision: HumanDecision | null;
};

export type HumanHomeProfile = {
  primaryHomeCellId: string;
  secondaryHomeCellIds: string[];
  preferredSleepingCellId: string;
  knownSafeCellIds: string[];
  favoriteGatheringCellIds: string[];
  birthplaceCellId: string;
  cellAffinities: Record<string, number>;
  lastUpdatedTick: string;
};

export type HumanRelationshipStatus =
  | "Unknown"
  | "Familiar"
  | "Friend"
  | "Family"
  | "Rival"
  | "Threat"
  | "Mentor"
  | "Dependent"
  | "Mate";

export type HumanRelationshipHistoryEntry = {
  tick: string;
  event: string;
  summary: string;
  deltas: Partial<Record<"familiarity" | "trust" | "affection" | "fear" | "respect" | "rivalry" | "dependency" | "grief" | "socialMemoryScore", number>>;
  sourceEventId: string | null;
};

export type HumanRelationship = {
  worldId: string;
  humanId: string;
  targetHumanId: string;
  fromAgentId: string;
  toAgentId: string;
  createdTick: string;
  kinship: "none" | "parent" | "child" | "sibling" | "partner";
  familiarity: number;
  trust: number;
  affection: number;
  fear: number;
  respect: number;
  rivalry: number;
  resentment: number;
  dependency: number;
  grief: number;
  attraction: number;
  companionship: number;
  socialMemoryScore: number;
  status: HumanRelationshipStatus;
  tags: string[];
  history: HumanRelationshipHistoryEntry[];
  lastInteractionTick: string | null;
};

export type HumanRelationshipSystemEvent = {
  id: string;
  worldId: string;
  tick: string;
  humanId: string;
  targetHumanId: string;
  kind:
    | "relationship formed"
    | "trust increased"
    | "fear increased"
    | "rivalry increased"
    | "friendship formed"
    | "family bond recognized"
    | "relationship decayed"
    | "relationship status changed";
  previousStatus: HumanRelationshipStatus | null;
  status: HumanRelationshipStatus;
  summary: string;
  score: number;
  sourceEventId: string | null;
};

export type HumanKnowledgeSourceType =
  | "personal-discovery"
  | "observation"
  | "teaching"
  | "trial-and-error"
  | "repeated-experience"
  | "inherited-family-teaching"
  | string;

export type HumanKnowledgeHistoryEntry = {
  tick: string;
  event: "discovered" | "learned" | "practiced" | "taught" | "reinforced" | "weakened" | "forgotten" | "conflict-shifted";
  summary: string;
  confidence: number;
  mastery: number;
  sourceHumanId: string | null;
  sourceEventId: string | null;
};

export type HumanKnowledge = {
  id: string;
  worldId: string;
  agentId: string;
  topic: string;
  category: string;
  discoveredTick: string;
  learnedTick: string;
  sourceType: HumanKnowledgeSourceType;
  sourceHumanId: string | null;
  originatingHumanId: string;
  confidence: number;
  mastery: number;
  reliability: number;
  practiceCount: number;
  teachingCount: number;
  learnerHumanIds: string[];
  lastUsedTick: string | null;
  lastTaughtTick: string | null;
  importance: number;
  isForgotten: boolean;
  contradicts: string[];
  tags: string[];
  history: HumanKnowledgeHistoryEntry[];
};

export type HumanKnowledgeSystemEvent = {
  id: string;
  worldId: string;
  tick: string;
  humanId: string;
  targetHumanId: string | null;
  knowledgeId: string;
  topic: string;
  category: string;
  kind:
    | "new discovery"
    | "knowledge learned"
    | "knowledge forgotten"
    | "knowledge taught"
    | "major invention"
    | "first teacher"
    | "first student"
    | "knowledge spread milestone";
  summary: string;
  confidence: number;
  mastery: number;
  importance: number;
  sourceEventId: string | null;
};

export type HumanMemory = {
  id: string;
  worldId: string;
  agentId: string;
  type: string;
  category: string;
  subjectId: string;
  locationCellId: string;
  createdTick: string;
  lastRecalledTick: string;
  importance: number;
  emotionalWeight: number;
  source: string;
  relatedEntityId: string | null;
  relatedHumanId: string | null;
  tags: string[];
  notes: string;
  recallCount: number;
  exposureCount: number;
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

export type HumanMemorySystemEvent = {
  id: string;
  worldId: string;
  tick: string;
  agentId: string;
  memoryId: string;
  memoryType: string;
  kind: "formed" | "reinforced" | "faded";
  title: string;
  summary: string;
  importance: number;
  confidence: number;
  locationCellId: string;
};

export type HumanCommunicationRecord = {
  id: string;
  worldId: string;
  tick: string;
  senderHumanId: string;
  receiverHumanIds: string[];
  type: string;
  topic: string;
  createdTick: string;
  locationCellId: string;
  urgency: number;
  clarity: number;
  confidence: number;
  emotionalWeight: number;
  communicationMethod: string;
  understood: boolean;
  accepted: boolean;
  tags: string[];
  history: HumanCommunicationHistoryEntry[];
  receptions: HumanCommunicationReception[];
  speakerAgentId: string;
  listenerAgentIds: string[];
  cellId: string;
  intent: "greet" | "requestHelp" | "offerHelp" | "warn" | "teach";
  utteranceMeaning: string;
  emotionalTone: "calm" | "warm" | "urgent" | "distressed";
  understandingScore: number;
};

export type HumanCommunicationHistoryEntry = {
  tick: string;
  event: string;
  summary: string;
  receiverHumanId: string | null;
  understandingScore: number;
  acceptanceScore: number;
};

export type HumanCommunicationReception = {
  receiverHumanId: string;
  understood: boolean;
  accepted: boolean;
  misunderstood: boolean;
  ignored: boolean;
  rejected: boolean;
  storedForLater: boolean;
  understandingScore: number;
  acceptanceScore: number;
  relationshipTrust: number;
  distanceScore: number;
  attentionScore: number;
  stressPenalty: number;
  goalAlignment: number;
  outcome: "accepted" | "rejected" | "ignored" | "misunderstood" | "stored-for-later";
};

export type HumanCommunicationSystemEvent = {
  id: string;
  worldId: string;
  tick: string;
  communicationId: string;
  senderHumanId: string;
  receiverHumanIds: string[];
  kind:
    | "communication created"
    | "communication accepted"
    | "communication rejected"
    | "communication ignored"
    | "communication misunderstood"
    | "first warning"
    | "first teaching event"
    | "first help request"
    | "first successful group coordination"
    | "knowledge transmission event";
  type: string;
  topic: string;
  summary: string;
  successRate: number;
  importance: number;
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
  knowledge: HumanKnowledge[];
  memories: HumanMemory[];
  communications: HumanCommunicationRecord[];
  teachingAttempts: HumanTeachingRecord[];
  causalEvents: HumanCausalEvent[];
};

export type HumanTickResult = {
  state: HumanMvaState;
  newEvents: HumanCausalEvent[];
  memoryEvents: HumanMemorySystemEvent[];
  relationshipEvents: HumanRelationshipSystemEvent[];
  knowledgeEvents: HumanKnowledgeSystemEvent[];
  communicationEvents: HumanCommunicationSystemEvent[];
  chroniclerReport: ChroniclerReport;
};
