// Comunicación entre eventos y scripts: ejecutar un evento desde fuera (event.run / comando «Ejecutar evento») y páginas con el
// disparador «Al recibir señal». La señal en sí (game.emit / waitFor / comandos) vive en interpreter.js.
export const signalMethods = {
  /**
   * Ejecuta los comandos de una página del evento en segundo plano. Devuelve una promesa: true si terminó, false si se detuvo o no hay página.
   * Si esa página ya se está ejecutando devuelve la misma promesa (no se solapa).
   */
  _eventRun(id, { page = 0, args = [], signal = null } = {}) {
    const e = this.events?.find((x) => x.id === id)
    if (!e || !this.game) return Promise.resolve(false)
    const idx = +page > 0 ? Math.floor(+page) - 1 : e.pageIdx
    const pg = e.props.pages[idx]
    if (!pg) return Promise.resolve(false)
    e.runs ??= new Map()
    const cur = e.runs.get(idx)
    if (cur) return cur.promise
    const r = this.game.run(pg.list, { eventId: id, name: e.obj.name, args, signal, onEnd: () => { if (e.runs.get(idx) === r) e.runs.delete(idx) } })
    r.promise = r.done.then(() => !r.ctx.cancelled)
    e.runs.set(idx, r)
    return r.promise
  },
  _eventStop(id) {
    const e = this.events?.find((x) => x.id === id)
    if (!e) return 0
    let n = 0
    for (const r of e.runs?.values() || []) { r.cancel(); n++ }
    if (e.par) { e.par.cancel(); n++ }
    if (this.main?.ctx.eventId === id) { this.main.cancel(); n++ }
    return n
  },
  _eventRunning(id) {
    const e = this.events?.find((x) => x.id === id)
    return !!e && (!!e.runs?.size || !!e.par || this.main?.ctx.eventId === id)
  },
  /** Una señal llega: arranca las páginas activas con disparador «Al recibir señal» de ese nombre. */
  _signalEvents(name, data) {
    if (this._reconcilingPages) {
      (this._pageSignals ??= []).push([name, data])
      return
    }
    if (this._reconcilePages() === false) return
    const key = String(name).trim().toLowerCase()
    for (const e of this.events || []) {
      const pg = e.props.pages[e.pageIdx]
      if (!pg || pg.trigger !== 'signal' || e.off || e.stashed || String(pg.signal?.name ?? '').trim().toLowerCase() !== key) continue
      if (e.runs?.has(e.pageIdx)) continue // ya está ejecutándose
      if (pg.signal.var) this.game.setVar(pg.signal.var, data === undefined ? 0 : data)
      this._eventRun(e.id, { args: [data], signal: { name, data } })
    }
  },
  _eventsStopAll() { for (const e of this.events || []) for (const r of e.runs?.values() || []) r.cancel() },
}
