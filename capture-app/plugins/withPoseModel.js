// Plugin de Expo: copia el modelo de MediaPipe (assets/models/*.task) a android/app/src/main/assets al hacer `expo prebuild`,
// que es de donde lo lee react-native-mediapipe. Descárgalo antes con `npm run fetch-model`.
const { withDangerousMod } = require('@expo/config-plugins')
const fs = require('fs')
const path = require('path')

module.exports = function withPoseModel(config) {
  return withDangerousMod(config, ['android', async (cfg) => {
    const root = cfg.modRequest.projectRoot
    const src = path.join(root, 'assets', 'models')
    const dst = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'assets')
    const files = fs.existsSync(src) ? fs.readdirSync(src).filter((f) => f.endsWith('.task')) : []
    if (!files.length) console.warn('[withPoseModel] No hay modelos .task en assets/models: ejecuta `npm run fetch-model` (la cámara no podrá seguir el cuerpo)')
    fs.mkdirSync(dst, { recursive: true })
    for (const f of files) fs.copyFileSync(path.join(src, f), path.join(dst, f))
    return cfg
  }])
}
