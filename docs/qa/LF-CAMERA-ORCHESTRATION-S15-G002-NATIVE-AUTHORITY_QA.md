# S15-G002 · QA y aceptación del usuario

**Estado:** IMPLEMENTADO EN FUENTES, NODE AISLADO 15 PASS; REGRESIONES NODE 78 PASS; COMPILADO NO VERIFICADO; ELECTRON NO VERIFICADO; RUNTIME EXPORTADO NO VERIFICADO; QA LOCAL PASS NO ACREDITADO; NO APROBADO NI CERRADO.

## QA automatizado disponible

Desde la raíz de LevelForge (`package.json`) usando Node instalado:

```bash
node --test scripts/test-camera-orchestration-s15-g002.mjs
node --test scripts/test-camera-orchestration-s15-g002.mjs scripts/test-cinematics-player-integration-s05-g004.mjs scripts/test-post-s01-g002.mjs scripts/test-vscode-default-script-editor-s02-g001.mjs
npm run build
npm run vscode:prepare
npm run electron
```

- En este entorno: `test-camera-orchestration-s15-g002.mjs` **15/15 PASS** mediante harness de los métodos de cámara; conjunto Node seleccionado G002/Cinematics/Profiles/VSCode **78/78 PASS**; `node --check` de archivos cambiados PASS.
- El harness G004-20 tenía una dependencia preexistente no inyectada (`resolveAudioGroup`) y se reparó usando la función productiva; sin cambios de audio.
- El intento de instalar dependencias npm no terminó en este entorno. **No se ejecutaron** regresiones dependientes de Three.js, compilación Vite ni Electron.
- `npm run vscode:prepare` verifica/integra los tipos de la extensión VS Code. `npm run build` debe terminar con código de salida 0 para Editor y runtime del Player; el número de módulos puede variar. Construir **no equivale** a QA local.

## Prueba manual obligatoria

En **una copia segura de proyecto**, sin sobrescribir cambios locales:

1. **Camera3D principal:** sin Timeline, marcar una Camera3D `main`, comprobar posición/orientación/FOV/perfil. Ejecutar Timeline con cámara distinta y detenerlo: en recurso heredado debe recuperar FOV de la cámara base (no `g.fov` por error).
2. **Sin jugador + Timeline:** configurar plantilla Sin jugador, Camera3D en la escena y Timeline que la muestrea; iniciar Play, reproducir y comprobar que la imagen **no queda negra** durante una muestra válida.
3. **API nativa:** asociar un script existente de prueba a la escena que pueda obtener `game.findNode('Nombre exacto de cámara')?.id`, luego llamar `const lease = game.camera.acquire(id)`; comprobar que se muestra esa Camera3D. `lease.release()` debe **mantenerla viva**. Mover el nodo mediante un evento/script y verificar que la vista se actualiza; una solicitud nueva debe poder tomarla. `lease.release({ to: 'base' })` sobre un lease activo devuelve la fuente base.
4. **Conflictos:** mientras una solicitud tiene lease, iniciar Timeline de cámara; no debe desplazarlo y debe diagnosticarse el conflicto una única vez. Si Timeline ya controla una pose, `game.camera.acquire(id)` debe devolver `null`. No se deben cortar audio, comandos ni pistas sin cámara.
5. **Ciclo de vida:** eliminar/ocultar Camera3D activa durante Play, cambiar escena o detener Play; confirmar fallback seguro, sin pose de otra escena ni error sin controlar.
6. **FilmMaker:** comprobar reproducción nativa y cámara durante la sesión de autoría, sin cambiar archivos `.nfm`.
7. **Efectos:** DOF, agua, audio espacial y Camera Shake de gameplay deben seguir la fuente efectiva según su política; no duplicar shake en Timeline/FilmMaker.
8. **Runtime exportado:** repetir 1–5 en un paquete de juego ejecutable real exportado desde Editor; documentar discrepancias con Play Mode. No basta el build.
9. **FPS legacy:** comprobar caminar, mirar, saltar, interacción y manos antes/después de cámaras en un proyecto de plantilla actual. Su modernización NO corresponde a G002.

**Evidencia a devolver:** salida completa de los tres comandos de pruebas/build, logs Electron, resultado por escenario (PASS/FAIL), capturas o vídeo para cambios de vista, evidencia de runtime exportado, y cualquier error de consola. El usuario decide QA LOCAL PASS y APROBADO; después se actualiza ledger en un Gate autorizado.

### Riesgos expresamente no resueltos

- Políticas de finalización/stop/skip de **nuevos recursos Timeline**, configurador visual, blends e interrupciones quedan en Gates posteriores.
- Script público usa ID exacto y lease transitorio; no sustituye aún el sistema de comandos visuales.
- No hay benchmark de CPU/GPU, frame time p50/p95 ni optimización declarada.
