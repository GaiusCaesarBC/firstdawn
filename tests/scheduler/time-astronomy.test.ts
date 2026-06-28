import { describe, expect, it } from "vitest";

import {
  DEFAULT_WORLD_TIME_CONFIG,
  getTimeStateAtTick,
} from "../../src/lib/simulation/time-engine";
import { getAstronomyStateAtTick } from "../../src/lib/simulation/astronomy-engine";

const defaultWorld = {
  currentTick: 0n,
  ...DEFAULT_WORLD_TIME_CONFIG,
};

describe("time engine", () => {
  it("starts tick 0 at the configured epoch, year, day, and hour", () => {
    const state = getTimeStateAtTick(defaultWorld, 0n);

    expect(state.tick).toBe("0");
    expect(state.epochName).toBe("First Dawn");
    expect(state.year).toBe(0);
    expect(state.dayOfYear).toBe(0);
    expect(state.hour).toBe(6);
    expect(state.minute).toBe(0);
    expect(state.phaseLabel).toBe("sunrise");
  });

  it("advances minutes, hours, and days from ticks", () => {
    const oneMinute = getTimeStateAtTick(defaultWorld, 1n);
    const oneHour = getTimeStateAtTick(defaultWorld, 60n);
    const oneDay = getTimeStateAtTick(defaultWorld, 1_440n);

    expect(oneMinute.elapsedMinutes).toBe(1);
    expect(oneMinute.minute).toBe(1);
    expect(oneHour.elapsedHours).toBe(1);
    expect(oneHour.hour).toBe(7);
    expect(oneDay.elapsedDays).toBe(1);
    expect(oneDay.dayOfYear).toBe(1);
    expect(oneDay.hour).toBe(6);
  });

  it("wraps day progress across day boundaries", () => {
    const start = getTimeStateAtTick(defaultWorld, 0n);
    const nextDay = getTimeStateAtTick(defaultWorld, 1_440n);

    expect(nextDay.normalizedDayProgress).toBe(start.normalizedDayProgress);
    expect(nextDay.dayOfYear).toBe(1);
  });

  it("wraps year progress across year boundaries", () => {
    const start = getTimeStateAtTick(defaultWorld, 0n);
    const nextYear = getTimeStateAtTick(defaultWorld, 365n * 1_440n);

    expect(nextYear.year).toBe(1);
    expect(nextYear.dayOfYear).toBe(0);
    expect(nextYear.normalizedYearProgress).toBe(start.normalizedYearProgress);
  });

  it("returns deterministic phase labels", () => {
    expect(getTimeStateAtTick(defaultWorld, 720n).phaseLabel).toBe(
      getTimeStateAtTick(defaultWorld, 720n).phaseLabel,
    );
  });
});

describe("astronomy engine", () => {
  const noonWorld = {
    ...defaultWorld,
    initialHour: 12,
  };

  it("changes seasons based on year progress", () => {
    expect(getAstronomyStateAtTick(noonWorld, 0n).seasonNorthernHemisphere).toBe("spring");
    expect(getAstronomyStateAtTick(noonWorld, 100n * 1_440n).seasonNorthernHemisphere).toBe("summer");
    expect(getAstronomyStateAtTick(noonWorld, 200n * 1_440n).seasonNorthernHemisphere).toBe("autumn");
    expect(getAstronomyStateAtTick(noonWorld, 300n * 1_440n).seasonNorthernHemisphere).toBe("winter");
  });

  it("keeps opposite hemispheres in opposite seasons", () => {
    const summer = getAstronomyStateAtTick(noonWorld, 100n * 1_440n);
    const winter = getAstronomyStateAtTick(noonWorld, 300n * 1_440n);

    expect(summer.seasonNorthernHemisphere).toBe("summer");
    expect(summer.seasonSouthernHemisphere).toBe("winter");
    expect(winter.seasonNorthernHemisphere).toBe("winter");
    expect(winter.seasonSouthernHemisphere).toBe("summer");
  });

  it("keeps solar declination within axial tilt bounds", () => {
    for (const day of [0n, 91n, 182n, 273n, 364n]) {
      const state = getAstronomyStateAtTick(noonWorld, day * 1_440n);

      expect(Math.abs(state.solarDeclinationDegrees)).toBeLessThanOrEqual(
        state.axialTiltDegrees,
      );
    }
  });

  it("returns deterministic daylight factors", () => {
    const first = getAstronomyStateAtTick(noonWorld, 42n);
    const second = getAstronomyStateAtTick(noonWorld, 42n);

    expect(first.daylightFactor).toBe(second.daylightFactor);
  });

  it("returns the same astronomy state for the same tick and world config", () => {
    expect(getAstronomyStateAtTick(noonWorld, 12_345n)).toEqual(
      getAstronomyStateAtTick(noonWorld, 12_345n),
    );
  });
});