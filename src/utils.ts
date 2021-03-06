/** @format */

export function hexFormat(value: number, length = 2): string {
  return Number(value).toString(16).toUpperCase().padStart(length, "0");
}

export function range(start: number, length: number): number[] {
  const result = [];
  for (let ix = start; ix < start + length; ix++) {
    result[ix] = 0;
  }
  return result;
}
