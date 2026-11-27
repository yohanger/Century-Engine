# LevelForge — LF-EDITOR-INSPECTOR-INTEGRATION-CORR-G001

**Estado:** IMPLEMENTADO · TEST AUTOMATIZADO PASS · BUILD/QA VISUAL NO VERIFICADOS · APROBACIÓN DEL USUARIO PENDIENTE.

**Autorización:** `Listo. LF-EDITOR-INSPECTOR-INTEGRATION-CORR-G001 autoriza comenzar`.

## Fuente de verdad y alcance

Se partió **exclusivamente** del `lf.zip` local aportado por el usuario (1021 entradas ZIP, archivo íntegro), en lugar de imponer el baseline anterior de Shader Graph. Esta fuente contiene cambios locales de Codex a conservar. El antiguo CHANGE `LF-SPRITE3D-PIVOT-G001` se usó únicamente como referencia puntual de la implementación del pivote, sin extraer encima del código local los otros archivos, dependencias ni ledger.

**C01 — Transformaciones:** `src/components/Vec3Field.vue` retiene el último vector emitido mientras `NumberField` produce `update:modelValue` y `commit` en el mismo ciclo. El commit utiliza ese vector, no las props obsoletas. Abarca posición, rotación, escala y otros Vec3Field existentes; el update original y la entrada de Undo continúan en `updateObject()`.

**C02 — Selección múltiple:** `src/components/Inspector.vue` incluye la clase `multi-delete` exclusivamente en el botón Eliminar de la selección múltiple; el ancho del control se adapta al texto y no modifica otros botones de solo icono.

**C03 — Sprite3D:** `src/engine/runtime/nodes/sprite.js` añade `pivotX` y `pivotY` normalizados en rango 0..1 (arriba-izquierda = 0,0). Default 0.5,1 conserva geometría previa. `src/components/SpriteSection.vue` añade nueve presets y dos `NumberField`. El pivot modifica el desplazamiento local del mesh sin alterar la transformación del nodo, con o sin textura cargada. Se mantienen Flip X/Y, Billboard y Sprite2D sin pivote nuevo.

**Exclusiones cumplidas:** no se modificaron Shader Graph, Dock/Undock, serialización general, compilar shaders, física ni Player.

## Evidencias ejecutadas

| Prueba | Resultado |
|---|---|
| Nueva `scripts/test-editor-inspector-integration-corr-g001.mjs` | **14 PASS, 0 FAIL** |
| Integración `scripts/test-sprite3d-pivot-g001.mjs` | **16 PASS, 0 FAIL** |
| Regresión Node disponible, sin `test-starcat.mjs` | **1788 PASS, 0 FAIL, 18 SKIP** |
| `node --check` sprite.js | PASS |
| `npm run build` en entorno de entrega | **NO VERIFICADO**: `vite: not found` (exit 127) |
| Compilación Electron/Player/QA visual local | **NO VERIFICADOS** |

Las pruebas Vec3 ejercitan las funciones reales extraídas del componente Vue, con `updateObject()` original y dependencias visuales sustituidas; no equivalen a una interacción DOM/Electron. El caso Eliminar comprueba la clase y reglas de CSS, pero el recorte final deberá verificarse visualmente. El test Sprite3D verifica el comportamiento de `applySprite()` con dependencias THREE sustituidas; Editor/Player reales quedan por comprobar.

## Procedimiento en instalación local (solo CHANGE)

**ATENCIÓN:** el baseline procede del `lf.zip` recibido. Si Codex o el usuario modificaron **después de generar** ese ZIP cualquiera de los cuatro archivos de producción afectados, **comparar y reconciliar antes de sobrescribir**. No reemplazar archivos de producción actuales desde el SOURCE_BASELINE sin esta comparación.

```bash
cd ~/ENGINES/lf-0.26.13/lf
unzip -l ~/Downloads/LevelForge_EDITOR_INSPECTOR_INTEGRATION_CORR_G001_CHANGE.zip
# Respaldar primero los cuatro módulos y el ledger local antes de instalar.
unzip -o ~/Downloads/LevelForge_EDITOR_INSPECTOR_INTEGRATION_CORR_G001_CHANGE.zip -d .
node --test scripts/test-editor-inspector-integration-corr-g001.mjs scripts/test-sprite3d-pivot-g001.mjs
npm run build
npm run electron
```

**Resultado esperado:** 30 PASS, 0 FAIL en las dos suites. El build y Electron deben terminarse localmente para registrar PASS.

### QA funcional del usuario

- [ ] Editar X/Y/Z de **posición** desde Inspector y comprobar que el nuevo valor permanece tras Enter/blur y mueve el nodo en viewport.
- [ ] Editar **rotación** y **escala**, incluidos ejes consecutivos y arrastres; comprobar Undo/Redo.
- [ ] Probar otro tipo de nodo y los paneles que reutilizan `Vec3Field`.
- [ ] Seleccionar dos o más nodos; comprobar que «Eliminar» tiene texto e icono completos.
- [ ] Probar «Eliminar» sobre un proyecto de prueba; comprobar Undo.
- [ ] Crear Sprite3D y usar los nueve presets y valores decimales de pivote X/Y.
- [ ] Cambiar `pixelSize`, Flip X/Y y Billboard, guardarlo y reabrirlo.
- [ ] Confirmar que Sprite2D y sprites antiguos mantienen la ubicación anterior por defecto.
- [ ] Ejecutar el Player y confirmar la misma posición del sprite.

Documentar capturas/logs si hay discrepancias. No marcar estos ítems PASS automáticamente.

## Continuidad

CHANGE incluye solo cuatro módulos, dos tests, este QA y el ledger. El SOURCE_BASELINE incluye el proyecto completo **sin `node_modules`, builds (`dist`, `dist-player`), cachés, releases ni `.git`** y es la continuidad de `lf.zip` con estos cambios integrados. Se preserva el historial de los Gates anteriores. La aprobación y el QA visual de este Gate están pendientes del usuario.
