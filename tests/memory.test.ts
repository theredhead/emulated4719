/** @format */

import { Memory } from "../src/emulator";

describe("memory", () => {
  const memory = new Memory(16);

  it("fails when reading undefined address", () => {
    expect(() => {
      memory.read((undefined as unknown) as number);
    }).toThrow();
  });
  it("fails when writing to an undefined address", () => {
    expect(() => {
      memory.write((undefined as unknown) as number, 1);
    }).toThrow();
  });
  it("fails when writing an undefined value", () => {
    expect(() => {
      memory.write(0, (undefined as unknown) as number);
    }).toThrow();
  });
});
