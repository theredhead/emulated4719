/**
 * Emulate a fictional 4719 4bit CPU
 *
 * As seem in Richard Buckland's Higher Computing lectures
 *
 * @format
 */

import { hexFormat, range } from "./utils";

const beepSound =
  "data:audio/mpeg;base64,/+MYxAAEaAIEeUAQAgBgNgP/////KQQ/////Lvrg+lcWYHgtjadzsbTq+yREu495tq9c6v/7vt/of7mna9v6/btUnU17Jun9/+MYxCkT26KW+YGBAj9v6vUh+zab//v/96C3/pu6H+pv//r/ycIIP4pcWWTRBBBAMXgNdbRaABQAAABRWKwgjQVX0ECmrb///+MYxBQSM0sWWYI4A++Z/////////////0rOZ3MP//7H44QEgxgdvRVMXHZseL//540B4JAvMPEgaA4/0nHjxLhRgAoAYAgA/+MYxAYIAAJfGYEQAMAJAIAQMAwX936/q/tWtv/2f/+v//6v/+7qTEFNRTMuOTkuNVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV";

export class Processor {
  strict = true;
  registers: Registers = new Registers();

  instructionSet: { [key: number]: Instruction } = {
    [0x00]: halt, // 'halt',
    [0x01]: add, // 'add', // r0 = r0 + r1
    [0x02]: subtract, //'subtract', // r0 = r0 - r1,
    [0x03]: increment_r0, // 'inrement r0', // r0 = r0 +1,
    [0x04]: increment_r1, // 'inrement r1', // r1 = r1 +1,
    [0x05]: decrement_r0, // 'decrement r0',
    [0x06]: decrement_r1, // 'decrement r1',
    [0x07]: bell, // 'ring bell',

    //2 byte instructions
    [0x08]: print, // 'print <data>',
    [0x09]: load_r0_from_ss, // 'load <data> into r0',
    [0x0a]: load_r1_from_ss, // 'load <data> into r1',
    [0x0b]: store_r0_into_memory_at_ss, // 'store r0 into address <data>',
    [0x0c]: store_r1_into_memory_at_ss, //'store r1 into address <data>',
    [0x0d]: jump, // 'jump <data>',
    [0x0e]: jump_if, // 'jump <data> if r0 == 0',
    [0x0f]: jump_if_not, //  'jump <data> if r0 != 0'
  };

  state: ProcessorState = ProcessorState.OFF;
  history: EmulatorSnapshot[] = [];
  delayBetweenInstructions = 1000;

  get isRunning(): boolean {
    return this.state === ProcessorState.RUNNING;
  }
  get canResume(): boolean {
    return [ProcessorState.PAUSED, ProcessorState.OFF].includes(this.state);
  }
  get canStart(): boolean {
    return [ProcessorState.OFF, ProcessorState.HALTED].includes(this.state);
  }

  stop() {
    this.state = ProcessorState.OFF;
  }
  load(program: number[]) {
    for (let address = 0; address < program.length; address++) {
      this.memory.write(address, program[address]);
    }
  }
  playPause() {
    const savedState = this.state;
    switch (this.state) {
      case ProcessorState.RUNNING:
      case ProcessorState.PAUSED:
        this.run();
        break;
      case ProcessorState.OFF:
      case ProcessorState.HALTED:
        // this.reset();
        this.run();
      default:
        break;
    }
    console.log(
      [ProcessorState[savedState], ProcessorState[this.state]].join(" => ")
    );
  }
  reset() {
    this.history = [];
    // this.memory.clear();
    this.registers = new Registers();
    this.state = ProcessorState.OFF;
    this.registers = new Registers();
    this.bell();
  }
  continue() {
    this.state = ProcessorState.RUNNING;
  }
  run() {
    if (this.state !== ProcessorState.RUNNING) {
      this.state = ProcessorState.RUNNING;
      this.tick();
    } else {
      console.error("Processor is already running");
    }
  }
  bell() {
    console.log("BELL");
    new Audio(beepSound).play();
  }
  print(byte: number) {
    this._output.push(byte);
  }

  constructor(readonly memory: Memory = new Memory(16)) {
    this.reset();
  }

  get snapshot(): EmulatorSnapshot {
    return {
      registers: Object.assign({}, this.registers),
      memory: this.dumpMemorySnapshot(this.memory),
    };
  }

  private _output: number[] = [];
  public get output() {
    return [...this._output];
  }

  readAddress(address: number): number {
    return this.memory.read(address);
  }

  writeAddress(address: number, value: number) {
    this.memory.write(address, value);
  }

  moveInstructionPointerForward() {
    this.registers.ip++;
    this.registers.ss = this.readAddress(this.registers.ip + 1);
  }

  private dumpMemorySnapshot(memory: Memory) {
    const snapshot = new Memory(memory.size);
    for (let address = 0; address < memory.size; address++) {
      snapshot.write(address, memory.read(address));
    }
    return snapshot.store;
  }

  assert4BitValue(value: number, message: string) {
    if (value == undefined) {
      throw new Error(message);
    }
    if (Number.isNaN(value)) {
      throw new Error(message);
    }
    if (!(value >= 0 && value < 16)) {
      throw new Error(message);
    }
  }

  assertValidInstruction(instruction: any, mnemonic: any) {
    if (typeof instruction != "function") {
      throw new Error(`Instruction not found: ${hexFormat(mnemonic)}`);
    }
  }
  assertValidRegisterValue(value: any, name: string) {
    this.assert4BitValue(value, `Register ${name} is currupted`);
  }
  assertValidMemoryAddress(address: any) {
    this.assert4BitValue(
      address,
      `Invalid memory address: ${hexFormat(address)}`
    );
  }
  assertValidMenmonic(mnemonic: any) {
    this.assert4BitValue(mnemonic, `Invalid mnemonic: ${hexFormat(mnemonic)}`);
  }

  private tick() {
    if (this.state === ProcessorState.RUNNING) {
      try {
        const address = this.registers.ip;
        this.assertValidMemoryAddress(address);

        const mnemonic = this.readAddress(address);
        this.assertValidMenmonic(mnemonic);

        const instruction = this.instructionSet[mnemonic];
        this.assertValidInstruction(instruction, mnemonic);

        const snapshot = this.snapshot;
        this.history.push(snapshot);
        instruction(this, snapshot.registers);
      } catch (e) {
        console.error(e);
        this.state = ProcessorState.CRASHED;
      } finally {
        this.registers.ip++;
      }

      setTimeout(() => {
        this.tick();
      }, this.delayBetweenInstructions);
    } else {
      console.error("Processor is not running");
    }
  }
}
const lecture_3_program = [
  ...[9, 13, 10, 14],
  ...[7, 11, 15, 7],
  ...[11, 11, 8, 13],
  ...[0, 3, 10, 0],
];
//  0  1  2  3  4  5  6  7  8  9  A  B  C  D  E  F
//                                10 11 12 13 14 15

const lecture_3_program_hex = [
  ...[0x09, 0x0d, 0x0a, 0x0b],
  ...[0x07, 0x0b, 0x0f, 0x07],
  ...[0x0b, 0x0b, 0x08, 0x0d],
  ...[0, 3, 10, 0],
];

export enum ProcessorState {
  OFF,
  RUNNING,
  PAUSED,
  HALTED,
  CRASHED,
}

export class Registers {
  ip: number = 0;
  ss: number = 0;
  r0: number = 0;
  r1: number = 0;
}

export class Memory {
  store: number[] = Array(this.size);

  constructor(readonly size: number) {
    this.clear();
  }

  clear() {
    this.store = range(0, this.size);
  }

  read(address: number): number {
    this.assertInRange(address, `Address out of range (${hexFormat(address)})`);
    const value = this.store[address];
    this.assertInRange(
      value,
      `Uninitialized memory address ${hexFormat(address)}`
    );
    return value;
  }
  write(address: number, value: number) {
    this.assertInRange(address, `Address out of range (${hexFormat(address)})`);
    this.assertInRange(value, `Address out of range (${hexFormat(address)})`);
    this.store[address] = value;
  }

  private assertInRange(value: number, error: string) {
    if (Number.isNaN(value)) {
      throw new Error(error + "( Value is not a number)");
    }
    if (typeof value == undefined) {
      throw new Error(error + "( Value is not a undefined)");
    }
    if (!(value >= 0 && value < this.size)) {
      throw new Error(error);
    }
  }
}
export interface EmulatorSnapshot {
  memory: number[];
  registers: Registers;
}

export type Instruction = (processor: Processor, registers: Registers) => void;

const halt: Instruction = (processor, registers) => {
  processor.state = ProcessorState.HALTED;
};

const add: Instruction = (processor, registers) => {
  const r0 = processor.readAddress(registers.r0);
  const r1 = processor.readAddress(registers.r1);

  processor.registers.r0 = r0 + r1;
};
const subtract: Instruction = (processor, registers) => {
  const r0 = processor.readAddress(registers.r0);
  const r1 = processor.readAddress(registers.r1);

  processor.registers.r0 = r0 - r1;
};
const increment_r0: Instruction = (processor, registers) => {
  const r0 = processor.readAddress(registers.r0);
  processor.registers.r0 = r0 + 1;
};
const increment_r1: Instruction = (processor, registers) => {
  const r1 = processor.readAddress(registers.r1);
  processor.registers.r1 = r1 + 1;
};
const decrement_r0: Instruction = (processor, registers) => {
  const r0 = processor.readAddress(registers.r0);
  processor.registers.r0 = r0 - 1;
};
const decrement_r1: Instruction = (processor, registers) => {
  const r1 = processor.readAddress(registers.r1);
  processor.registers.r1 = r1 + 1;
};
const bell: Instruction = (processor, registers) => {
  processor.bell();
};

const print: Instruction = (processor, registers) => {
  const char = processor.readAddress(registers.ss);
  processor.moveInstructionPointerForward();
  processor.print(char);
};
const load_r0_from_ss: Instruction = (processor, registers) => {
  processor.registers.r0 = processor.readAddress(registers.r0);
  processor.moveInstructionPointerForward();
};
const load_r1_from_ss: Instruction = (processor, registers) => {
  processor.registers.r1 = processor.readAddress(registers.r1);
  processor.moveInstructionPointerForward();
};
const store_r0_into_memory_at_ss: Instruction = (processor, registers) => {
  processor.writeAddress(registers.ss, registers.r0);
  processor.moveInstructionPointerForward();
};
const store_r1_into_memory_at_ss: Instruction = (processor, registers) => {
  processor.writeAddress(registers.ss, registers.r1);
  processor.moveInstructionPointerForward();
};
const jump: Instruction = (processor, registers) => {
  processor.registers.ip = registers.ss;
};
const jump_if: Instruction = (processor, registers) => {
  if (registers.r0 === 0) {
    return jump(processor, registers);
  }
};
const jump_if_not: Instruction = (processor, registers) => {
  if (registers.r0 === 0) {
    return jump(processor, registers);
  }
  processor.moveInstructionPointerForward();
};
