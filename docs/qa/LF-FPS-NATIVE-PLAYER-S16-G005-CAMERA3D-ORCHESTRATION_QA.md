# QA — S16-G005 Camera3D nativa

## Evidencia automatizada disponible

- `node --test scripts/test-fps-native-player-s16-g005-camera3d-orchestration.mjs`: 16 PASS, 0 FAIL, 0 SKIP.
- Suite seleccionada G005 + G004 + G003 + CORR001 + Input Mouse + S15-G005-CORR001/G007 + Timeline PV: **112 PASS, 0 FAIL, 0 SKIP**. Registro: `docs/qa/evidence/LF-FPS-NATIVE-PLAYER-S16-G005/node-regression.log`.
- Sintaxis JS de las fuentes cambiadas y fixture: PASS.
- `npm run build`: no ejecutó Vite, `vite: not found` (registro `build-environment.log`). **NO COMPILADO / NO VERIFICADO**.
- Editor Electron, NGM Runtime independiente, manejo real de ratón capturado y Jolt WASM: **NO VERIFICADOS**.
- La VSIX 0.1.7 fue empaquetada a partir del archivo anterior con fuentes y metadatos actuales y verificó ZIP/CRC. **Empaquetado oficial vsce y uso real en VS Code NO VERIFICADOS**.

## Instalación / preparación

Usar el SOURCE_BASELINE de G005 extraído en carpeta nueva (contiene `package.json`); no superponer CHANGE en la misma carpeta. Resguardar proyectos y modificaciones locales. Ejecutar:

```bash
npm ci
npm run vscode:prepare
node --test scripts/test-fps-native-player-s16-g005-camera3d-orchestration.mjs scripts/test-fps-native-player-s16-g004-locomotion-inputmap.mjs scripts/test-camera-orchestration-s15-g007.mjs
npm run build
npm run electron
```

## QA Editor (usuario)

1. Crear un `CharacterBody3D` activo con `CollisionShape3D` directa (cápsula), suelo sólido y visual; adjuntar el Script de Nodo G004 (locomoción) y otro con el contenido de `scripts/fixtures/fps/s16-g005-native-camera-node.js`.
2. Como hija **directa** de ese personaje crear `Camera3D` llamada exactamente **`VistaFPS`**, posición local `(0,1.65,0)`, rotación `(0,0,0)`. Marcarla **principal** y evitar otra Camera3D principal (o seleccionarla expresamente en GameManager).
3. Iniciar Play. Hacer clic en la vista del juego para capturar el ratón. Comprobar que mover el ratón cambia yaw del personaje y pitch de la Camera3D; mirar arriba/abajo no inclina físicamente el CharacterBody.
4. Probar W/A/S/D, Shift, Space con Input Map; avanzar debe seguir el yaw nativo. Verificar que cambiar selección y herramienta del Editor no decide qué cámara se reproduce.
5. Cambiar temporalmente a otra Camera3D usando Camera Orchestration, Timeline o FilmMaker. Confirmar que la prioridad de la otra fuente se conserva y, al regresar a VistaFPS, vuelve a controlarse normalmente.
6. Probar pausa, foco perdido, recuperación del foco, STOP, reinicio y guardado/carga. No debe girar al mover el ratón fuera del Play o pausado.
7. Ejecutar el proyecto en **NGM Runtime independiente** y repetir los pasos 3–6. Confirmar que el FPS heredado sigue funcionando en proyectos que aún lo emplean.
8. Instalar y comprobar VSIX 0.1.7 de `vendor/vscode-extension/` (repetir `npm run vscode:prepare` primero) y verificar `game.input.pointerDelta` sin error TS2339.

**Evidencia solicitada:** resultados de `node --test`, build, captura/vídeo de mouse look y cambios de Camera3D en Electron/NGM Runtime, `game.log` si hay incidencias. No declarar PASS local a partir de las pruebas automatizadas.
