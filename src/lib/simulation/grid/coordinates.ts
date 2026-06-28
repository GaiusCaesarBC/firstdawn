export type Latitude = number;
export type Longitude = number;

export type LatitudeHemisphere = "northern" | "southern" | "equatorial";
export type LongitudeHemisphere = "eastern" | "western" | "prime-meridian";

export type Hemisphere = {
  latitude: LatitudeHemisphere;
  longitude: LongitudeHemisphere;
  label: string;
};

export type CoordinateRange = {
  minimum: number;
  maximum: number;
};

export type LatitudeBand = {
  id: string;
  index: number;
  name: string;
  from: Latitude;
  to: Latitude;
  midpoint: Latitude;
};

export type GridCoordinate = {
  latitude: Latitude;
  longitude: Longitude;
};

export function normalizeLatitude(latitude: number): Latitude {
  return Math.max(-90, Math.min(90, latitude));
}

export function normalizeLongitude(longitude: number): Longitude {
  const wrapped = ((longitude + 180) % 360 + 360) % 360 - 180;
  return Object.is(wrapped, -0) ? 0 : wrapped;
}

function latitudeHemisphereFor(latitude: Latitude): LatitudeHemisphere {
  if (latitude > 0) {
    return "northern";
  }

  if (latitude < 0) {
    return "southern";
  }

  return "equatorial";
}

function longitudeHemisphereFor(longitude: Longitude): LongitudeHemisphere {
  if (longitude > 0) {
    return "eastern";
  }

  if (longitude < 0) {
    return "western";
  }

  return "prime-meridian";
}

export function getHemisphere(latitude: Latitude, longitude: Longitude): Hemisphere {
  const latitudeHemisphere = latitudeHemisphereFor(latitude);
  const longitudeHemisphere = longitudeHemisphereFor(longitude);

  return {
    latitude: latitudeHemisphere,
    longitude: longitudeHemisphere,
    label: `${latitudeHemisphere} / ${longitudeHemisphere}`,
  };
}

function formatLatitudeValue(latitude: Latitude): string {
  if (latitude === 0) {
    return "0°";
  }

  return `${Math.abs(latitude).toFixed(0)}°${latitude > 0 ? "N" : "S"}`;
}

export function getLatitudeBand(
  latitudeRange: CoordinateRange,
  index: number,
): LatitudeBand {
  const from = normalizeLatitude(latitudeRange.minimum);
  const to = normalizeLatitude(latitudeRange.maximum);
  const midpoint = (from + to) / 2;

  return {
    id: `lat-band-${index.toString().padStart(2, "0")}`,
    index,
    name: `${formatLatitudeValue(from)} to ${formatLatitudeValue(to)}`,
    from,
    to,
    midpoint,
  };
}
