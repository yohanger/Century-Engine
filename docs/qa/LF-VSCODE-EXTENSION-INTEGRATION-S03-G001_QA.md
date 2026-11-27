# LF-VSCODE-EXTENSION-INTEGRATION-S03-G001 · QA y entrega

Fecha: 2026-11-04. Estado: **IMPLEMENTADO · QA LOCAL PENDIENTE · NO APROBADO · NO CERRADO**.
Base de comparación: LevelForge_CINEMATICS_PLAYER_INTEGRATION_S05_G004_SOURCE_BASELINE(1).zip, 2.007 archivos; aprobado por el usuario.

## Resultado y límites

| Comprobación ejecutada | Evidencia |
| --- | --- |
| Node VS Code | 33/33 PASS: 20 del Gate y 13 de workspace/editor externo |
| Regresión Cinematics/Timeline | 130/130 PASS |
| Regresión integración y callbacks Signals | 34/34 PASS |
| docs:check | PASS, incluidas 12/12 pruebas del portal |
| Compilación Editor y Player | COMPILADO, ambos builds finalizados; advertencias de tamaño de chunks conservadas |
| Linux unpacked con electron-builder | Empaquetado completado; VSIX, descriptor, lanzador, puente y semver comprobados en recursos/ASAR |
| Suite histórica de distribución | 33 PASS / 2 FAIL: DIST-16 y DIST-CORR-05 por .github/workflows/desktop-build.yml ausente también en G004 |
| Electron S03 y regresión S02 | NO VERIFICADO: no arranca el renderer sin servidor X/DISPLAY. No se obtuvo resultado del fixture |
| VS Code real | NO VERIFICADO: no existe un CLI operativo en este entorno |
| Flathub real, Windows real, AppImage ejecutado | NO VERIFICADO |
| QA local / aprobación S03 | PENDIENTE |

Los dos fallos de distribución se reprodujeron contra los archivos originales del baseline mediante selección de esos mismos tests. No se inventó un workflow para ocultarlos. La distribución unpacked demuestra contenido empaquetado, no ejecución del Editor, instalación real de extensiones ni portabilidad Windows. Los logs están en `docs/qa/evidence/LF-VSCODE-EXTENSION-INTEGRATION-S03-G001/`.

## Implementación

- `electron/vscode.cjs`: detecta CLI operativo, consulta/prepara extensión y abre con esa misma instalación. Conserva argumentos separados y el CLI Windows sin shell.
- `electron/vscode-extension.cjs`: SemVer, verificación del VSIX incluido, instalación/actualización y consulta posterior; preparación concurrente compartida sin duplicar apertura ni persistir un estado falso.
- Flatpak: VSIX temporal bajo `~/.var/app/com.visualstudio.code/cache/levelforge/`; comprueba lectura dentro del sandbox. No depende de rutas ASAR ni montajes de AppImage ni modifica overrides persistentes. Se elimina solo el temporal creado por esta operación.
- `electron/main.cjs`: conserva validación de raíz y script; errores con Reintentar/Cancelar. La ruta del paquete procede del proceso principal.
- `state/vscode.js`: mantiene sincronización y tipos; informa preparación/instalación y respeta cancelación.
- `prepare-vscode-extension.mjs`: vsce 4.1.0 empaqueta la extensión 0.1.3 existente, comprueba tipos, identidad y contenido. No publica ni descarga paquetes al abrir una distribución instalada. No reescribe el VSIX si sus fuentes no cambian.
- `electron-start.mjs`, `electron-dev.mjs` y comandos de distribución preparan el recurso automáticamente. Linux y Windows incluyen VSIX y descriptor fuera de ASAR. semver 7.8.6 es dependencia de ejecución; vsce solo de desarrollo.
- README, portal, cierre G004 y seis hojas del ledger actualizados. Ningún cambio en runtime, Jolt, escenas, formatos ni API de Signals.

La versión superior instalada se conserva. La prioridad sigue siendo nativo, Insiders, VSCodium y finalmente Flathub. No se añade selector ni se cambia el perfil del CLI. Una extensión deshabilitada por el usuario no se habilita automáticamente. Una ventana de VS Code ya abierta puede necesitar recarga para activar la versión nueva; listar una extensión instalada no demuestra activación.

## Instalación de la entrega

1. Conserva G004 aprobado y tus proyectos. Extrae el nuevo SOURCE_BASELINE completo en una carpeta nueva:
   `~/Desktop/LevelForge_VSCODE_EXTENSION_INTEGRATION_S03_G001_SOURCE_BASELINE/`
2. Los ZIP contienen rutas relativas desde la raíz del motor. Deben quedar `package.json`, `electron/`, `src/` y `vendor/` dentro de esa carpeta.
3. CHANGE contiene solamente nuevos/modificados para revisión o aplicación sobre una copia limpia de G004. No se aplica encima del nuevo SOURCE_BASELINE ni sobre proyectos de juego. No hay archivos eliminados.
4. No reemplaces proyectos `.lfproj`, escenas, Assets del usuario, configuración de VS Code ni cambios locales. Conserva G004 hasta aprobar este Gate. Los temporales, node_modules, dist y release no forman parte de la entrega.

Desde la raíz extraída:

```bash
npm ci
node --test scripts/test-vscode-extension-integration-s03-g001.mjs scripts/test-vscode-project-workspace-s01-g001.mjs scripts/test-vscode-default-script-editor-s02-g001.mjs
node --test scripts/test-vscode-extension-integration-s03-g001-electron.mjs scripts/test-vscode-default-script-editor-s02-g001-electron.mjs
npm run docs:check
npm run build
npm run electron
```

Esperado: 33/33 Node; Electron S03 con 12 comprobaciones y S02 con 19 (ambos fixtures usan puente simulado, no prueban instalación real); docs:check 12/12; Editor/Player compilados. No se exige instalar VSIX manualmente ni ejecutar comandos del CLI para el uso normal.

## QA funcional prioritario

| Caso | Acción y resultado esperado |
| --- | --- |
| Instalación limpia | Con VS Code instalado y LevelForge ausente en sus extensiones, abrir un script desde Assets. El motor instala 0.1.3, verifica y abre carpeta/archivo correctos |
| Actualización | Con la versión anterior 0.1.2, repetir: queda 0.1.3, preservando scripts y configuración |
| Reapertura | Abrir de nuevo: consulta versión pero no reinstala |
| Superior | En entorno de QA con versión superior, conserva esa versión |
| Flatpak | Repetir con com.visualstudio.code, sin CLI nativo disponible. Probar también LevelForge distribuido, con el proyecto en una ruta con espacios |
| Error recuperable | En copia de QA, hacer inaccesible el VSIX incluido: aparece causa; restaurarlo y pulsar Reintentar completa la apertura. Cancelar termina sin éxito falso |
| VS Code ausente | Informa que no está disponible; no intenta instalar VS Code |
| Varias instalaciones | La extensión se comprueba y se abre en la misma instalación según la prioridad documentada |
| Activación real | En VS Code verificar comandos LevelForge, snippets lf-, sugerencias game.*, node.connect y node.emit_signal. Recargar ventana si estaba abierta; comprobar que la extensión no esté deshabilitada |
| Datos del proyecto | jsconfig propio intacto; abrir dos proyectos con scripts homónimos, guardar fuera, guardar en LevelForge y reabrir |
| Signals y gameplay | Editar receptor, guardar, elegir método en Signals, ejecutar Play; IDs, modo Nodo/Global, asignaciones y conexiones conservados |
| Windows | Repetir instalación, actualización y reapertura con VS Code real, rutas con espacios y Editor distribuido |

Runner adicional de activación real con perfil y extensiones aislados:

```bash
node scripts/test-vscode-extension-real-s03-g001.mjs --flatpak
```

Para VS Code nativo o Windows, omitir `--flatpak`. Comprueba instalación real, activación de la extensión instalada, comandos, snippets, sugerencias JavaScript y segunda apertura sin reinstalar. No elimina ni sustituye las extensiones habituales del usuario. Su ejecución en este entorno quedó NO VERIFICADA; no sustituye el QA del flujo visual completo desde LevelForge.

Para distribución del Editor, los comandos existentes `npm run dist:linux` y `npm run dist:win` preparan el VSIX automáticamente. Aquí solo se comprobó Linux unpacked; no se entregan instaladores ni builds en los ZIP.

## Evidencia a devolver y continuidad

Tras tu QA, «Aprobado» se registrará como QA LOCAL PASS declarado sin volver a exigir logs. Si falla, devuelve la acción, mensaje completo, instalación de VS Code utilizada, versión de extensión antes/después y salida del test afectado. No hace falta enviar credenciales ni el proyecto completo.

G004 queda cerrado documentalmente por tu aprobación previa. S03-G001 continúa pendiente de QA/aprobación. Referencias dinámicas de nodos 3D en Timeline y renombrado seguro siguen pendientes; no se implementaron en este Gate.
