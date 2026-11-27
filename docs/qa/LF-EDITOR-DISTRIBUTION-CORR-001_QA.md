# LevelForge — LF-EDITOR-DISTRIBUTION-CORR-001 — QA de distribución

**Gate:** autorizado el 2026-10-29. **Estado:** IMPLEMENTADO; compilación/empaquetado y ejecución nativa pendientes de QA del usuario; NO CERRADO.

## Diagnóstico / baseline

- `npm run dist:linux`: Vite Editor y Player completaron build en Linux, pero `verify-editor-distribution.mjs preflight` detuvo electron-builder porque faltaban `build/icon.png`, `build/icon.ico`, `build/icons/256x256.png` y `build/icons/512x512.png`.
- La fuente acumulada `LevelForge_FILMMAKER_ANIM_S02_G002_CORR-001_SOURCE_BASELINE.zip` (1.084 entradas) omitía **toda** la carpeta `build/` y `.github/workflows/desktop-build.yml`.
- El icono original de LevelForge es el rombo azul/centro oscuro generado por `scripts/make-icon.mjs`. El PNG existente `electron/vendor/icon.png` no se modifica.
- `package.json` ya tenía los destinos AppImage/DEB/NSIS/Portable y los nombres de salida correctos. No se modifica el exportador de juegos.

## Corrección realizada

1. Se extendió el generador **existente** `scripts/make-icon.mjs` con `--distribution`, sin añadir dependencias ni crear otro generador: 9 PNG de 16 a 512, icono principal RGBA 512 y Windows ICO con 7 fotogramas PNG.
2. Se incorporan **archivos físicos** `build/` al SOURCE_BASELINE; no hay preflight dependiente de una generación externa, ni se desactiva el validador.
3. `verify-editor-distribution.mjs` comprueba 9 dimensiones PNG, CRC de chunks, integridad IDAT/IEND y siete entradas ICO; conserva preflight de Vite/WASM y cabeceras de artefactos.
4. Se restaura `.github/workflows/desktop-build.yml` con runners Linux y Windows, distribución sin publicación y carga de paquetes diferenciados.
5. Se agrega `npm run icons:distribution` como regeneración reproducible; su ejecución no modifica el icono de los juegos exportados.

## Evidencia de ejecución local

| Control | Resultado |
|---|---|
| `node scripts/make-icon.mjs --distribution` | PASS, 9 PNG + ICO 7 tamaños |
| `npm run dist:verify` | PASS (estructura y recursos fuente) |
| `node --test scripts/test-editor-distribution-g001.mjs` | **29 PASS / 0 FAIL** (24 históricos + 5 nuevos) |
| `node --check` en los JS/MJS modificados | PASS |
| `file` / Pillow inspección de imágenes | PNG 512 y ICO con imágenes PNG reconocidos |
| Comparación binaria marca 256px | `build/icons/256x256.png` idéntico a `electron/vendor/icon.png` |
| `npm run build` en el entorno de entrega | NO EJECUTADO (dependencias Vite ausentes) |
| `npm run dist:linux` y `npm run dist:win` | NO EJECUTADOS (sin Electron Builder instalado) |
| Binarios AppImage/DEB/Setup/Portable y ejecución real | NO GENERADOS / NO VERIFICADOS |

La prueba de cabeceras de AppImage/DEB/EXE del suite G001 usa fixtures, **no representa** una build nativa comprobada.

## Reproducción y aceptación del usuario

Desde el nuevo SOURCE_BASELINE recién extraído:

```bash
npm ci
npm run test:distribution
npm run dist:verify
npm run dist:linux
ls -lh release/LevelForge-0.26.13-linux-x86_64.{AppImage,deb}
```

Windows CMD/PowerShell desde el nuevo SOURCE_BASELINE:

```powershell
npm ci
npm run test:distribution
npm run dist:verify
npm run dist:win
```

Los artefactos esperados son `release/LevelForge-Setup-0.26.13-win-x64.exe` y `release/LevelForge-Portable-0.26.13-win-x64.exe`. Validar abrir Editor, FilmMaker y Player, importar/guardar proyectos, audio/Jolt y rutas locales.

**Regla de cierre:** ejecución real AppImage/DEB y NSIS/Portable; evidencia separada por plataforma. La instalación y el arranque no se deducen del PASS de Node.

**Fuera de alcance:** optimizar chunks Vite, `node:module` externalizado por Jolt, rediseñar logo, distribución de juegos, cambios de escenas, ECS, FilmMaker o física.

## FIX-001 — QA tras reporte del usuario «No corrigió nada»

- Baseline: `LevelForge_EDITOR_DISTRIBUTION_CORR-001_SOURCE_BASELINE.zip` (entrega anterior).
- Comportamiento defectuoso identificado: empaquetar sin invocar el generador de iconos antes de verificar su existencia.
- Corrección preventiva: `dist:prepare`, integrado antes de `electron-builder` en Linux, Windows y Filmmaker.
- Test de regresión: `node --test scripts/test-editor-distribution-g001.mjs` → **35 PASS / 0 FAIL** en entorno de desarrollo.
- `npm run dist:prepare` y `npm run dist:verify` → PASS con recursos presentes.
- Escenarios nuevos automatizados: build/ ausente, PNG corrupto, conservación de PNG válido, fallo por recurso ajeno, orden de llamadas.
- Compilación Vite y empaquetado Electron Builder: **NO EJECUTADOS** (dependencias no instaladas en este entorno).
- QA obligatorio en equipo del usuario: extraer baseline FIX-001 en carpeta nueva; `npm ci`; `npm run dist:linux`; `ls -lh release/*.AppImage release/*.deb`; ejecución AppImage. Reportar error completo si surge otro bloqueo.
- El resultado del usuario aún no demuestra cuál es el nuevo fallo que observa: no se proporcionó registro adicional tras el paquete anterior. No atribuirlo exclusivamente a esta causa.
