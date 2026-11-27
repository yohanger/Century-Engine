# LevelForge — LF-MESH-LOOPCUT-INTERACTIVE-G001 · QA

**Autorización exacta:** `Listo. LF-MESH-LOOPCUT-INTERACTIVE-G001 autoriza comenzar` (2026-10-27).  
**Estado:** IMPLEMENTADO · TEST AUTOMATIZADO PASS · COMPILACIÓN / QA LOCAL NO VERIFICADOS · APROBACIÓN PENDIENTE.

## Fuente de continuidad

Último SOURCE_BASELINE del Gate `LF-EDITOR-INSPECTOR-INTEGRATION-CORR-G001` (866 archivos de producción/recursos; incluye modificaciones anteriores de Codex). Para aplicar el Gate, debe conservarse esa misma base o auditar diferencias locales antes de reemplazar archivos.

## Contrato ejecutado

1. En Edit Mesh, `Ctrl+R` abre el modal `select-ring` y dibuja un anillo de quads válido bajo el cursor. El hover no modifica la geometría.
2. La rueda modifica el número de cortes entre 1 y 32 durante la selección. En fase `slide` ese número queda fijo.
3. El primer clic fija el anillo y establece el deslizamiento inicial a cero, sin Undo ni cambios de PolyMesh.
4. El movimiento posterior se proyecta sobre la arista fijada utilizando coordenadas de pantalla; funciona en la proyección de la cámara actual (perspectiva u ortográfica). Si la arista proyectada mide menos de 8 píxeles, se requiere otro ángulo para iniciar el deslizamiento.
5. **C** restablece el corte central y vuelve a tomar la posición actual del ratón como origen del desplazamiento. Se puede seguir deslizando después de pulsar C.
6. El segundo clic o Enter confirma la geometría exactamente con el `slide` mostrado. Se llama una sola vez a `run('Corte en bucle', ...)` para registrar una transacción de historial.
7. **Esc** o clic derecho cancela en cualquiera de las dos fases, sin alterar el contenido de la malla.
8. `cutParams()` desplaza todo el grupo de cortes uniformemente dentro del intervalo permitido, sin el antiguo clamp independiente que hacía coincidir muchos cortes al acercarse a los extremos.
9. Anillos sin quads o con caras/aristas degeneradas no permiten confirmación. Previsualización separada de los datos de juego; no afecta al Player.

**Limitación:** esta corrección no modifica las herramientas de Clipboard, Mesh Instances, Alt+D ni las transformaciones numéricas de Edit Mesh. Tampoco incorpora una vista previa de corte en una arista cuya proyección de pantalla es casi nula: el Editor muestra un aviso para cambiar el ángulo.

## Evidencia automatizada

| Prueba | Resultado |
|---|---|
| `node --test scripts/test-mesh-loopcut-interactive-g001.mjs` | **23 PASS, 0 FAIL** |
| Regresión Node disponible, excluyendo `test-starcat.mjs` | **1811 PASS, 0 FAIL, 18 SKIP** |
| Sintaxis JS de `cuts.js`, `session-modal.js`, `session-input.js` | **PASS** |
| `npm run build` en entorno de entrega | **NO VERIFICADO** (`vite: not found`, exit 127) |
| Electron, Editor, Player, ratón real y QA visual | **NO VERIFICADOS** |

Se probaron transiciones de modal con funciones reales de `session-modal.js` y `session-input.js` bajo dependencias de entorno simuladas, y topología con `PolyMesh`/`loopCut()`/`polyBuffers()` verdaderos. Esto no constituye prueba E2E de Electron ni de la cámara real. Se verificaron mallas cerradas y volumen con 1, 4, 16 y 32 cortes, UV/colores/pesos válidos, buffers de render/colisión finitos y round-trip de PolyMesh.

## QA local obligatorio

En tu proyecto (sin sustituir la versión de Codex), tras aplicar CHANGE y conservar backups:

```bash
cd ~/ENGINES/lf-0.26.13/lf
node --test scripts/test-mesh-loopcut-interactive-g001.mjs
npm run build
npm run electron
```

1. Crear un cubo; entrar en Edit Mesh; pulsar `Ctrl+R` y mover el cursor sobre una de sus aristas. Ver el anillo antes de hacer clic.
2. Verificar que el primer clic fija el anillo, sin generar caras ni registrar Undo.
3. Mover el ratón paralelo a la arista fijada: comprobar que el corte sigue al cursor y que el HUD muestra un valor de desplazamiento.
4. Mover la rueda antes del primer clic (1–32 cortes); confirmar que no aparecen cortes superpuestos.
5. Pulsar `C`, comprobar que vuelve al centro, deslizar nuevamente y confirmar con otro clic.
6. Repetir y confirmar con Enter. Deshacer una vez y rehacer una vez. Guardar, cerrar y reabrir la escena.
7. Repetir cancelando con Esc y luego clic derecho, en ambas fases; deben quedar intactas la geometría y selección.
8. Repetir en vistas perspectiva y ortográfica. Con una arista vista casi de frente, debe mostrarse el aviso de cámara, no insertarse geometría inválida.
9. Comprobar en Player y exportación que no aparecen líneas de previsualización.

**No marcar QA visual PASS ni compilación PASS sin ejecución local y evidencia.** Reportar capturas/logs y pasos reproducibles si surge una incidencia.

## Integridad

Gate limitado a `src/core/mesh/cuts.js`, `session-modal.js`, `session-input.js`, el nuevo test, este informe y `docs/qa/LevelForge_DB_Ledger.xlsx` (seis hojas). Sin modificaciones al Shader Graph/Dock, clipboard, instancias, objeto 3D, renderer y Player.
