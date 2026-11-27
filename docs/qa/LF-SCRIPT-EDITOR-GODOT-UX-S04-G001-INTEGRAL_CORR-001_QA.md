# QA · S04 Script Editor · CORR-001 — Aislamiento de canvas en Electron

## Contexto y estado

Gate parent autorizado: `LF-SCRIPT-EDITOR-GODOT-UX-S04-G001-INTEGRAL`.

**Estado:** CORRECCIÓN DEL FIXTURE IMPLEMENTADA; NODE PASS; ELECTRON CORR-001 NO VERIFICADO; QA VISUAL LOCAL PENDIENTE; S04 NO APROBADO / NO CERRADO.

**Evidencia aportada el 2026-11-03:** `SE-E01` devuelve 19 comprobaciones PASS y 1 FAIL en «El viewport no se monta en el Script Editor». Node S04 original: 13/13 PASS. La salida del fallo no identifica el canvas que disparó la aserción.

## Diagnóstico

- **OBSERVADO:** el fixture previo comprobaba `!document.querySelector('.se-workspace canvas')` y fallaba. Esto prohíbe incluso los elementos `<canvas>` legítimos que una extensión de CodeMirror pudiera crear, como el minimapa.
- **INFERENCIA:** el minimapa es un candidato plausible porque `ScriptEditor.vue` habilita `minimap()` y `src/core/editor/theme.js` utiliza `@replit/codemirror-minimap`. No se conoce el ancestro exacto del elemento que provocó el FAIL: el runner anterior no lo imprimió.
- **CAUSA RAÍZ DEL DEFECTO DE PRUEBA:** la aserción equiparaba «cualquier canvas de la zona de trabajo» con «viewport 3D del Editor»; no distingue propiedad del elemento ni contempla el motor de edición de código.

## Corrección

El mismo fixture existente comprueba ahora que:

1. La zona `.edwin.se .se-workspace` existe.
2. No hay un alojamiento de viewport (`.viewport`, `.sp-viewport`, `.game-viewport` o `[data-viewport]`) dentro de esa zona.
3. Los canvas, si existen, son descendientes de `.cm-editor`; cualquier canvas fuera de CodeMirror provoca FAIL.
4. Un fallo muestra el identificador del viewport y una muestra de los canvas ajenos a CodeMirror para auditar el origen real.

No cambia `ScriptEditor.vue`, CodeMirror, el minimapa ni la integración del docking; no se quitan las primeras 19 verificaciones. Se añade `SE-14` al test Node para proteger el nuevo contrato del fixture.

## Pruebas efectuadas

- **Node S04 + docking + ventanas + Multiscript:** 163/163 PASS; 0 FAIL.
- **Electron CORR-001:** NO VERIFICADO en el entorno de entrega por falta de dependencias Vite/Electron instaladas.
- **Build Editor/Player de CORR-001:** NO EJECUTADO en este entorno. El fallo previo no demuestra un error de compilación.
- **QA visual local:** PENDIENTE.

Comandos desde la raíz corregida (con dependencias instaladas):

```bash
node --test scripts/test-script-editor-godot-ux-s04-g001-integral.mjs
node --test scripts/test-script-editor-godot-ux-s04-g001-integral-electron.mjs
npm run build
npm run electron
```

**Esperado:** 14/14 Node; 1/1 Electron y 20/20 comprobaciones (a confirmar por ejecución real); compilación de Editor y Player. Si Electron vuelve a fallar, devolver JSON completo de `checks` y `error` para auditar el canvas ajeno.

## Validación manual

Mantener `SE-Q01–SE-Q13` de la matriz S04 original: navegación de scripts y métodos, cambio Global/Nodo, guardado, IntelliSense, minimapa, docking flotante/acoplado y accesibilidad. La aprobación del Gate parent sigue pendiente.

## Entrega incremental

`CHANGE CORR-001` se aplica solo sobre copia idéntica del SOURCE_BASELINE S04 inicial. `SOURCE_BASELINE CORR-001` contiene el proyecto acumulado completo. No mezclar ambos ZIP ni sobrescribir cambios locales sin comparar. Preservar ejecutables Git Linux `0755`. No modificar Player, UI Designer, escenas, Assets, runtime ni dependencias.
