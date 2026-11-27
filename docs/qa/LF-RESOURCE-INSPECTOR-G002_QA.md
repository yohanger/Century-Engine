# LF-RESOURCE-INSPECTOR-G002 — QA y contrato ejecutado

**Estado de implementación:** APROBADO POR EL USUARIO · TEST AUTOMATIZADO PASS. Build Editor/Player PASS local posterior; QA visual NO VERIFICADO.

**Autorización exacta recibida:** `Listo. LF-RESOURCE-INSPECTOR-G002 autoriza comenzar` (2026-10-27).

## Alcance implementado

Los recursos `.material` y `.gamemanager` se editan desde el Inspector derecho mediante la selección original `store.projSel`. `openMaterialEditor()` y `openGameManagerEditor()` son puntos de entrada conservados, pero ahora enfocan el Inspector; ya no activan ventanas separadas. El click simple en Assets y los accesos de MaterialSection y ScenePanel conducen a estos paneles. Desde GameManager, Crear/Editar `.post` abre el perfil en el mismo Inspector.

`MaterialResourceEditor.vue` conserva `MaterialSection` (PBR compartido, propiedades físicas avanzadas, Shader Graph y sincronización de usuarios). `GameManagerEditor.vue` conserva los mismos campos Player, cámara inicial y perfil, editados mediante `touchGameManager()`. Ambos mantienen referencias por ID y renombrado mediante `renameEntry()`. `selectObject()` quita la selección de recursos y restaura la edición del objeto. El panel pequeño usa el drawer ya existente. Se eliminaron únicamente los dos identificadores redundantes de ventanas y los respectivos montajes modales.

No se modificaron render, Shader Graph, Jolt, Player, GameManager runtime, schema de recursos ni proyectos anteriores. Se actualizaron tres tests históricos que verificaban específicamente la existencia de las ventanas obsoletas; sus demás comprobaciones permanecen activas.

## Evidencia automatizada

- `node --test scripts/test-resource-inspector-g002.mjs` — **20 PASS, 0 FAIL**.
- Suites directas `.post`, materiales y GameManager, incluidos tres tests históricos ajustados — **86 PASS, 0 FAIL**.
- Regresión Node disponible, excluyendo `test-starcat.mjs`: **1681 PASS, 0 FAIL, 18 SKIP**. `test-starcat.mjs` no se ejecutó por falta de Three.js instalado; es una exclusión adicional a los SKIP.
- Sintaxis de los módulos JS afectados — **PASS**.
- `npm run build` — **NO VERIFICADO** (`sh: vite: not found`, código 127).
- Editor Electron, Player, Shader Graph en UI y QA visual local — **NO VERIFICADOS**.

Las pruebas Node de UI validan los puntos de integración y semántica de datos a nivel estático; no demuestran por sí solas el renderizado real de componentes Vue.

## QA local (usuario)

Extraer SOURCE_BASELINE en una carpeta aislada. Desde la raíz:

```bash
npm ci
node --test scripts/test-resource-inspector-g002.mjs
npm run build
npm run electron
```

Se esperan **20 PASS** en el test específico. El build y Electron solo podrán declararse PASS cuando se ejecuten localmente.

- [ ] Un clic en `.material` desde Assets muestra el material y sus controles en Inspector; no aparece ventana flotante.
- [ ] Cambiar albedo/rugosidad y editar shader actualiza el recurso compartido y sus objetos consumidores.
- [ ] Desde un objeto con material compartido, «Editar recurso…» abre ese mismo recurso.
- [ ] Un clic en `.gamemanager` muestra Player, cámara y perfil; cambiar opciones se conserva al guardar y reabrir.
- [ ] En ScenePanel, «Editar…» y «Nuevo» seleccionan GameManager en el Inspector.
- [ ] «Editar perfil…» y «Nuevo .post…» desde GameManager muestran el perfil en el mismo Inspector.
- [ ] Elegir otro recurso, objeto, escena y otra pestaña no deja paneles residuales.
- [ ] Deshacer/Rehacer recupera la edición de propiedades conforme al comportamiento existente.
- [ ] Verificar el Inspector en el drawer para ventana estrecha.
- [ ] Comprobar que Shader Graph, Player y exportación existentes no presentan regresiones.

Si falla, devolver captura o vídeo, secuencia exacta y logs. No marcar QA local PASS sin evidencia.

## Continuidad y cierre

- G002 fue **aprobado por el usuario** el 27 de octubre de 2026.
- G003 se ejecutó posteriormente: **15 PASS y 2 FAIL** iniciales de Undo/Redo de GameManager y `.post`; ese resultado se conserva en su informe histórico.
- La corrección `LF-RESOURCE-HISTORY-CORR-G001` recibió aprobación: G003 se volvió a ejecutar con **17 PASS y 0 FAIL**.
- Evidencia local recibida el 27 de octubre de 2026: **32 PASS y 0 FAIL** (17 G003 + 15 de corrección); `npm run build` finalizó con éxito para Editor y Player. No acredita pruebas visuales de la UI, Jolt, exportación o funcionamiento del Player.
- Rediseño de Shader Graph: **fuera del alcance de G002**, pendiente del Sprint posterior.

Los resultados anteriores de este documento son históricos y describen el entorno de entrega de G002; no se sustituyen retroactivamente por la compilación local posterior.
