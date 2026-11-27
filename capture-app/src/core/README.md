# Núcleo de captura de movimiento (compartido)

Estos archivos los usan **Century** (`src/core/capture/`) y la app móvil **Century Capture** (`capture-app/src/core/`).
La copia de la app se genera con `node scripts/sync-capture.mjs`: no la edites a mano (los tests comprueban que son idénticas).

| Archivo | Qué hace |
| --- | --- |
| `format.js` | Formato `.lfcap` (33 puntos de MediaPipe Pose por fotograma, claves de cámara, ediciones, capas) |
| `edit.js` | Calibración de ejes, relleno de huecos, suavizado One Euro, recorte, tomas, velocidad, espejo, temblor → `bake()` |
| `camera.js` | Orientación del móvil (sensores) → pitch/yaw/roll de las claves de cámara del Timeline; zoom → fov |
| `retarget.js` | Puntos del cuerpo → rotaciones de huesos de cualquier humanoide (Mixamo, Blender, Unreal…) |
| `simulate.js` | Poses sintéticas (pruebas y modo «Simulado» de la app) |
| `math.js` | Vectores y cuaterniones como arrays |

Solo del editor (usan three o el modelo del Timeline): `three-bridge.js`, `timeline.js`, `clips.js`.
