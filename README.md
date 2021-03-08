# Emulated 4719 processor

- [Emulated 4719 processor](#emulated-4719-processor)
  - [Purpose](#purpose)
  - [Features](#features)
  - [@TODO](#todo)
  - [Usage](#usage)

## Purpose

This is a study toy that serves no real purpose.

## Features

- Simulates the 4719 from the COMP1917 UNSW course.
- Comes with `tokenize()` and `compile()` functions that take source code and put out a `number[]` that can be used by the processor. (see `tests/compile.ts`)
- 3 runmodes:
  - GO => just run everything possible at once.
  - TIMED => automatically tick every `delayBetweenInstructions` milliseconds
  - STEPPED => you call `tick()` every time you want to execute an instruction.
- Functional frontend: https://theredhead.github.io/emulated4719/

## @TODO

- 
  
## Usage

I have faith that you can figure it out. If not, send me a line!

