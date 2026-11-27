# LF-RESOURCE-INSPECTOR-G003 — QA de integración

**Autorización literal:** `Listo. LF-RESOURCE-INSPECTOR-G003 autoriza comenzar` (2026-10-27).

**Resultado ORIGINAL de G003 (antes de la corrección):** 15 PASS, **2 FAIL**, 0 SKIP. Se conserva como evidencia de defectos. **Resultado posterior tras la corrección autorizada:** 17 PASS, 0 FAIL, 0 SKIP, confirmado también en la máquina del usuario. **Cierre técnico autorizado en `LF-RESOURCE-INSPECTOR-S01-CLOSE-G001`.** QA visual de Electron/Player NO VERIFICADO.

## Alcance y método

Se ejercitan las operaciones auténticas de `profiles.js`, `materials.js`, `game-managers.js` y `history.js` en un harness Node con las dependencias Vue/Electron sustituidas, sin duplicar su lógica. Se comprueban los modelos serializables originales y las conexiones Vue mediante inspección de código. Este método no ejecuta eventos reales de Vue, DOM, IndexedDB, Jolt, compositor ni Player y **no debe interpretarse como QA visual o E2E**.

Los casos RI3-01 a RI3-15 pasan: navegación cruzada de tres recursos; GameManager→`.post`; selección por ID; referencias inválidas; materiales compartidos y sus consumidores; eliminación de materiales, perfiles y GameManager con limpieza de referencias; selección de objetos/pestañas; desmontaje de preview; round-trip JSON de modelos; drawer móvil; accesos Shader Graph; y Undo/Redo de materiales.

## Defectos observados

| ID | Caso | Esperado | Observado | Estado |
|---|---|---|---|---|
| RI3-16 | Undo/Redo de GameManager | El valor `player` vuelve de `none` a `inherit` al deshacer | Permanece `none` | **FAIL** |
| RI3-17 | Undo/Redo de `.post` | Bloom vuelve de `2.4` a `1.5` al deshacer | Permanece `2.4` | **FAIL** |

**CAUSA RAÍZ DEMOSTRADA para Undo:** `src/core/state/history.js`, funciones `captureEntry()` y `applyEntry()`, solo almacenan/restauran `objects`, `materials` y `environment` (más terreno/selección), no las colecciones `gameManagers` ni `profiles`. Incluso al ejecutar `commit()` explícitamente, no se restaura una modificación de estas dos colecciones. Por otro lado, `touchProfile()` actualmente llama a `markDirty()` y no registra un punto de Undo. No es un fallo de Vite ni de dependencias ausentes.

**Efecto:** la edición de materiales sí participa en el historial; las propiedades de GameManager y `.post` no tienen la misma garantía de Undo/Redo. Persistencia JSON verificada en modelo no equivale a guardado/reapertura real.

**Acción:** sin corrección dentro de este Gate de QA. Proponer un Gate técnico separado que audite el contrato de historial, implemente capturas/restauración de recursos sin duplicar estados y pruebe Undo/Redo, cambios de escena y compatibilidad. El Sprint no debe marcarse CERRADO hasta solucionar los FAIL y obtener aprobación. No adaptar la expectativa de QA para justificar la omisión.

## Ejecuciones verificadas

- `node --test scripts/test-resource-inspector-g001.mjs scripts/test-resource-inspector-g002.mjs` → **38 PASS, 0 FAIL, 0 SKIP**.
- `node --test scripts/test-resource-inspector-g003.mjs` → **15 PASS, 2 FAIL, 0 SKIP** (los fallos anteriores son esperados como detección de defectos, no como PASS).
- Regresión Node previa, excluyendo G003 y `scripts/test-starcat.mjs`: **1681 PASS, 0 FAIL, 18 SKIP** sobre 80 archivos. `test-starcat` excluido por no estar instalado `three`.
- `npm run build` → **NO VERIFICADO: `vite: not found` (exit 127)**.
- QA Vue/Electron, Player, compositor, física, guardado real y QA visual del usuario → **NO VERIFICADOS**.

## QA local del usuario (independiente)

En una carpeta aislada del baseline, sin sobrescribir cambios locales:

```bash
npm ci
node --test scripts/test-resource-inspector-g003.mjs
npm run build
npm run electron
```

Antes de aplicar una corrección, la suite G003 mostrará **dos FAIL** de historial; no se deben considerar errores de instalación. Revisar específicamente la secuencia editar→deshacer→rehacer para Material, `.post` y GameManager. Para UI, probar Assets→Inspector, GameManager→perfil, cambiar objeto/escena/pestaña, eliminar recursos, materiales compartidos, preview Antes/Después, drawer estrecho y acceso a Shader Graph. Devolver logs/capturas solo ante incidencias que necesiten diagnóstico; no declarar PASS de QA local sin evidencia.

## Estado y trazabilidad

- G001 y G002: **APROBADOS POR EL USUARIO**, QA local no verificado.
- G003: **AUTORIZADO Y EJECUTADO; INTEGRACIÓN FAIL; PENDIENTE DE CORRECCIÓN**.
- Siguiente acción real: declarar y autorizar Gate de corrección para Undo/Redo de GameManager y `.post`; volver a ejecutar G003, regresión y actualizar ledger.
- Sprint Shader Graph visual aprobado como referencia; su implementación no forma parte de G003.

## Resolución y evidencia posterior (27 de octubre de 2026)

Los FAIL RI3-16 y RI3-17 **no se cambiaron ni se desactivaron para ocultar errores**. El Gate de corrección `LF-RESOURCE-HISTORY-CORR-G001` amplió el historial existente para incluir `profiles` y `gameManagers`, ajustando la confirmación de cambios de `.post`. Después de la corrección, los mismos casos pasaron.

- **G003 repetido en el equipo del usuario:** 17 PASS, 0 FAIL.
- **Suite de corrección en el equipo del usuario:** 15 PASS, 0 FAIL. Total conjunto: **32 PASS, 0 FAIL**.
- **Build local:** Editor Vite (**836 módulos transformados, `built in 1m 30s`**) y Player Vite (**373 módulos transformados, `built in 34.65s`**). Ambos PASS.
- **Electron:** se invocó `npm run electron` y se interrumpió mediante `Ctrl+C`; su comportamiento visual y Player ejecutado permanecen **NO VERIFICADOS**.
- **Regresión Node disponible de la entrega de corrección:** 1713 PASS, 0 FAIL, 18 SKIP (sin `test-starcat.mjs` por ausencia de Three.js en ese entorno). No es una repetición de 1713 pruebas en la máquina del usuario.

El diagnóstico original se conserva íntegro y no se reinterpreta como PASS. El cierre técnico/documental de Sprint depende de la aprobación explícita del cierre, mientras que el QA visual seguirá pendiente hasta su ejecución local.
