// Máquina de estados finita mínima para la IA de los animales. La MÁQUINA (los estados) se define una vez por especie y es compartida;
// el ESTADO vive en cada agente (a.state, a.t). Así cientos de agentes no cuestan memoria extra.
//
//   const machine = new StateMachine({
//     rest:  { enter(a, ctx) {…}, update(a, dt, ctx) { if (…) return 'rise' }, exit(a, ctx) {…} },
//     rise:  { … },
//   }, 'rest')
//   machine.reset(a, ctx)        // pone al agente en el estado inicial (llama a enter)
//   machine.tick(a, dt, ctx)     // update del estado actual; si devuelve el nombre de otro estado, transiciona
// Un `update` puede devolver un nombre de estado, o nada para quedarse. `enter`/`exit` son opcionales.
export class StateMachine {
  constructor(states, initial) {
    this.states = states
    this.initial = initial
    if (!states[initial]) throw new Error(`StateMachine: estado inicial «${initial}» desconocido`)
  }
  reset(a, ctx) { a.state = null; this.go(a, this.initial, ctx) }
  go(a, name, ctx) {
    const next = this.states[name]
    if (!next) throw new Error(`StateMachine: estado «${name}» desconocido`)
    if (a.state) this.states[a.state].exit?.(a, ctx)
    a.state = name; a.t = 0
    next.enter?.(a, ctx)
  }
  tick(a, dt, ctx) {
    a.t += dt
    const to = this.states[a.state].update?.(a, dt, ctx)
    if (to && to !== a.state) this.go(a, to, ctx)
  }
}
