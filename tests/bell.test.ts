/** @format */

import { Memory, Processor, ProcessorRunMode } from "../src/emulator";

const memory = new Memory(16);
const processor = new Processor(memory);

describe("Processor bell", () => {
  it("allows external sources to handle BELL", () => {
    processor.reset();
    memory.write(0, 0x07); // ring bell instruction
    memory.write(1, 0x00); // halt instruction

    let bellSounded = false;
    processor.bellHandler = () => {
      bellSounded = true;
    };
    expect(() => {
      processor.runmode = ProcessorRunMode.GO; // no timers
      processor.run();
    }).not.toThrow();

    expect(bellSounded).toBe(true);
  });
});

describe("Processor bell", () => {
  it("allows external sources to handle PRINT", () => {
    processor.reset();
    memory.write(0, 0x08); // print
    memory.write(1, 0x0a); // argument to print
    memory.write(2, 0x00); // halt instruction

    const printed: number[] = [];
    processor.printHandler = (v: number) => {
      printed.push(v);
    };
    expect(() => {
      processor.runmode = ProcessorRunMode.GO; // no timers
      processor.run();
    }).not.toThrow();

    expect(printed).toEqual([0x0a]);
  });
});
