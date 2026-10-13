import { describe, expect, it } from "vitest";
import { isValidCoordinates, withinRadius } from "./geofence";

describe("QR campaign geofence", () => {
  const campus = { latitude: 40.0067, longitude: -83.0305 };
  it("accepts a point within the configured radius and rejects one outside", () => {
    expect(withinRadius({ latitude: 40.0068, longitude: -83.0305 }, campus, 50)).toBe(true);
    expect(withinRadius({ latitude: 40.01, longitude: -83.0305 }, campus, 50)).toBe(false);
  });
  it("rejects invalid GPS values rather than persisting or awarding", () => {
    expect(isValidCoordinates({ latitude: 91, longitude: 0 })).toBe(false);
    expect(withinRadius({ latitude: NaN, longitude: 0 }, campus, 100)).toBe(false);
  });
});
