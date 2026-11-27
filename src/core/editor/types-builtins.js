// IntelliSense · declaraciones de los tipos integrados de JavaScript (Array, String, Math, Promise…) en el mismo formato que game-api.d.ts.

// ---------------------------------------------------------------- tipos integrados (Array, String, Promise, Math, JSON)
export const BUILTINS = `
interface __Array {
  /** Número de elementos. */
  readonly length: number
  /** Llama a fn con cada elemento. */
  forEach(fn: (item: T, index: number) => void): void
  /** Lista nueva con lo que devuelve fn para cada elemento. */
  map(fn: (item: T, index: number) => any): any[]
  /** Lista con los elementos para los que fn devuelve true. */
  filter(fn: (item: T, index: number) => boolean): T[]
  /** Primer elemento para el que fn devuelve true (undefined si ninguno). */
  find(fn: (item: T, index: number) => boolean): T | undefined
  findIndex(fn: (item: T, index: number) => boolean): number
  /** ¿Alguno cumple fn? */
  some(fn: (item: T, index: number) => boolean): boolean
  /** ¿Todos cumplen fn? */
  every(fn: (item: T, index: number) => boolean): boolean
  reduce(fn: (acc: any, item: T, index: number) => any, initial?: any): any
  includes(value: T): boolean
  indexOf(value: T): number
  /** Añade al final; devuelve la nueva longitud. */
  push(...items: T[]): number
  /** Quita y devuelve el último. */
  pop(): T | undefined
  /** Quita y devuelve el primero. */
  shift(): T | undefined
  unshift(...items: T[]): number
  slice(start?: number, end?: number): T[]
  splice(start: number, count?: number, ...items: T[]): T[]
  concat(...items: T[][]): T[]
  /** Une los elementos en un texto. */
  join(separator?: string): string
  reverse(): T[]
  sort(compare?: (a: T, b: T) => number): T[]
  /** Elemento en esa posición (negativo = desde el final). */
  at(index: number): T | undefined
}
interface __String {
  readonly length: number
  at(index: number): string
  charAt(index: number): string
  includes(text: string): boolean
  indexOf(text: string): number
  startsWith(text: string): boolean
  endsWith(text: string): boolean
  slice(start?: number, end?: number): string
  substring(start: number, end?: number): string
  split(separator: string): string[]
  trim(): string
  toUpperCase(): string
  toLowerCase(): string
  replace(search: string, replacement: string): string
  replaceAll(search: string, replacement: string): string
  padStart(length: number, fill?: string): string
  padEnd(length: number, fill?: string): string
  repeat(count: number): string
}
interface __Number {
  /** Texto con ese número de decimales: (3.14159).toFixed(2) → "3.14". */
  toFixed(digits?: number): string
  toString(radix?: number): string
}
interface __Promise {
  then(fn: (value: T) => any): Promise<any>
  catch(fn: (error: any) => any): Promise<any>
  finally(fn: () => void): Promise<T>
}
interface Math {
  readonly PI: number
  abs(x: number): number
  floor(x: number): number
  ceil(x: number): number
  round(x: number): number
  trunc(x: number): number
  sign(x: number): number
  min(...values: number[]): number
  max(...values: number[]): number
  /** Número aleatorio entre 0 (incluido) y 1. Para enteros usa game.random(min, max). */
  random(): number
  sqrt(x: number): number
  pow(base: number, exp: number): number
  hypot(...values: number[]): number
  sin(rad: number): number
  cos(rad: number): number
  tan(rad: number): number
  atan2(y: number, x: number): number
}
interface JSON {
  parse(text: string): any
  stringify(value: any, replacer?: any, space?: number): string
}
/** Estado de la partida que ven las pantallas .ui (variable \`play\`). */
interface UiPlay {
  /** ¿Hay partida en marcha? */
  readonly on: boolean
  /** ¿El juego tiene el foco (no hay menú del editor encima)? */
  readonly focus: boolean
  /** Diálogo en pantalla (null si no hay): speaker, text, pos, shown (letras visibles), done. */
  readonly dialog: { speaker: string; text: string; pos: string; shown: number; done: boolean } | null
  /** Opciones en pantalla (null si no hay). */
  readonly choices: any
  /** Texto de la indicación de interacción («E · Abrir»). */
  readonly prompt: string
  /** Fundido de pantalla: color, alpha 0–1 y duración en ms. */
  readonly fade: { color: string; alpha: number; ms: number }
  /** Fuerza de lanzamiento cargada (0–1). */
  readonly throwCharge: number
}
/** Valor reactivo de Vue (ref / computed): léelo y escríbelo con .value (en la plantilla, sin .value). */
interface UiRef {
  value: any
}
interface Object {
  keys(o: object): string[]
  values(o: object): any[]
  entries(o: object): [string, any][]
  assign(target: object, ...sources: object[]): any
}
`
