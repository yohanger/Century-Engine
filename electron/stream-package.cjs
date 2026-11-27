const { createWriteStream } = require('node:fs')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { pipeline } = require('node:stream/promises')

async function stageEntries(bytes, append, writeImage) {
  const JSZip = require('jszip')
  const zip = await JSZip.loadAsync(bytes)
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'levelforge-stream-'))
  try {
    for (const entry of Object.values(zip.files)) {
      if (entry.dir) continue
      const scene = /^scenes\/(.+)\.json$/.exec(entry.name)
      const file = /^files\/(.+)$/.exec(entry.name)
      let name
      if (entry.name === 'game.json') name = 'game.json'
      else if (scene) name = `scene-${encodeURIComponent(scene[1])}.json`
      else if (file) name = `asset-${encodeURIComponent(file[1])}.bin`
      else continue
      const destination = path.join(directory, name)
      await pipeline(entry.nodeStream(), createWriteStream(destination, { flags: 'wx' }))
      append(name, destination)
    }
    return await writeImage()
  } finally {
    await fs.rm(directory, { recursive: true, force: true })
  }
}

module.exports = { stageEntries }
