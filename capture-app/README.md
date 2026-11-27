# Century Capture (Android)

App de **captura de movimiento con el móvil** para Century: grabas el cuerpo con la cámara (IA de pose, sin traje) y, si quieres, la
**cámara virtual** (orientación del móvil); editas las tomas aquí mismo como en un editor de vídeo y exportas un `.lfcap` que Century
convierte en animación de huesos de tu personaje y en una cinemática del Timeline.

React Native + Expo (SDK 52), JavaScript. Detección de pose: [MediaPipe Pose Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker)
mediante `react-native-mediapipe` + `react-native-vision-camera`.

## Pantallas

1. **Biblioteca**: tus capturas (se guardan en el móvil), *Nueva captura*, *Abrir .lfcap*, borrar (toca ✕ dos veces).
2. **Grabar**: fuente **Cámara** (trasera/frontal) o **Simulado** (actor sintético para probar sin cámara), *Solo cuerpo* o *Cuerpo + cámara
   del móvil*, cuenta atrás de 3 s, contador de fps y fotogramas. Consejo: móvil quieto (trípode o apoyado) a 2–3 m, todo el cuerpo a
   la vista, buena luz y **empieza de frente y erguido** un segundo (la app calibra los ejes con esa postura).
3. **Editor** (se guarda solo):
   - **Recorte**: *Inicio aquí*, *Fin aquí*, *Dividir aquí* (cada trozo es una toma → un clip y una cinemática en Century), velocidad.
   - **Movimiento**: suavizado (filtro One Euro: quita el temblor sin frenar los gestos rápidos), espejo izquierda↔derecha.
   - **Cámara**: encuadres rápidos (general, medio, primer plano, picado, contrapicado, lateral, espalda), distancia/altura/ángulo/zoom,
     *◆ Clave aquí*, y **pase de cámara**: se reproduce la toma y la app graba hacia dónde apuntas el móvil sobre ese encuadre.
   - **Efectos**: capas en el tiempo — **Texto** (subtítulo), **Fundido** (a/desde negro), **Barras de cine**, **Temblor de cámara**.
   - **Exportar**: comparte el `.lfcap` (Drive, WhatsApp, correo, cable USB…).
   - Vista previa: muñeco de palitos desde la cámara virtual 🎥, de frente, de lado o desde arriba, con subtítulos, fundidos y barras.

## En Century

Panel **Animación → «📱 Importar .lfcap…»**: eliges las tomas, el modelo con huesos (glTF/GLB con esqueleto humanoide: Mixamo, Blender,
Unreal…) y el actor de la escena. Se crea un clip de huesos por toma y, si quieres, una cinemática (cámara del móvil anclada al actor,
*Reproducir animación*, subtítulos, fundidos y barras). Ver la sección «Captura de movimiento» del README principal.

## Compilar e instalar (Android)

La cámara con IA usa código nativo: **no funciona en Expo Go**; hace falta un APK o una build de desarrollo.

```bash
cd capture-app
npm install
npm run fetch-model            # descarga pose_landmarker_full.task a assets/models/ (o: npm run fetch-model -- lite)
```

**Opción A — APK en la nube (sin Android Studio):**
```bash
npm install -g eas-cli && eas login
npm run build:apk              # eas build -p android --profile preview → enlace para descargar el .apk
```

**Opción B — en tu PC con Android Studio / SDK** (móvil con depuración USB):
```bash
npx expo prebuild -p android   # genera android/ y copia el modelo .task a android/app/src/main/assets (plugin withPoseModel)
npx expo run:android           # compila e instala en el móvil conectado
# APK suelto: cd android && ./gradlew assembleRelease  → android/app/build/outputs/apk/release/
```

Después de instalar una build de desarrollo, `npm start` sirve el JavaScript con recarga en caliente.

**Vista previa en el navegador** (sin cámara, con el actor simulado y descarga del `.lfcap`): `npm run web`.

## Pruebas

```bash
npm test                       # operaciones del editor y camino captura → .lfcap → Century (Node, sin móvil)
npm run bundle-check           # empaqueta el JavaScript para Android (Metro + Hermes) para detectar errores de importación
npm run build:web && (python3 -m http.server 5300 --directory dist-web &) && python3 scripts/test-web.py   # interfaz en el navegador
```

## Estructura

- `src/core/` — **copia** del núcleo de Century (`src/core/capture/`): formato `.lfcap`, calibración, suavizado, tomas, cámara, retarget.
  No la edites aquí: cambia `src/core/capture/` en Century y ejecuta `node scripts/sync-capture.mjs`.
- `src/pose/` — fuentes: `camera.js` (MediaPipe; `camera.web.js` en navegador), `simulated.js`, `sensors.js` (orientación del móvil).
- `src/editorOps.js` — operaciones del editor (sin React, con pruebas). `src/screens/` — Biblioteca, Grabar, Editor. `src/ui/` — controles,
  línea de tiempo, muñeco SVG. `src/storage.js` — biblioteca en el móvil (`storage.web.js` en navegador).
- `plugins/withPoseModel.js` — copia el modelo `.task` a Android en `expo prebuild`.

## Límites

- Una persona a la vez, cuerpo entero (33 puntos): sin dedos ni expresiones faciales.
- Sin torsión de huesos y animación *en el sitio* (la raíz no se desplaza; muévela en Century con una pista de Nodo).
- La posición de la cámara no se rastrea en el espacio (no se usa ARCore): la eliges con los encuadres; el móvil aporta orientación y zoom.
- Probado aquí: la lógica (Node), el empaquetado para Android y la interfaz en navegador. **No probado en un móvil real** (cámara, MediaPipe
  nativo, sensores): si algo falla al compilar o al detectar, el modo *Simulado* sigue funcionando y el resto de la app también.
