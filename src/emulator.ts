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
    [0x08]: print, // 'print <ss>',
    [0x09]: load_r0_from_ss, // 'load <ss> into r0',
    [0x0a]: load_r1_from_ss, // 'load <ss> into r1',
    [0x0b]: store_r0_into_memory_at_ss, // 'store r0 into address <ss>',
    [0x0c]: store_r1_into_memory_at_ss, //'store r1 into address <ss>',
    [0x0d]: jump, // 'jump <ss>',
    [0x0e]: jump_if, // 'jump <ss> if r0 == 0',
    [0x0f]: jump_if_not, //  'jump <ss> if r0 != 0'
  };

  strict = true;
  registers: Registers = new Registers();
  state: ProcessorState = ProcessorState.OFF;
  history: EmulatorSnapshot[] = [];
  historyLimit = 100;
  delayBetweenInstructions = 1000;

  /**
   * make it possible for a frontend to act on BELL
   */
  bellHandler: ProcessorNotification = browserBellHandler;

  /**
   * make it possible for a frontend to act on PRINT
   */
  printHandler: ProcessorOutputHandler = LogOutputHandler;

  private _runmode: ProcessorRunMode = ProcessorRunMode.TIMED;

  get runmode(): ProcessorRunMode {
    return this._runmode;
  }
  set runmode(value: ProcessorRunMode) {
    if (this.isRunning) {
      throw new Error("Cannot change runmode while running (for now)");
    }
    this._runmode = value;
  }

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
    this.bellHandler.call(this);
  }
  print(byte: number) {
    this.printHandler.call(this, byte);
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

  private assertValidInstruction(instruction: any, mnemonic: any) {
    if (typeof instruction != "function") {
      throw new Error(`Instruction not found: ${hexFormat(mnemonic)}`);
    }
  }
  private assertValidRegisterValue(value: any, name: string) {
    this.assert4BitValue(value, `Register ${name} is currupted`);
  }
  private assertValidMemoryAddress(address: any) {
    this.assert4BitValue(
      address,
      `Invalid memory address: ${hexFormat(address)}`
    );
  }
  private assertValidMenmonic(mnemonic: any) {
    this.assert4BitValue(mnemonic, `Invalid mnemonic: ${hexFormat(mnemonic)}`);
  }
  private addSnapshotToHistory(snapshot: EmulatorSnapshot) {
    this.history.push(snapshot);
    while (this.history.length > this.historyLimit) {
      this.history.shift();
    }
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

        // put the value next to the instruction pointer in the short store
        this.registers.ss = this.readAddress(this.registers.ip + 1);
        const snapshot = this.snapshot;
        this.addSnapshotToHistory(snapshot);

        instruction(this, snapshot.registers);
      } catch (e) {
        console.error(e);
        this.state = ProcessorState.CRASHED;
      } finally {
        this.registers.ip++;
      }

      switch (this.runmode) {
        case ProcessorRunMode.TIMED:
          setTimeout(() => {
            this.tick();
          }, this.delayBetweenInstructions);
          break;
        case ProcessorRunMode.GO:
          this.tick();
      }
    }
  }
}

export type ProcessorNotification = () => void;
export type ProcessorOutputHandler = (value: number) => void;

export const browserBellHandler: ProcessorNotification = () => {
  const bell = new Audio(beepSound);
  bell
    .play()
    .then(() => {
      console.log("4719 BELL sounded");
    })
    .catch((e) => {
      console.error(
        "4719 BELL: Browser settings are preventing sound from playing."
      );
    });
};
export const LogOutputHandler: ProcessorOutputHandler = (byte: number) => {
  console.log("4719", byte);
};

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

export const enum ProcessorRunMode {
  TIMED,
  STEPPED,
  GO,
}
export class Registers {
  ip: number = 0;
  ss: number = 0;
  r0: number = 0;
  r1: number = 0;
}

export class Memory {
  store: number[] = Array(this.size);

  constructor(readonly size: number, readonly bits = 4) {
    this.clear();
  }

  clear() {
    this.store = range(0, this.size);
  }

  read(address: number): number {
    this.assertInRange(
      0,
      this.size,
      address,
      `Address out of range (${hexFormat(address)})`
    );
    const value = this.store[address];
    this.assertInRange(
      0,
      this.bits ** 2,
      value,
      `Uninitialized memory address ${hexFormat(address)}`
    );
    return value;
  }
  write(address: number, value: number) {
    this.assertInRange(
      0,
      this.size,
      address,
      `Write fail: Address out of range (${hexFormat(address)})`
    );
    this.assertInRange(
      0,
      this.bits ** 2,
      value,
      `Write fail: Value out of range (${hexFormat(value)})`
    );
    this.store[address] = value;
  }

  private assertInRange(
    min: number,
    max: number,
    value: number,
    error: string
  ) {
    if (Number.isNaN(value)) {
      throw new Error(error + " (value is not a number)");
    }
    if (typeof value == "undefined") {
      throw new Error(error + " (value is undefined)");
    }
    if (!(value >= min && value < max)) {
      throw (
        new Error(error) +
        ` value not between ${hexFormat(0)} and ${hexFormat(this.size)}`
      );
    }
  }
}
export interface EmulatorSnapshot {
  memory: number[];
  registers: Registers;
}

export type Instruction = (processor: Processor, registers: Registers) => void;

//#region Instructions
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
  const char = processor.registers.ss;
  processor.print(registers.ss);
  processor.moveInstructionPointerForward();
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
//#endregion Instructions

export enum ASM4719OpCode {
  halt = 0x00, // 'halt',
  add = 0x01, // 'add', // r0 = r0 + r1
  sub = 0x02, //'subtract', // r0 = r0 - r1,
  inc0 = 0x03, // 'inrement r0', // r0 = r0 +1,
  inc1 = 0x04, // 'inrement r1', // r1 = r1 +1,
  dec0 = 0x05, // 'decrement r0',
  dec1 = 0x06, // 'decrement r1',
  bell = 0x07, // 'ring bell',

  //2 byte instructions
  prn = 0x08, // 'print <ss>',
  ld0 = 0x09, // 'load <ss> into r0',
  ll1 = 0x0a, // 'load <ss> into r1',
  st0 = 0x0b, // 'store r0 into address <ss>',
  st1 = 0x0c, //'store r1 into address <ss>',
  jmp = 0x0d, // 'jump <ss>',
  jz = 0x0e, // 'jump <ss> if r0 == 0',
  jnz = 0x0f, //  'jump <ss> if r0 != 0'
}

export const tokenize = (code: string): string[] => {
  return code
    .replace(/\#.+?\n/g, "")
    .split(/\s/)
    .map((v) => v.trim().toLowerCase())
    .filter((v) => v.length);
};

export const compile = (code: string): number[] => {
  let opcodes: { [key: string]: number } = {};
  for (var name in ASM4719OpCode) {
    if (typeof ASM4719OpCode[name] === "number") {
      opcodes[name] = <number>(<any>ASM4719OpCode[name]);
    }
  }

  const bits = tokenize(code);
  return bits.map((value) => opcodes[value] ?? Number(value));
};
