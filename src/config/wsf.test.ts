import { describe, it, expect } from "vitest";
import { variableParamKey, dtypeBytes } from "@/config/wsf";

describe("variableParamKey", () => {
  it("returns 'variables' for geozarr", () => {
    expect(variableParamKey("geozarr")).toBe("variables");
  });

  it("returns 'variable' for md", () => {
    expect(variableParamKey("md")).toBe("variable");
  });

  it("returns null for cog", () => {
    expect(variableParamKey("cog")).toBeNull();
  });
});

describe("dtypeBytes", () => {
  it("int8 = 1 byte", () => {
    expect(dtypeBytes("int8")).toBe(1);
  });

  it("uint8 = 1 byte", () => {
    expect(dtypeBytes("uint8")).toBe(1);
  });

  it("int16 = 2 bytes", () => {
    expect(dtypeBytes("int16")).toBe(2);
  });

  it("uint16 = 2 bytes", () => {
    expect(dtypeBytes("uint16")).toBe(2);
  });

  it("float32 = 4 bytes", () => {
    expect(dtypeBytes("float32")).toBe(4);
  });

  it("float64 = 8 bytes", () => {
    expect(dtypeBytes("float64")).toBe(8);
  });

  it("undefined dtype falls back to 4 bytes", () => {
    expect(dtypeBytes(undefined)).toBe(4);
  });

  it("dtype without digits falls back to 4 bytes", () => {
    expect(dtypeBytes("custom")).toBe(4);
  });
});
