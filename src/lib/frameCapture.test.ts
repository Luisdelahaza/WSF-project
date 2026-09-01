import { describe, it, expect } from "vitest";
import { lonToPixelX, latToPixelY, chooseZoom } from "@/lib/frameCapture";
import { TILE_SIZE } from "@/config/wsf";

describe("lonToPixelX", () => {
  it("lon=-180 at z=0 = left edge (0)", () => {
    expect(lonToPixelX(-180, 0)).toBeCloseTo(0, 5);
  });

  it("lon=0 at z=0 = center", () => {
    expect(lonToPixelX(0, 0)).toBeCloseTo(TILE_SIZE / 2, 5);
  });

  it("lon=180 at z=0 = right edge (256)", () => {
    expect(lonToPixelX(180, 0)).toBeCloseTo(TILE_SIZE, 5);
  });

  it("doubles pixel range per zoom level", () => {
    const z0 = lonToPixelX(90, 0);
    const z1 = lonToPixelX(90, 1);
    expect(z1).toBeCloseTo(z0 * 2, 3);
  });

  it("lon=0 at z=1 = 256 (center of 512px world)", () => {
    expect(lonToPixelX(0, 1)).toBeCloseTo(256, 5);
  });
});

describe("latToPixelY", () => {
  it("lat=0 (equator) at z=0 = center (128)", () => {
    expect(latToPixelY(0, 0)).toBeCloseTo(TILE_SIZE / 2, 5);
  });

  it("higher latitude = smaller Y (north is up)", () => {
    const y0 = latToPixelY(0, 5);
    const yN = latToPixelY(45, 5);
    expect(yN).toBeLessThan(y0);
  });

  it("symmetric around equator", () => {
    const yNorth = latToPixelY(30, 5);
    const ySouth = latToPixelY(-30, 5);
    const center = latToPixelY(0, 5);
    expect(yNorth - center).toBeCloseTo(-(ySouth - center), -1);
  });
});

describe("chooseZoom", () => {
  const narrowBbox = [-1, 40, 1, 42] as const;
  const wideBbox = [-180, -90, 180, 90] as const;

  it("returns low zoom for world-spanning bbox at 768px target", () => {
    const z = chooseZoom(wideBbox as [number, number, number, number], 768);
    expect(z).toBe(2);
  });

  it("returns higher zoom for narrow bbox", () => {
    const z = chooseZoom(narrowBbox as [number, number, number, number], 768);
    expect(z).toBeGreaterThan(3);
  });

  it("respects maxZoom ceiling", () => {
    const z = chooseZoom(narrowBbox as [number, number, number, number], 768, 5);
    expect(z).toBeLessThanOrEqual(5);
  });

  it("default maxZoom is 12", () => {
    const z = chooseZoom([0, 0, 0.001, 0.001] as [number, number, number, number], 768);
    expect(z).toBeLessThanOrEqual(12);
  });
});
