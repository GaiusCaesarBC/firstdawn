import type {
  HumanAgeStage,
  HumanAppearance,
  HumanClothingColor,
  HumanClothingStyle,
  HumanEyeColor,
  HumanFaceShape,
  HumanFacialHair,
  HumanFootwearStyle,
  HumanHairColor,
  HumanHairStyle,
  HumanPosture,
  HumanSex,
  HumanSkinTone,
  HumanTrouserStyle,
} from "./human-types";

export const HUMAN_SPRITE_NATIVE_WIDTH = 48;
export const HUMAN_SPRITE_NATIVE_HEIGHT = 72;
export const HUMAN_MAP_SPRITE_WIDTH = 16;
export const HUMAN_MAP_SPRITE_HEIGHT = 24;

export const HUMAN_SPRITE_LAYER_IDS = [
  "shadow",
  "back-hair",
  "legs",
  "feet",
  "torso-clothing",
  "arms",
  "hands",
  "neck",
  "head-and-face",
  "front-hair",
  "facial-hair",
  "clothing-details",
  "age-details",
] as const;

export const HUMAN_SKIN_COLORS: Record<HumanSkinTone, string> = {
  "deep-brown": "#5b3324",
  brown: "#7a4b33",
  "medium-brown": "#9a6646",
  olive: "#b1835f",
  tan: "#c9956c",
  fair: "#e6c3a1",
};

export const HUMAN_HAIR_COLORS: Record<HumanHairColor, string> = {
  black: "#1f1b18",
  "dark-brown": "#3a241a",
  brown: "#5a3824",
  auburn: "#7a3f28",
  sandy: "#a97e48",
  gray: "#b8b4aa",
};

export const HUMAN_CLOTHING_COLORS: Record<HumanClothingColor, string> = {
  cream: "#d9c99f",
  tan: "#b99768",
  brown: "#76533a",
  gray: "#89877d",
  "faded-green": "#6f7e56",
  "muted-blue": "#586f87",
};

const EYE_COLORS: Record<HumanEyeColor, string> = {
  "dark-brown": "#241610",
  brown: "#3d2417",
  hazel: "#5f4a24",
  gray: "#6c7375",
  blue: "#496a85",
};

const FOOTWEAR_COLOR = "#4b382b";
const OUTLINE = "#17130f";
const SHADOW = "rgba(3, 7, 12, 0.5)";
const AGE_LINE = "#6b6258";

type PixelColor = string | null;

type Landmarks = {
  headX: number;
  headY: number;
  headWidth: number;
  headHeight: number;
  centerX: number;
  shoulderY: number;
  torsoY: number;
  hipY: number;
  footY: number;
  postureShift: number;
  childScale: boolean;
};

export type HumanSpriteInput = {
  id: string;
  sex: HumanSex;
  appearance: HumanAppearance;
  ageStage: HumanAgeStage;
};

export type HumanSpritePixel = {
  x: number;
  y: number;
  color: string;
};

export type HumanSpriteModel = {
  width: number;
  height: number;
  pixels: HumanSpritePixel[];
  layerIds: readonly (typeof HUMAN_SPRITE_LAYER_IDS)[number][];
  nativeResolution: "48x72";
  metadata: {
    effectiveHairColor: string;
    clothingColor: string;
    accentColor: string;
    skinColor: string;
    faceShape: HumanFaceShape;
    bodyBuild: HumanAppearance["bodyBuild"];
    bodyHeight: HumanAppearance["bodyHeight"];
    shoulderWidth: HumanAppearance["shoulderWidth"];
    clothingStyle: HumanClothingStyle;
    sleeveLength: HumanAppearance["sleeveLength"];
    trouserStyle: HumanTrouserStyle;
    footwearStyle: HumanFootwearStyle;
    posture: HumanPosture;
    hasWeaponsOrEquipment: false;
  };
};

type Palette = {
  outline: string;
  skin: string;
  skinLight: string;
  skinShadow: string;
  hair: string;
  hairShadow: string;
  cloth: string;
  clothLight: string;
  clothShadow: string;
  accent: string;
  accentShadow: string;
  belt: string;
  trouser: string;
  trouserShadow: string;
  footwear: string;
  eye: string;
  wrinkle: string;
};

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  return [
    Number.parseInt(clean.slice(0, 2), 16),
    Number.parseInt(clean.slice(2, 4), 16),
    Number.parseInt(clean.slice(4, 6), 16),
  ];
}

function toHex(value: number): string {
  return Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, "0");
}

function mix(hex: string, target: "black" | "white", amount: number): string {
  const [red, green, blue] = hexToRgb(hex);
  const targetValue = target === "white" ? 255 : 0;
  return `#${toHex(red + (targetValue - red) * amount)}${toHex(green + (targetValue - green) * amount)}${toHex(blue + (targetValue - blue) * amount)}`;
}

function createGrid(width = HUMAN_SPRITE_NATIVE_WIDTH, height = HUMAN_SPRITE_NATIVE_HEIGHT): PixelColor[][] {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => null));
}

function setPixel(grid: PixelColor[][], x: number, y: number, color: string) {
  if (y < 0 || y >= grid.length || x < 0 || x >= grid[0].length) return;
  grid[y][x] = color;
}

function clearPixel(grid: PixelColor[][], x: number, y: number) {
  if (y < 0 || y >= grid.length || x < 0 || x >= grid[0].length) return;
  grid[y][x] = null;
}

function drawRows(grid: PixelColor[][], rows: readonly string[], x: number, y: number, palette: Palette) {
  const colorFor = (token: string): string | null => {
    switch (token) {
      case "O": return palette.outline;
      case "S": return palette.skin;
      case "L": return palette.skinLight;
      case "s": return palette.skinShadow;
      case "H": return palette.hair;
      case "h": return palette.hairShadow;
      case "C": return palette.cloth;
      case "l": return palette.clothLight;
      case "c": return palette.clothShadow;
      case "A": return palette.accent;
      case "a": return palette.accentShadow;
      case "B": return palette.belt;
      case "T": return palette.trouser;
      case "t": return palette.trouserShadow;
      case "F": return palette.footwear;
      case "E": return palette.eye;
      case "W": return palette.wrinkle;
      default: return null;
    }
  };

  rows.forEach((row, rowIndex) => {
    for (let column = 0; column < row.length; column += 1) {
      const color = colorFor(row[column]);
      if (color) setPixel(grid, x + column, y + rowIndex, color);
    }
  });
}

function drawCenteredRows(grid: PixelColor[][], rows: readonly string[], centerX: number, y: number, palette: Palette) {
  const width = Math.max(...rows.map((row) => row.length));
  drawRows(grid, rows, Math.round(centerX - width / 2), y, palette);
}

function faceRows(faceShape: HumanFaceShape): readonly string[] {
  switch (faceShape) {
    case "round":
      return [
        "...OOOOOO...",
        ".OOSSSSSSOO.",
        "OSSSLLLLSSSO",
        "OSLSSSSSSLSSO",
        "OSSSSSSSSSSO",
        "OSSSSSSSSSSO",
        "OSSSSSSSSSSO",
        ".OSSSSSSSSO.",
        ".OSSSSSSSSO.",
        "..OSSSSSSO..",
        "...OOOOOO...",
      ];
    case "long":
      return [
        "...OOOOOO...",
        ".OOSSSSSSOO.",
        "OSSSLLLLSSSO",
        "OSLSSSSSSLSSO",
        "OSSSSSSSSSSO",
        "OSSSSSSSSSSO",
        "OSSSSSSSSSSO",
        ".OSSSSSSSSO.",
        ".OSSSSSSSSO.",
        ".OSSSSSSSSO.",
        "..OSSSSSSO..",
        "...OOOOOO...",
      ];
    case "square":
      return [
        ".OOOOOOOOOO.",
        "OSSSSSSSSSSO",
        "OSSSLLLLSSSO",
        "OSLSSSSSSLSSO",
        "OSSSSSSSSSSO",
        "OSSSSSSSSSSO",
        "OSSSSSSSSSSO",
        "OSSSSSSSSSSO",
        "OSSSSSSSSSSO",
        "OOOOOOOOOOOO",
      ];
    case "oval":
    default:
      return [
        "...OOOOOO...",
        ".OOSSSSSSOO.",
        "OSSSLLLLSSSO",
        "OSLSSSSSSLSSO",
        "OSSSSSSSSSSO",
        "OSSSSSSSSSSO",
        ".OSSSSSSSSO.",
        ".OSSSSSSSSO.",
        "..OSSSSSSO..",
        "...OOOOOO...",
      ];
  }
}

function bodyRows(clothingStyle: HumanClothingStyle): readonly string[] {
  switch (clothingStyle) {
    case "woven-dress":
      return [
        ".....OOOOOO.....",
        "...OOlCCCCOO...",
        "..OCCCCCCCCO..",
        ".OCCCCCCCCCCO.",
        "OCCCCCCCCCCCCO",
        "OCCBBBBBBCCCCO",
        "OCCCCCCCCCCCCO",
        "OClCCCCCCcCCO",
        ".OCCCCCCCCCCO.",
        ".OCCCCCCCCCCO.",
        ".OCCCCCCCCCCO.",
        "OCCCCCCCCCCCCO",
        "OCCCCCCCCCCCCO",
        "OCcCCCCCCcCCO",
        "OOCCCCCCCCOO",
        "..OCCCCCCO..",
      ];
    case "tunic-trousers":
      return [
        ".....OOOOOO.....",
        "...OOlCCCCOO...",
        "..OCCCCCCCCO..",
        ".OCCCCCCCCCCO.",
        "OCCCCCCCCCCCCO",
        "OCCBBBBBBCCCCO",
        "OCCCCCCCCCCCCO",
        ".OCcCCCCcCCO.",
        "..OCCCCCCCCO..",
        "..OOCCCCOO..",
        "...OOOOOO...",
      ];
    case "wrapped-robe":
      return [
        ".....OOOOOO.....",
        "...OOlCCCCOO...",
        "..OCCClCCCCO..",
        ".OCCCClCCCCCO.",
        "OCCCCClCCCCCCO",
        "OCCBBAABCCCCO",
        "OCCCCCCACCCCO",
        ".OCCCCCCACCCO.",
        ".OCCCCCCCACCO.",
        ".OCCCCCCCCACO.",
        ".OCcCCCCCCCO.",
        ".OCCCCCCCCCO.",
        "OOCCCCCCCCOO",
        "..OCCCCCCO..",
      ];
    case "belted-wrap":
      return [
        ".....OOOOOO.....",
        "...OOCCCCOO...",
        "..OClCCCCcCO..",
        ".OCCCCCCCCCCO.",
        "OCCCCCCCCCCCCO",
        "OCBBBBBBBBCCCO",
        "OCCCCCCCACCCCO",
        ".OCCCCCCACCCO.",
        ".OCcCCCCCCCO.",
        "..OCCCCCCCCO..",
        "..OOCCCCOO..",
        "...OOOOOO...",
      ];
    case "simple-tunic":
    default:
      return [
        ".....OOOOOO.....",
        "...OOlCCCCOO...",
        "..OCCCCCCCCO..",
        ".OCCCCCCCCCCO.",
        "OCCCCCCCCCCCCO",
        "OCCBBBBBBCCCCO",
        "OCCCCCCCCCCCCO",
        ".OCcCCCCcCCO.",
        "..OCCCCCCCCO..",
        "..OOCCCCOO..",
        "...OOOOOO...",
      ];
  }
}

function frontHairRows(style: HumanHairStyle): readonly string[] {
  switch (style) {
    case "cropped":
      return ["..HHHHHHHH..", ".HHHHHHHHHH.", "HHH......HHH"];
    case "short":
      return ["..HHHHHHHH..", ".HHHHHHHHHH.", "HHHH....HHHH", "hH........Hh"];
    case "shoulder":
      return ["..HHHHHHHH..", ".HHHHHHHHHH.", "HHHH....HHHH", "HH........HH", "H..........H", "h..........h"];
    case "long":
      return ["..HHHHHHHH..", ".HHHHHHHHHH.", "HHHH....HHHH", "HH........HH", "H..........H", "H..........H", "H..........H", "h..........h"];
    case "braided":
      return ["..HHHHHHHH..", ".HHHHHHHHHH.", "HHHH....HHHH", "HH........HH", "H..........H", "...........H", "...........H", "...........h", "...........H", "...........h"];
    case "wrapped":
      return ["..AAAAAAAA..", ".AHHHHHHHHA.", "HHHH....HHHH", "H..........H"];
    default:
      return ["..HHHHHHHH..", ".HHHHHHHHHH.", "HHHH....HHHH"];
  }
}

function backHairRows(style: HumanHairStyle): readonly string[] {
  switch (style) {
    case "shoulder":
      return ["H..........H", "H..........H", "h..........h"];
    case "long":
      return ["H..........H", "H..........H", "H..........H", "H..........H", "h..........h"];
    case "braided":
      return ["H..........H", "H..........H", "h..........H", "...........H", "...........h"];
    case "wrapped":
      return ["A..........A", "H..........H", "h..........h"];
    default:
      return [];
  }
}

function facialHairRows(style: HumanFacialHair): readonly string[] {
  switch (style) {
    case "stubble": return ["....hhhh...."];
    case "short-beard": return ["....HHHH....", "...HHhhHH..."];
    case "full-beard": return ["...HHHHHH...", "..HHHHHHHH..", "...HHhhHH..."];
    case "none":
    default: return [];
  }
}

function createPalette(input: HumanSpriteInput): Palette {
  const skin = HUMAN_SKIN_COLORS[input.appearance.skinTone];
  const effectiveHair = input.ageStage === "Elder" ? HUMAN_HAIR_COLORS.gray : HUMAN_HAIR_COLORS[input.appearance.hairColor];
  const cloth = HUMAN_CLOTHING_COLORS[input.appearance.clothingColor];
  const accent = HUMAN_CLOTHING_COLORS[input.appearance.accentColor];
  const belt = HUMAN_CLOTHING_COLORS[input.appearance.beltColor];

  return {
    outline: OUTLINE,
    skin,
    skinLight: mix(skin, "white", 0.18),
    skinShadow: mix(skin, "black", 0.22),
    hair: effectiveHair,
    hairShadow: mix(effectiveHair, "black", 0.28),
    cloth,
    clothLight: mix(cloth, "white", 0.18),
    clothShadow: mix(cloth, "black", 0.2),
    accent,
    accentShadow: mix(accent, "black", 0.25),
    belt,
    trouser: input.appearance.trouserStyle === "none" ? mix(cloth, "black", 0.12) : mix(cloth, "black", 0.18),
    trouserShadow: mix(cloth, "black", 0.34),
    footwear: input.appearance.footwearStyle === "bare" ? mix(skin, "black", 0.2) : FOOTWEAR_COLOR,
    eye: EYE_COLORS[input.appearance.eyeColor],
    wrinkle: AGE_LINE,
  };
}

function getLandmarks(input: HumanSpriteInput): Landmarks {
  const face = faceRows(input.appearance.faceShape);
  const headWidth = Math.max(...face.map((row) => row.length));
  const headHeight = face.length;
  const postureShift = input.appearance.posture === "stooped" || input.ageStage === "Elder" ? 1 : input.appearance.posture === "relaxed" ? 0 : -1;
  const heightOffset = input.appearance.bodyHeight === "tall" ? -1 : input.appearance.bodyHeight === "short" ? 1 : 0;

  if (input.ageStage === "Infant") {
    return { headX: 18, headY: 17, headWidth, headHeight, centerX: 24, shoulderY: 34, torsoY: 34, hipY: 46, footY: 56, postureShift: 0, childScale: true };
  }

  if (input.ageStage === "Child") {
    return { headX: Math.round(24 - headWidth / 2), headY: 11, headWidth, headHeight, centerX: 24, shoulderY: 27, torsoY: 28, hipY: 43, footY: 60, postureShift: 0, childScale: true };
  }

  if (input.ageStage === "Adolescent") {
    return { headX: Math.round(24 - headWidth / 2), headY: 8 + heightOffset, headWidth, headHeight, centerX: 24, shoulderY: 24, torsoY: 25, hipY: 43, footY: 65, postureShift: 0, childScale: false };
  }

  return {
    headX: Math.round(24 - headWidth / 2 + Math.max(0, postureShift)),
    headY: 6 + Math.max(0, postureShift) + heightOffset,
    headWidth,
    headHeight,
    centerX: 24 + Math.max(0, postureShift),
    shoulderY: 22 + Math.max(0, postureShift),
    torsoY: 23 + Math.max(0, postureShift),
    hipY: input.appearance.bodyHeight === "tall" ? 45 : input.appearance.bodyHeight === "short" ? 41 : 43,
    footY: input.appearance.bodyHeight === "tall" ? 69 : input.appearance.bodyHeight === "short" ? 64 : 67,
    postureShift,
    childScale: false,
  };
}

function drawShadow(grid: PixelColor[][]) {
  drawRows(grid, ["......OOOOOOOOOOOOOOOO......", "...OOOOOOOOOOOOOOOOOOOOOO..."], 10, 68, {
    outline: SHADOW,
  } as Palette);
}

function drawHead(grid: PixelColor[][], input: HumanSpriteInput, landmarks: Landmarks, palette: Palette) {
  drawRows(grid, faceRows(input.appearance.faceShape), landmarks.headX, landmarks.headY, palette);
  const eyeY = landmarks.headY + (input.appearance.faceShape === "long" ? 4 : 3);
  setPixel(grid, landmarks.headX + 3, eyeY, palette.eye);
  setPixel(grid, landmarks.headX + 4, eyeY, palette.skinShadow);
  setPixel(grid, landmarks.headX + landmarks.headWidth - 5, eyeY, palette.skinShadow);
  setPixel(grid, landmarks.headX + landmarks.headWidth - 4, eyeY, palette.eye);
  setPixel(grid, landmarks.headX + Math.floor(landmarks.headWidth / 2), eyeY + 2, palette.skinShadow);
  setPixel(grid, landmarks.headX + Math.floor(landmarks.headWidth / 2) - 1, eyeY + 5, palette.skinShadow);
  setPixel(grid, landmarks.headX + Math.floor(landmarks.headWidth / 2), eyeY + 5, palette.skinShadow);
  setPixel(grid, landmarks.headX + Math.floor(landmarks.headWidth / 2) + 1, eyeY + 5, palette.skinShadow);
}

function drawHair(grid: PixelColor[][], input: HumanSpriteInput, landmarks: Landmarks, palette: Palette) {
  const backRows = backHairRows(input.appearance.hairStyle);
  if (backRows.length > 0) drawRows(grid, backRows, landmarks.headX, landmarks.headY + 2, palette);
  drawRows(grid, frontHairRows(input.appearance.hairStyle), landmarks.headX, landmarks.headY - 1, palette);
}

function drawNeck(grid: PixelColor[][], landmarks: Landmarks, palette: Palette) {
  drawCenteredRows(grid, [".OSSSSO.", "..SSSS.."], landmarks.centerX, landmarks.headY + landmarks.headHeight - 1, palette);
}

function adjustedBodyRows(input: HumanSpriteInput): readonly string[] {
  const rows = bodyRows(input.appearance.clothingStyle);
  if (input.ageStage === "Child") return rows.slice(0, Math.max(7, rows.length - 2));
  if (input.ageStage === "Infant") return [".OOOO.", "OCCCCO", "OCACCO", "OCCCCO", ".OOOO."];
  return rows;
}

function drawTorso(grid: PixelColor[][], input: HumanSpriteInput, landmarks: Landmarks, palette: Palette) {
  const rows = adjustedBodyRows(input);
  drawCenteredRows(grid, rows, landmarks.centerX, landmarks.torsoY, palette);

  if (input.appearance.shoulderWidth === "wide" || input.appearance.bodyBuild === "broad") {
    drawCenteredRows(grid, ["OOO............OOO"], landmarks.centerX, landmarks.shoulderY, palette);
  }
  if (input.appearance.bodyBuild === "slender") {
    clearPixel(grid, landmarks.centerX - 8, landmarks.torsoY + 4);
    clearPixel(grid, landmarks.centerX + 7, landmarks.torsoY + 4);
  }
}

function drawArms(grid: PixelColor[][], input: HumanSpriteInput, landmarks: Landmarks, palette: Palette) {
  if (input.ageStage === "Infant") {
    drawRows(grid, ["SS......SS", "ss......ss"], landmarks.centerX - 5, landmarks.torsoY + 3, palette);
    return;
  }

  const sleeveRows = input.appearance.sleeveLength === "long" ? 9 : input.appearance.sleeveLength === "elbow" ? 6 : 4;
  const shoulderSpread = input.appearance.shoulderWidth === "narrow" ? 11 : input.appearance.shoulderWidth === "wide" || input.appearance.bodyBuild === "broad" ? 14 : 13;
  const leftX = landmarks.centerX - shoulderSpread;
  const rightX = landmarks.centerX + shoulderSpread - 2;
  const startY = landmarks.shoulderY + 2;
  const handY = startY + (input.ageStage === "Child" ? 13 : input.ageStage === "Adolescent" ? 16 : 19);

  for (let index = 0; index < handY - startY; index += 1) {
    const y = startY + index;
    const leftLean = input.appearance.posture === "relaxed" && index > 5 ? -1 : 0;
    const rightLean = input.appearance.posture === "relaxed" && index > 5 ? 1 : 0;
    const color = index < sleeveRows ? (index === sleeveRows - 1 ? palette.clothShadow : palette.cloth) : palette.skin;
    setPixel(grid, leftX + leftLean, y, palette.outline);
    setPixel(grid, leftX + 1 + leftLean, y, color);
    setPixel(grid, leftX + 2 + leftLean, y, index % 4 === 0 ? palette.skinShadow : color);
    setPixel(grid, rightX + rightLean, y, index % 4 === 0 ? palette.skinShadow : color);
    setPixel(grid, rightX + 1 + rightLean, y, color);
    setPixel(grid, rightX + 2 + rightLean, y, palette.outline);
  }

  drawRows(grid, ["OSSO"], leftX - 1 + (input.appearance.posture === "relaxed" ? -1 : 0), handY, palette);
  drawRows(grid, ["OSSO"], rightX + (input.appearance.posture === "relaxed" ? 1 : 0), handY, palette);
}

function drawLegs(grid: PixelColor[][], input: HumanSpriteInput, landmarks: Landmarks, palette: Palette) {
  if (input.ageStage === "Infant") {
    drawCenteredRows(grid, [".A..A.", "CCCCCC", ".CCCC."], landmarks.centerX, landmarks.hipY, palette);
    return;
  }

  const robeLike = input.appearance.clothingStyle === "woven-dress" || input.appearance.clothingStyle === "wrapped-robe";
  const leftX = landmarks.centerX - 7;
  const rightX = landmarks.centerX + 3;
  const legStart = landmarks.hipY;
  const legEnd = landmarks.footY - 3;

  if (robeLike) {
    drawCenteredRows(grid, ["OCCCCCCCCCCCCO", "OCCCCCCCCCCCCO", ".OCcCCCCCCcCO.", ".OCCCCCCCCCCO.", "..OCCCCCCCCO..", "..OOCCCCOO.."], landmarks.centerX, legStart - 1, palette);
    for (let y = legStart + 5; y <= legEnd; y += 1) {
      const progress = (y - (legStart + 5)) / Math.max(1, legEnd - (legStart + 5));
      const halfWidth = progress > 0.72 ? 5 : progress > 0.42 ? 6 : 7;
      const hem = y >= legEnd - 2;
      setPixel(grid, landmarks.centerX - halfWidth, y, palette.outline);
      setPixel(grid, landmarks.centerX + halfWidth, y, palette.outline);
      for (let x = landmarks.centerX - halfWidth + 1; x < landmarks.centerX + halfWidth; x += 1) {
        const fold = (x === landmarks.centerX - 3 || x === landmarks.centerX + 3 || (x === landmarks.centerX && y % 5 === 0));
        setPixel(grid, x, y, hem ? palette.accentShadow : fold ? palette.clothShadow : palette.cloth);
      }
    }
    drawCenteredRows(grid, ["OAAAAAAAAAAO"], landmarks.centerX, legEnd - 1, palette);
    return;
  }

  for (let y = legStart; y <= legEnd; y += 1) {
    const wrap = input.appearance.trouserStyle === "wrapped" && y % 4 === 0;
    const loose = input.appearance.trouserStyle === "loose" ? 1 : 0;
    const color = wrap ? palette.accent : y % 5 === 0 ? palette.trouserShadow : palette.trouser;
    setPixel(grid, leftX - loose, y, palette.outline);
    setPixel(grid, leftX + 1, y, color);
    setPixel(grid, leftX + 2 + loose, y, color);
    setPixel(grid, leftX + 3 + loose, y, y % 6 === 0 ? palette.trouserShadow : color);
    setPixel(grid, rightX - loose, y, y % 6 === 0 ? palette.trouserShadow : color);
    setPixel(grid, rightX + 1, y, color);
    setPixel(grid, rightX + 2, y, color);
    setPixel(grid, rightX + 3 + loose, y, palette.outline);
  }
}

function drawFeet(grid: PixelColor[][], input: HumanSpriteInput, landmarks: Landmarks, palette: Palette) {
  const color = input.appearance.footwearStyle === "leg-wraps" ? palette.accent : palette.footwear;
  const leftX = landmarks.centerX - 10;
  const rightX = landmarks.centerX + 3;
  drawRows(grid, ["OFFFFFFO", ".OFFFFO."], leftX, landmarks.footY - 1, { ...palette, footwear: color });
  drawRows(grid, ["OFFFFFFO", ".OFFFFO."], rightX, landmarks.footY - 1, { ...palette, footwear: color });
  if (input.appearance.footwearStyle === "leg-wraps") {
    drawRows(grid, ["AA", "aa", "AA"], landmarks.centerX - 5, landmarks.footY - 8, palette);
    drawRows(grid, ["AA", "aa", "AA"], landmarks.centerX + 5, landmarks.footY - 8, palette);
  }
}

function drawDetails(grid: PixelColor[][], input: HumanSpriteInput, landmarks: Landmarks, palette: Palette) {
  if (input.appearance.clothingStyle === "wrapped-robe" || input.appearance.clothingStyle === "belted-wrap") {
    for (let index = 0; index < 10; index += 1) {
      setPixel(grid, landmarks.centerX - 3 + Math.floor(index / 2), landmarks.torsoY + 3 + index, palette.accentShadow);
    }
  }

  if (input.ageStage === "Elder") {
    setPixel(grid, landmarks.headX + 3, landmarks.headY + 5, palette.wrinkle);
    setPixel(grid, landmarks.headX + 8, landmarks.headY + 5, palette.wrinkle);
    setPixel(grid, landmarks.headX + 5, landmarks.headY + 8, palette.wrinkle);
    setPixel(grid, landmarks.centerX - 12, landmarks.footY - 10, palette.outline);
    setPixel(grid, landmarks.centerX - 13, landmarks.footY - 8, palette.outline);
    setPixel(grid, landmarks.centerX - 14, landmarks.footY - 6, palette.outline);
  }
}

function drawFacialHair(grid: PixelColor[][], input: HumanSpriteInput, landmarks: Landmarks, palette: Palette) {
  if (input.ageStage === "Infant" || input.ageStage === "Child") return;
  const rows = facialHairRows(input.appearance.facialHair);
  if (rows.length === 0) return;
  drawRows(grid, rows, landmarks.headX, landmarks.headY + landmarks.headHeight - rows.length - 1, palette);
}

function pixelsFromGrid(grid: PixelColor[][]): HumanSpritePixel[] {
  return grid.flatMap((row, y) => row.flatMap((color, x) => color ? [{ x, y, color }] : []));
}

function downsample(pixels: readonly HumanSpritePixel[]): HumanSpritePixel[] {
  const result: HumanSpritePixel[] = [];
  const pixelByCoord = new Map(pixels.map((pixel) => [`${pixel.x}:${pixel.y}`, pixel.color]));
  const blockWidth = HUMAN_SPRITE_NATIVE_WIDTH / HUMAN_MAP_SPRITE_WIDTH;
  const blockHeight = HUMAN_SPRITE_NATIVE_HEIGHT / HUMAN_MAP_SPRITE_HEIGHT;

  for (let y = 0; y < HUMAN_MAP_SPRITE_HEIGHT; y += 1) {
    for (let x = 0; x < HUMAN_MAP_SPRITE_WIDTH; x += 1) {
      const colors: string[] = [];

      for (let sourceY = Math.floor(y * blockHeight); sourceY < Math.floor((y + 1) * blockHeight); sourceY += 1) {
        for (let sourceX = Math.floor(x * blockWidth); sourceX < Math.floor((x + 1) * blockWidth); sourceX += 1) {
          const color = pixelByCoord.get(`${sourceX}:${sourceY}`);
          if (color) colors.push(color);
        }
      }

      if (colors.length === 0) continue;
      const ranked = [...new Set(colors)].sort((left, right) => colors.filter((color) => color === right).length - colors.filter((color) => color === left).length);
      result.push({ x, y, color: ranked[0] });
    }
  }

  return result;
}

export function buildHumanSpriteModel(input: HumanSpriteInput): HumanSpriteModel {
  const palette = createPalette(input);
  const landmarks = getLandmarks(input);
  const grid = createGrid();

  drawShadow(grid);
  drawHair(grid, input, landmarks, palette);
  drawLegs(grid, input, landmarks, palette);
  drawFeet(grid, input, landmarks, palette);
  drawTorso(grid, input, landmarks, palette);
  drawArms(grid, input, landmarks, palette);
  drawNeck(grid, landmarks, palette);
  drawHead(grid, input, landmarks, palette);
  drawHair(grid, input, landmarks, palette);
  drawFacialHair(grid, input, landmarks, palette);
  drawDetails(grid, input, landmarks, palette);

  return {
    width: HUMAN_SPRITE_NATIVE_WIDTH,
    height: HUMAN_SPRITE_NATIVE_HEIGHT,
    pixels: pixelsFromGrid(grid),
    layerIds: HUMAN_SPRITE_LAYER_IDS,
    nativeResolution: "48x72",
    metadata: {
      effectiveHairColor: input.ageStage === "Elder" ? HUMAN_HAIR_COLORS.gray : HUMAN_HAIR_COLORS[input.appearance.hairColor],
      clothingColor: HUMAN_CLOTHING_COLORS[input.appearance.clothingColor],
      accentColor: HUMAN_CLOTHING_COLORS[input.appearance.accentColor],
      skinColor: HUMAN_SKIN_COLORS[input.appearance.skinTone],
      faceShape: input.appearance.faceShape,
      bodyBuild: input.appearance.bodyBuild,
      bodyHeight: input.appearance.bodyHeight,
      shoulderWidth: input.appearance.shoulderWidth,
      clothingStyle: input.appearance.clothingStyle,
      sleeveLength: input.appearance.sleeveLength,
      trouserStyle: input.appearance.trouserStyle,
      footwearStyle: input.appearance.footwearStyle,
      posture: input.ageStage === "Elder" && input.appearance.posture !== "stooped" ? "stooped" : input.appearance.posture,
      hasWeaponsOrEquipment: false,
    },
  };
}

export function buildHumanMapSpriteModel(input: HumanSpriteInput): Omit<HumanSpriteModel, "nativeResolution"> & { nativeResolution: "16x24" } {
  const native = buildHumanSpriteModel(input);
  return {
    ...native,
    width: HUMAN_MAP_SPRITE_WIDTH,
    height: HUMAN_MAP_SPRITE_HEIGHT,
    pixels: downsample(native.pixels),
    nativeResolution: "16x24",
  };
}