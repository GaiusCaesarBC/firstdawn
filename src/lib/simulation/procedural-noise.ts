export type Rgb = [number, number, number];

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function smoothstep(edge0: number, edge1: number, value: number): number {
  const normalized = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return normalized * normalized * (3 - 2 * normalized);
}

export function smootherstep(edge0: number, edge1: number, value: number): number {
  const normalized = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return normalized * normalized * normalized * (normalized * (normalized * 6 - 15) + 10);
}

function hashInteger(seed: string, x: number, y: number, salt: string): number {
  let hash = 2_166_136_261;
  const value = `${seed}:${salt}:${Math.floor(x)}:${Math.floor(y)}`;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return hash >>> 0;
}

export function hashNoise(seed: string, x: number, y: number, salt: string): number {
  return (hashInteger(seed, x, y, salt) % 10_000) / 10_000;
}

export function signedHashNoise(seed: string, x: number, y: number, salt: string): number {
  return hashNoise(seed, x, y, salt) * 2 - 1;
}

function lerp(left: number, right: number, weight: number): number {
  return left + (right - left) * weight;
}

export function valueNoise(seed: string, x: number, y: number, salt: string): number {
  const left = Math.floor(x);
  const top = Math.floor(y);
  const localX = smootherstep(0, 1, x - left);
  const localY = smootherstep(0, 1, y - top);
  const topLeft = hashNoise(seed, left, top, salt);
  const topRight = hashNoise(seed, left + 1, top, salt);
  const bottomLeft = hashNoise(seed, left, top + 1, salt);
  const bottomRight = hashNoise(seed, left + 1, top + 1, salt);

  return lerp(
    lerp(topLeft, topRight, localX),
    lerp(bottomLeft, bottomRight, localX),
    localY,
  );
}

export function fbmNoise(
  seed: string,
  x: number,
  y: number,
  salt: string,
  octaves: number,
  lacunarity = 2,
  gain = 0.5,
): number {
  let amplitude = 0.5;
  let frequency = 1;
  let total = 0;
  let normalization = 0;

  for (let octave = 0; octave < octaves; octave += 1) {
    total += valueNoise(seed, x * frequency, y * frequency, `${salt}:${octave}`) * amplitude;
    normalization += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }

  return normalization > 0 ? total / normalization : 0;
}

export function ridgeNoise(seed: string, x: number, y: number, salt: string, octaves: number): number {
  let amplitude = 0.52;
  let frequency = 1;
  let total = 0;
  let normalization = 0;

  for (let octave = 0; octave < octaves; octave += 1) {
    const signal = 1 - Math.abs(valueNoise(seed, x * frequency, y * frequency, `${salt}:ridge:${octave}`) * 2 - 1);
    total += signal * signal * amplitude;
    normalization += amplitude;
    amplitude *= 0.48;
    frequency *= 2.08;
  }

  return normalization > 0 ? total / normalization : 0;
}

export function hexToRgb(hex: string): Rgb | null {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) {
    return null;
  }

  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}

export function rgbToHex(red: number, green: number, blue: number): string {
  return `#${[red, green, blue].map((value) => Math.round(clamp(value, 0, 255)).toString(16).padStart(2, "0")).join("")}`;
}

export function mixColor(left: string, right: string, weight: number): string {
  const leftRgb = hexToRgb(left);
  const rightRgb = hexToRgb(right);

  if (!leftRgb || !rightRgb) {
    return left;
  }

  const clampedWeight = clamp(weight, 0, 1);

  return rgbToHex(
    lerp(leftRgb[0], rightRgb[0], clampedWeight),
    lerp(leftRgb[1], rightRgb[1], clampedWeight),
    lerp(leftRgb[2], rightRgb[2], clampedWeight),
  );
}

export function shadeColor(color: string, amount: number): string {
  const rgb = hexToRgb(color);

  if (!rgb) {
    return color;
  }

  return rgbToHex(
    rgb[0] + amount * 255,
    rgb[1] + amount * 255,
    rgb[2] + amount * 255,
  );
}

export function mixRgb(left: Rgb, right: Rgb, weight: number): Rgb {
  const clampedWeight = clamp(weight, 0, 1);

  return [
    Math.round(lerp(left[0], right[0], clampedWeight)),
    Math.round(lerp(left[1], right[1], clampedWeight)),
    Math.round(lerp(left[2], right[2], clampedWeight)),
  ];
}

export function shadeRgb(color: Rgb, amount: number): Rgb {
  return [
    Math.round(clamp(color[0] + amount * 255, 0, 255)),
    Math.round(clamp(color[1] + amount * 255, 0, 255)),
    Math.round(clamp(color[2] + amount * 255, 0, 255)),
  ];
}
