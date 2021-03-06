/** @format */

import { tokenize, compile } from "../src/emulator";

describe("compiler", () => {
  it("compiles straight mnemonics as expected", () => {
    const code = "bell halt";
    expect(compile(code)).toEqual([0x07, 0x00]);
  });
  it("handles inline comments", () => {
    const code = `
# ring a bell
    bell # this rings

# halt the cpu
    halt # this doesn't
  `;
    expect(tokenize(code)).toEqual(["bell", "halt"]);

    expect(compile(code)).toEqual([0x07, 0x00]);
  });
});
