# QA · LF-CINEMATICS-VIEWER-S05-G002-INTEGRAL

**Baseline:** S05-G001 (Gate contractual), autorización literal para G002-INTEGRAL.  
**Resultado de implementación:** nuevo visor Cinematics solo lectura, catálogo importaciones FilmMaker, acceso legado a clips de gameplay desde Assets y preservación de runtime.  
**Estado actual:** IMPLEMENTADO; QA LOCAL PENDIENTE. Electron embebido, build Editor/Player y reproducción exportada NO VERIFICADOS en el entorno del asistente.

## Contrato y evidencia automatizada

- `scripts/test-cinematics-viewer-s05-g002.mjs`: 20 pruebas nuevas de origen, normalización, clips, docking antiguo, edición separada, ausencia de autoría, Inspector, preview seguro y restricciones de carpeta.
- Regresión Node anterior S02/S03/S04: 73 casos. **93/93 Node PASS** (ejecución actual). Estas pruebas no sustituyen render, interacción Vue ni ejecución Jolt.
- `scripts/test-cinematics-viewer-s05-g002-electron.mjs` y `scripts/fixtures/editor/cinematics-viewer-s05-g002.html`: escenario de integración Electron embebido, **27 comprobaciones previstas**, NO VERIFICADO hasta ejecución local.
- Build y docs:check no completaron por dependencias faltantes (`vite` y `marked`); NO VERIFICADOS. QA Player/First Person/Jolt PENDIENTE.

## Ejecución desde SOURCE_BASELINE

```bash
npm ci
node --test scripts/test-cinematics-viewer-s05-g002.mjs scripts/test-timeline-ux-integration-s04-g004.mjs scripts/test-timeline-node-method-track-s04-g003.mjs scripts/test-timeline-interpolation-s04-g002.mjs scripts/test-timeline-hierarchy-dnd-s04-g001.mjs scripts/test-temporal-context-menu-s03-g001.mjs scripts/test-temporal-inspector-s02-g001.mjs
node --test scripts/test-cinematics-viewer-s05-g002-electron.mjs
npm run docs:check
npm run build
npm run electron
```

## QA local obligatorio (usuario)

1. Abrir proyecto previo con `project.timelines` de usuario y `project.animations`; confirmar que no se pierden ni se convierten en películas.
2. Abrir dock **Cinematics**; comprobar estado vacío sin importaciones FilmMaker y ausencia absoluta de controles para crear/duplicar/grabar/editar películas, pistas, claves o eventos.
3. Importar `.nfm` de **Nether FilmMaker** desde Cinematics o Assets; confirmar pases/montaje dentro de `Assets/Cinematics`, origen y selección por ID. La captura de actor se conserva como clip fuera de Cinematics.
4. Comprobar clips históricos desde Assets → **Editor de clips**: crear/abrir/editar/deshacer/guardar/reabrir sin abrir Cinematics; revisar rutas de `Animación` usadas por eventos y scripts.
5. Seleccionar una película: Inspector **solo lectura** con film, duración, escena y pistas. Seleccionar otro recurso y comprobar que no queda Inspector obsoleto.
6. Reproducir/pausar/seek/stop desde Cinematics. En Edit Mode **no** ejecutar comandos/métodos/audio; las poses originales y cámara deben restaurarse al ocultar/cerrar/cambiar escena. Las funciones completas deben continuar en Play/Player.
7. Abrir película original y timeline manual con nombres parecidos; solo el marcado aparece en Cinematics. Duplicar un importado en Timeline genera secuencia manual, no segunda película FilmMaker.
8. Comprobar dock previo `anim` acoplado/flotante, restaurar layout, panel estrecho **260 px**, comprobar scroll y controles sin recortes graves.
9. Exportar/reabrir `.lfproj` y Player con plantilla First Person y Jolt. Verificar que la reproducción de timelines y clips sigue funcionando. La incidencia previa de la plantilla sin controlador no forma parte de este Gate.
10. QA visual contra diseño de LevelForge (densidad profesional, estados vacíos, botones, menús, selección).

Si hay una incidencia, devolver captura o screencast con pasos. No se re-solicitan los logs de Gates anteriores aprobados.

## Estados y próximos trabajos

- **S05-G001:** Amendment CA-001 SUPERSEDIDO donde diverge; CA-002 ratificado por autorización G002, no implica QA.
- **S05-G002:** IMPLEMENTADO; Node 93/93 PASS; Electron/build/docs/QA LOCAL NO VERIFICADOS o pendientes.
- **Próximo:** cierre de integración/QA Cinematics, sin mezclar nodos 3D como referencias dinámicas de Timeline ni instalación integrada de VS Code (pendientes al final).
