# QA local · S16-G006-G001 — Interacción nativa

**Estado:** pendiente del usuario. Las pruebas automatizadas no equivalen a QA visual.  
**Baseline:** `LF_FPS_NATIVE_PLAYER_S16_G006_G001_NATIVE_INTERACTION_SOURCE_BASELINE.zip` (nombre del entregable del Gate).  
**Medios incluidos:** tres Scripts de Nodo, escena JSON de fixture, test Node, tipos TS y VSIX 0.1.8. Todos en las rutas de la raíz del proyecto.

## Instalación

Conservar una copia intacta de G005 y los proyectos `.lfproj`. Extraer **solo SOURCE_BASELINE** en otra carpeta; **no** aplicar CHANGE sobre esa misma carpeta. CHANGE puede aplicarse únicamente sobre una copia G005 cuyo contenido se haya comparado con las modificaciones locales; también requiere retirar el VSIX 0.1.7 sustituido.

Desde la raíz con `package.json`, instalar dependencias disponibles y ejecutar:

```bash
npm ci
node --test scripts/test-fps-native-player-s16-g006-native-interaction.mjs scripts/test-fps-native-player-s16-g005-camera3d-orchestration.mjs scripts/test-fps-native-player-s16-g004-locomotion-inputmap.mjs scripts/test-fps-native-player-s16-g003-characterbody3d-api.mjs scripts/test-node-script-s05-g001.mjs
npm run vscode:prepare
npm run build
npm run electron
```

La referencia focal obtenida en el entorno del asistente fue **83/83 PASS** (19 nuevas G006 + 64 anteriores seleccionadas). `npm run build` NO VERIFICADO por falta de Vite en dicho entorno; tampoco `vsce` ni Electron/NGM Runtime.

Extensión Flatpak: una vez verificado el empaquetado oficial, instalar `vendor/vscode-extension/levelforge-0.1.8.vsix` mediante el procedimiento habitual de la extensión y reiniciar VS Code.

## Preparar una escena nativa

1. Utilizar un `CharacterBody3D` con `CollisionShape3D` cápsula, Camera3D hija llamada `VistaFPS` y scripts G004 locomoción + G005 orientación + G006 interacción. No añadir un Spawn FPS heredado a esta escena de prueba.
2. Tener suelo físico y un `StaticBody3D` como objetivo con collider (BoxShape3D) delante de la cámara, a menos de 3 metros. Una malla sin collider no genera impacto de Jolt.
3. Adjuntar al objetivo **uno** de los dos scripts receptores incluidos: `s16-g006-interactable-target-node.js` (Signals de Nodo) o `s16-g006-interactable-event-target-node.js` (señal global para páginas de evento). No adjuntar ambos.
4. Si se utiliza Signals de Nodo, conectar `interacted` a un método receptor publicado usando el sistema de Signals existente. Si se utiliza la variante de evento, configurar una página «Al recibir señal» con nombre `fps_interaction`.
5. El script receptor se agrega al grupo `interactable` en `_ready`. Esto no modifica los Tags/Layers ni requiere un nuevo nodo especial.

## Pruebas de aceptación

- [ ] Pulsar E mirando el objetivo: se ejecuta una sola interacción; mantener E no la repite.
- [ ] Soltar y volver a pulsar: se realiza una nueva interacción.
- [ ] Reasignar `interact` en Input Map: funciona con la nueva tecla.
- [ ] Mirar una pared con colisión delante del objetivo: no interactúa a través de ella.
- [ ] Mirar a un objeto no perteneciente al grupo: no ejecuta métodos ni arroja errores por frame.
- [ ] Girar horizontal y verticalmente: el rayo procede de la Camera3D hija, no de la selección del Editor.
- [ ] Cambiar la selección o el Inspector durante Play: no cambia la interacción.
- [ ] Activar Timeline/FilmMaker u otra Camera3D: el personaje deja de interactuar hasta recuperar la autoridad de cámara.
- [ ] Probar receptor Signal de Nodo: llega al método conectado exactamente una vez.
- [ ] Probar receptor de evento (en prueba separada): llega a la página «Al recibir señal» una vez.
- [ ] Pausar, STOP y reiniciar: sin métodos disparados desde referencias inválidas.
- [ ] Comprobar en LevelForge Editor y en NGM Runtime independiente.

Devolver el resultado Node, compilación, evidencia visual/funcional de Editor y NGM Runtime, errores de consola/game.log si aparecen. No marcar PASS local únicamente por esta guía.

## Riesgos conocidos

El motor aún preserva el FPS/Spawn heredado durante S16. No configurar un objeto con doble entrada legacy + nativa y atribuir el resultado a G006; la eliminación de esa duplicación depende de G007/G008. Las pruebas Node de física/harnesses históricos que fallaban ya en G005 permanecen separadas; no se han alterado para forzar un PASS.
