# LF-RESOURCE-HISTORY-CORR-G001 — Corrección de Undo/Redo de recursos

**Autorización literal recibida:** `Listo. LF-RESOURCE-HISTORY-CORR-G001 autoriza comenzar` (2026-10-27).

**Estado actual:** APROBADO POR EL USUARIO · TEST AUTOMATIZADO PASS · BUILD EDITOR Y PLAYER PASS (evidencia local posterior). QA visual de Electron/Player NO VERIFICADO.

## Incidencia de entrada y causa raíz

El usuario ejecutó `scripts/test-resource-inspector-g003.mjs` en `~/ENGINES/lf-0.26.13/lf` y obtuvo 15 PASS y 2 FAIL: RI3-16 (Undo/Redo GameManager) y RI3-17 (Undo/Redo `.post`). La reproducción sobre el SOURCE_BASELINE G003 confirmó ambos fallos antes de modificar producción.

**Causa raíz demostrada:** `src/core/state/history.js` omitía `profiles` y `gameManagers` en `captureEntry()` y `applyEntry()`. Además, `touchProfile()` solo marcaba datos como modificados, sin registrar un punto de historial. El Editor de perfiles recibía cambios continuos de campos numéricos y colores; crear un commit por cada muestra del arrastre generaría entradas innecesarias.

## Corrección aplicada

- `src/core/state/history.js`: incorpora capturas y restauración de `profiles` y `gameManagers` en el historial existente. Al deshacer o rehacer un perfil con vista previa activa, el editor recibe la versión restaurada para evitar referencias obsoletas. No fuerza a activar la previsualización si el usuario está en modo Antes.
- `src/core/state/profiles.js`: `touchProfile()` normaliza y actualiza la previsualización durante una edición; registra `commit('Editar perfil')` cuando se confirma la operación. Reutiliza `markDirty()` durante cambios continuos.
- `src/components/ParamForm.vue`: mantiene el evento `change` existente y añade `commit` cuando el control confirma un valor. Para NumberField y ColorInput, respeta sus señales de fin de gesto. Es una modificación indispensable para no generar entradas por cada actualización de slider/color; no afecta a formularios que no escuchan `commit`.
- `src/components/ProfileEditor.vue`: distingue previsualización inmediata de confirmación final. Toggle, selectores y propiedades directas registran la acción concluida; arrastres numéricos y de color consolidan su historial.

**Preservado:** materiales, selección e IDs de recursos, Gameplay GameManager, renderizador, Shader Graph, escenas, Player, Jolt, formatos de proyecto y datos de los recursos. Se conserva el historial de fallos iniciales de G003, sin convertirlo retroactivamente en PASS.

## Evidencia de pruebas ejecutadas

| Comprobación | Resultado |
|---|---|
| Antes de corregir: G003 | 15 PASS / **2 FAIL** confirmados |
| Después: G003 | **17 PASS / 0 FAIL / 0 SKIP** |
| G001 + G002 + G003 | **55 PASS / 0 FAIL** |
| Suite nueva `test-resource-history-corr-g001.mjs` | **15 PASS / 0 FAIL** |
| Regresión Node disponible (sin starcat) | **1713 PASS / 0 FAIL / 18 SKIP** |
| `node --check` en módulos de estado modificados | PASS |
| `npm run build` | NO VERIFICADO en el entorno de entrega (`vite: not found`, exit 127) |
| `test-starcat.mjs` | Excluido: requiere Three.js ausente en el entorno de entrega |
| Electron / Player / QA visual | NO VERIFICADO |

La suite nueva comprueba Undo/Redo de GameManager y `.post`, ejecución de Redo, creación y eliminación de recursos, preservación de ID y referencias, materiales y objetos, previsualización restaurada, modo Antes y consolidación de edición continua. Algunas comprobaciones de Vue son estructurales, no E2E; se distinguen explícitamente de una prueba visual.

## Instalación local — Solo CHANGE (no descargar SOURCE_BASELINE)

**Precondición:** carpeta activa ya actualizada con G001, G002 y G003, sin cambios locales incompatibles. Comprobar la presencia de `scripts/test-resource-inspector-g003.mjs` y conservar copia de seguridad de cualquier archivo local modificado antes de aplicar el ZIP.

Desde `~/ENGINES/lf-0.26.13/lf`, suponiendo que el CHANGE está en `~/Downloads/`:

```bash
cd ~/ENGINES/lf-0.26.13/lf
unzip -l ~/Downloads/LevelForge_RESOURCE_HISTORY_CORR_G001_CHANGE.zip
# Tras comparar los archivos locales afectados y conservar copia de seguridad:
unzip -o ~/Downloads/LevelForge_RESOURCE_HISTORY_CORR_G001_CHANGE.zip -d .
node --test scripts/test-resource-inspector-g003.mjs scripts/test-resource-history-corr-g001.mjs
npm run build
npm run electron
```

**Resultado esperado de tests:** 32 PASS, 0 FAIL (17 G003 + 15 corrección). Ejecutar `npm run build` hasta que termine; un `^C` supone compilación interrumpida, no un FAIL demostrado.

**QA manual a cargo del usuario:** crear/seleccionar GameManager, modificar Player y cámara, deshacer y rehacer; editar un `.post` con slider numérico, toggle y color, deshacer y rehacer; verificar Antes/Después, una sola acción de historial por gesto, persistencia y materiales compartidos. Enviarnos logs y capturas si aparece un error. La ausencia de esas evidencias significa QA LOCAL NO VERIFICADO.

**No tocar:** `node_modules`, escenas, proyectos guardados ni módulos ajenos al CHANGE. Conservar el SOURCE_BASELINE anterior y ambos ZIP hasta confirmar la continuidad. La carpeta de QA aislada puede eliminarse tras conservar evidencia; no eliminar copias locales modificadas sin comparación.

## Estado y continuidad

La corrección resolvió los dos fallos automatizados detectados en G003 y recibió **aprobación expresa del usuario** el 27 de octubre de 2026. La prueba local conjunta terminó con **32 PASS y 0 FAIL**, y `npm run build` terminó correctamente para Editor y Player. Electron se inició pero el proceso se interrumpió con `Ctrl+C`; su QA visual no está acreditado. Se autoriza el cierre documental/técnico del Sprint en `LF-RESOURCE-INSPECTOR-S01-CLOSE-G001`, manteniendo el QA visual pendiente y Shader Graph fuera de este alcance.
