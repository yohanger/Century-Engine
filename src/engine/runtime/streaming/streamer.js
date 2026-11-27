import { chunkDistance } from './config.js'

/** Una instancia por partida, con una cola común para las versiones cercana y lejana. */
export class WorldStreamer {
  constructor({ chunks, parallel, prepare, mount, onError }) {
    this.parallel = parallel
    this.prepare = prepare
    this.mount = mount
    this.onError = onError
    this.tiles = chunks.map(chunk => ({ chunk, distance: Infinity, near: {}, far: {} }))
    this.pending = 0
    this.closed = false
  }

  update(point, now) {
    if (this.closed) return
    for (const tile of this.tiles) {
      const { chunk, near, far } = tile
      tile.distance = chunkDistance(chunk, point)
      this.target(near, chunk.sceneId, tile.distance, chunk.preload, chunk, now)
      this.target(far, chunk.distantSceneId, tile.distance, chunk.distantRange, chunk, now)
      this.refreshVisibility(tile)
    }
    this.pump()
  }

  target(entry, id, distance, range, chunk, now) {
    entry.id = id
    const resident = !!(entry.instance || entry.task || entry.wanted)
    if (id && distance <= range + (resident ? chunk.unloadMargin : 0)) {
      entry.wanted = true
      entry.outsideSince = undefined
      return
    }
    entry.wanted = false
    entry.failed = false
    entry.outsideSince ??= now
    if (entry.instance && now - entry.outsideSince >= chunk.unloadDelay) {
      entry.instance.dispose()
      entry.instance = null
    }
  }

  refreshVisibility({ near, far }) {
    far.instance?.show(!near.instance)
  }

  pump() {
    if (this.closed || this.pending >= this.parallel) return
    const queue = this.tiles.flatMap(tile => [
      { tile, entry: tile.near, detail: true },
      { tile, entry: tile.far, detail: false },
    ]).filter(({ entry }) => entry.wanted && !entry.instance && !entry.task && !entry.failed)
    queue.sort((a, b) => a.tile.distance - b.tile.distance || Number(b.detail) - Number(a.detail))
    for (const item of queue.slice(0, this.parallel - this.pending)) this.load(item)
  }

  load({ tile, entry, detail }) {
    this.pending++
    entry.task = (async () => {
      let data
      try {
        data = await Promise.resolve().then(() => this.prepare(entry.id, this.signal))
        if (data && !this.closed && entry.wanted) {
          const instance = this.mount(data, tile.chunk, detail)
          const release = data.release
          entry.instance = {
            show: visible => instance.show(visible),
            dispose() { try { instance.dispose() } finally { release?.() } },
          }
          data = null
          this.refreshVisibility(tile)
        }
      } catch (error) {
        if (!this.closed && entry.wanted) {
          entry.failed = true
          this.onError?.(error, entry.id)
        }
      } finally {
        data?.release?.()
        entry.task = null
        this.pending--
        this.pump()
      }
    })()
  }

  get signal() { return (this.controller ||= new AbortController()).signal }

  async settleNearby(point, now) {
    this.update(point, now)
    const near = this.tiles.map(tile => tile.near).filter(entry => entry.wanted)
    while (!this.closed && near.some(entry => !entry.instance && !entry.failed)) {
      const tasks = this.tiles.flatMap(tile => [tile.near.task, tile.far.task]).filter(Boolean)
      if (!tasks.length) break
      await Promise.race(tasks)
    }
  }

  close() {
    if (this.closed) return
    this.closed = true
    this.controller?.abort()
    for (const { near, far } of this.tiles) {
      near.instance?.dispose()
      far.instance?.dispose()
    }
  }
}
