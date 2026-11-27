# LevelForge · LF-SCRIPT-EDITOR-GODOT-UX-S04-G001-INTEGRAL

**Gate autorizado:** `Listo. LF-SCRIPT-EDITOR-GODOT-UX-S04-G001-INTEGRAL autoriza comenzar`.

**SOURCE_BASELINE parent:** `LevelForge_EDITOR_DOCKING_S03_G001_INTEGRAL_CLOSE_SOURCE_BASELINE.zip`, que ya incorpora la corrección VCS de Git embebido. Se preserva `CA-001/002/003` del docking y la compatibilidad S01/S02.

## Objetivo y mecanismo

Profesionalizar el editor de scripts existente con un área de autoría más cercana a Godot, sin copiar la UI ni sustituir CodeMirror o el modelo de scripting. La intervención extiende exclusivamente `src/components/ScriptEditor.vue`; el store del proyecto sigue siendo el propietario de todos los scripts, el guardado y sus modalidades de ejecución. `FloatingEditorWindow` sigue proporcionando acoplamiento y ventanas flotantes.

## Cambios implementados

- Navegador lateral de **scripts reales del proyecto**, agrupados por carpeta, ordenados y filtrables sin distinción de mayúsculas ni tildes. Seleccionar un script utiliza el `openScriptEditor(id)` existente, sin tab/documento paralelo.
- Navegación de **métodos y regiones** reutilizando `outlineOf` y `goTo`; destaca el símbolo correspondiente al cursor. Panel colapsable; no se introdujo un parser adicional.
- Barra de comandos con acciones existentes y operativas: abrir scripts (Ctrl+P), buscar, diagnósticos, formatear, minimapa, documentación, VS Code, guardar. Documentación y edición externas conservadas.
- Nueva estructura visual: encabezado, comandos, documento activo, navegación izquierda, breadcrumbs, CodeMirror central y barra de estado. Paleta de grafito discreta, indicadores de selección, foco accesible, responsive y movimiento reducido.
- Cambio de script reconfigura el `Compartment` del IntelliSense según **Global/Nodo**. El cambio de script actualiza el documento de CodeMirror desde el store sin marcar falsamente un proyecto como modificado. Código de edición continúa pasando por `setScriptCode`.
- El formateo asíncrono rechaza resultados si mientras tanto cambió el recurso o su texto, para evitar sobrescrituras.
- Preferencias exclusivamente de presentación `lf.se.navigator`, `lf.se.outline`, `lf.se.minimap`, mediante el almacenamiento local existente.

## Restricciones preservadas

No se modifica el motor de scripts, la API `game`/`node`, el sistema Multiscript/Signals, el runtime, Player, exportación, generación de `.ui`, docking, escenas, ni dependencias de npm. No se implementa un depurador/breakpoints ficticio. No hay un segundo gestor de documentos ni sistema de ventanas.

## Evidencia y estado

- Test específico Node: **13/13 PASS**.
- Batería ampliada anterior a la última aserción: **212/214 PASS**, 2 FAIL en `NE6-16` y `NE6-18`; ambos reproducidos en el baseline parent (16/18 en suite NE6), que usa archivos de Inspector y estilos no modificados por S04.
- Build **NO VERIFICADO**: `vite: not found`.
- Electron S04 **NO VERIFICADO**: `node_modules/vite` ausente. Fixture diseñado para montar el Script Editor y CodeMirror reales; 20 verificaciones previstas.
- `npm ci --offline` no pudo completar por `zip-stream-4.1.1.tgz` no disponible en la caché.
- QA visual de usuario **PENDIENTE**; Gate no aprobado ni cerrado.

Ver matrices y registros en `docs/qa/LF-SCRIPT-EDITOR-GODOT-UX-S04-G001-INTEGRAL_QA.md` y `docs/qa/evidence/LF-SCRIPT-EDITOR-GODOT-UX-S04-G001-INTEGRAL/`.

## CORR-001 · Validación Electron de viewport (2026-11-03)

El usuario ejecutó `SE-E01`: 19/20 verificaciones PASS, última aserción de ausencia de canvas en la zona de CodeMirror FAIL. La aserción era demasiado amplia, pues el editor de código puede alojar canvas propios. No hay prueba de que el viewport 3D realmente haya sido montado dentro del Script Editor.

**Corrección de alcance:** solo fixture Electron, regresión Node SE-14, documentación, evidencia y ledger; ningún cambio en `ScriptEditor.vue` ni en producción. El fixture discrimina canvas bajo `.cm-editor` y rechaza cualquier canvas externo o contenedor de viewport. Node focal ampliado 163/163 PASS. **Electron CORR-001 NO VERIFICADO, S04 pendiente de QA local y aprobación.** Ver `docs/qa/LF-SCRIPT-EDITOR-GODOT-UX-S04-G001-INTEGRAL_CORR-001_QA.md`.


## CORR-002 — Integración con lenguaje visual y geometría del Editor (2026-11-03)

El usuario rechazó el aspecto azul-gris y los controles superpuestos; también comprobó escaso movimiento horizontal de la ventana. Se corrigió `ScriptEditor.vue` para utilizar variables `--g-*`, `--text-*`, `--hair` y el acento ámbar del editor. La sintaxis de CodeMirror y su única instancia permanecen intactas.

`FloatingEditorWindow.vue` admite una barra integrada opcional, activada solo por Script Editor, que aloja las acciones dentro del mismo encabezado. Durante el arrastre se exige únicamente que una franja de la barra permanezca disponible; los ajustes completos se reservan para redimensionamiento de pantalla, no para cada movimiento ni cada guardado. Se conserva la integración con S03 docking, el estado autoritativo y la persistencia de geometría.

**QA:** 168/168 Node PASS; Electron y build NO VERIFICADOS en este entorno (Vite ausente). **NO APROBADO**, a la espera de QA visual del usuario. Referencia: `docs/qa/LF-SCRIPT-EDITOR-GODOT-UX-S04-G001-INTEGRAL_CORR-002_QA.md`.

## S04 CORR-003 — Maximizado sin márgenes (2026-11-03)

Rechazo visual posterior a CORR-002: al maximizar, la ventana no rellenaba el escritorio. `FloatingEditorWindow.vue` reservaba 12 px en los bordes y 8 px adicionales bajo el menú. La corrección usa geometría sin márgenes **solo cuando `integratedTitlebar=true` y `maximized=true`**, inmediatamente bajo los 36 px de la barra principal; otros editores flotantes y los destinos dock conservan sus contratos. El marco maximizado elimina borde, radio y sombra. Restaurar no reencaja una posición que el usuario desplazó parcialmente fuera de pantalla; `onResize` sigue recuperando posiciones tras cambios reales de pantalla.

Nuevo test `scripts/test-script-editor-window-corr003.mjs` (8/8), fixture Electron ampliado a 28 comprobaciones. Regresión Node S04/S03/Multiscript 176/176 PASS. Electron CORR-003, build CORR-003 y QA visual **NO VERIFICADOS**. Gate permanece abierto.

## CORR-004 — Contenedor interior limitado por `.edwin` (2026-11-03)

El usuario ejecutó CORR-003: 27/27 Node PASS y Electron falló en la comprobación de expansión interior (26 comprobaciones anteriores PASS, prueba siguiente sin ejecutar). Medidas `editor=601.59375x341.9375`, marco `640x381`. `src/styles.css` aplica a `.edwin` máximos de `94vw` y `82vh` que coinciden con las medidas. La regla local `.edwin.se` no anulaba esos límites.

Corrección restringida a `ScriptEditor.vue`: `max-width:none; max-height:none` en `.edwin.se` para que el marco/docking determine la geometría. La regla `.edwin` global y las dimensiones de otras ventanas permanecen intactas. Fixture Electron ampliado con límites CSS computados, rectángulos reales y CodeMirror; nueva regresión `test-script-editor-window-corr004.mjs`. Node específico 31/31 y cruzado 180/180 PASS. Electron/build CORR-004 NO VERIFICADOS aquí; QA visual usuario PENDIENTE, S04 ABIERTO. Ver `docs/qa/LF-SCRIPT-EDITOR-GODOT-UX-S04-G001-INTEGRAL_CORR-004_QA.md`.

## Cierre S04 CORR-004 — 2026-11-03

El usuario aportó 31/31 Node PASS, 28/28 verificaciones Electron DOM PASS, build Editor (826 módulos) y Player (414 módulos) PASS, y **aprobó el resultado visual**. En su alcance, el Gate queda **APROBADO Y CERRADO**. Referencia vinculante: `docs/qa/LF-SCRIPT-EDITOR-GODOT-UX-S04-G001-INTEGRAL_CLOSE.md`.

**Solicitud futura diferida:** IntelliSense para anotaciones de tipos en JavaScript, planificado solo al final; explícitamente excluido de S05 UI Designer. No se introduce ahora ninguna funcionalidad, dependencia o cambio de runtime.
