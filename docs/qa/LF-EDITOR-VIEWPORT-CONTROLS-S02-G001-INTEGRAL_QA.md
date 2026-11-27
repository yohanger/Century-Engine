# QA — LF-EDITOR-VIEWPORT-CONTROLS-S02-G001-INTEGRAL

## Evidencia disponible

- SOURCE_BASELINE: último S01 CORR-001 entregado y aprobado, sin modificación de escenas, Player ni runtime.
- Node: `scripts/test-editor-viewport-controls-s02-g001-integral.mjs` verifica casos VC-01..VC-21, con dobles mínimos donde no se requiere Vue/Three real. La regresión ampliada se registra en `evidence/LF-EDITOR-VIEWPORT-CONTROLS-S02-G001-INTEGRAL/node.log`.
- Electron: **fixture y runner preparados**, sin validación en esta copia porque faltan dependencias instaladas (Vite y Electron). El runner usa Electron embebido, no Chromium externo; trabaja con Vue y `TransformControls` reales pero sin renderizado GPU.
- Build: **NO VERIFICADO** si no están instaladas las dependencias. No confundir ausencia de Vite con fallo del código.
- Histórico: SCENE-09 falla al buscar la antigua expresión en `src/core/mesh/session.js`; se reproduce sin cambios en el SOURCE_BASELINE anterior. Se conserva el fallo y no se reescribe fuera del alcance.

## Instalación sin sobrescrituras

Extraer `SOURCE_BASELINE` S02 en una carpeta nueva y conservar S01 CORR-001 como respaldo. Alternativamente, extraer `CHANGE` S02 exclusivamente sobre copia idéntica de S01 CORR-001, comparando cualquier cambio local antes de reemplazar. No sobrescribir proyectos personales, escenas, Assets ni `node_modules` de la instalación operativa sin comparación.

Desde la raíz del SOURCE_BASELINE nuevo, Linux:

```bash
npm ci
node --test scripts/test-editor-viewport-controls-s02-g001-integral.mjs scripts/test-editor-ux-s01-g002.mjs scripts/test-editor-viewbar-ux-g001.mjs scripts/test-editor-viewbar-nav-device-corr-g001.mjs scripts/test-transform-global-local-corr-g001.mjs scripts/test-transform-uniform-scale-s04-g001.mjs scripts/test-editor-snap-shift-g001.mjs
node --test scripts/test-editor-viewport-controls-s02-g001-integral-electron.mjs
npm run build
npm run electron
```

**Resultados esperados:** todos los casos Node seleccionados PASS; Electron 1/1 PASS con 22 verificaciones y sin GPU; Editor y Player Vite build con exit 0. Los resultados son **expectativas**, no evidencia de ejecución local. La regresión adicional que incluye `test-scene-inspector-s01-g001.mjs` conserva su fallo histórico SCENE-09; no declararlo PASS.

## QA manual de integración (usuario)

- V01: Vista edición sin botones Escena/Juego, ViewBar conserva cuadrícula, iluminación, cámara/encuadrado y ratón/trackpad. Play (F5) muestra Aspecto, Escala, Maximizar, Silenciar y Stats. Stop restaura herramientas de edición sin alterar escena.
- V02: Mover muestra tres flechas X/Y/Z y planos XY/XZ/YZ, sin flechas duplicadas. Arrastrar sobre ambos sentidos del eje; valores y Undo/Redo son correctos.
- V03: Rotar muestra anillos X/Y/Z, más E (pantalla), sin esfera libre central. Probar distintas orientaciones de cámara y padres rotados.
- V04: Escalar muestra cubos X/Y/Z y un cubo central XYZ para escala uniforme. Probar que arrastrarlo escala los tres componentes, con Snap activado y desactivado. Escala cero/inválida debe seguir bloqueada por las salvaguardas existentes.
- V05: Universal muestra los tres juegos de asas distinguibles: escala interior, movimiento intermedio, rotación exterior. No debe iniciar dos transformaciones con un clic; la cámara no debe desplazarse al arrastrar un gizmo.
- V06: Global/Local X alterna orientación de mover/rotar, con padres rotados, conservando Scale local. Verificar selección múltiple y pivote compartido, sin discrepancias en Inspector.
- V07: Snap + Shift temporal, estado de preferencias de tamaño, Undo/Redo, FilmMaker y terreno no sufren regresiones. Cambiar tamaño del gizmo en preferencias y comprobar los tres modos y Terrain.
- V08: Edit Mesh mantiene G/R/S modales sin gizmos de objetos; Player/export no incorporan controles editoriales y el proyecto existente abre/guarda intacto.

**Evidencia para cierre:** salida de Node, Electron, build, informe V01–V08 y capturas de Move/Rotate/Scale/Universal si surge un defecto visual. Solo con QA local y aprobación explícita se podrá cerrar S02 y actualizar sus estados a CERRADO.

## CORR-001 — QA local rechazado (2026-11-02)

**Observado:** usuario indica «No aprobado» y aporta captura con dos flechas por eje y tamaño no conforme. La captura está en `docs/qa/evidence/LF-EDITOR-VIEWPORT-CONTROLS-S02-G001-INTEGRAL/user-negative-handles.png`.

**Causa confirmada:** TransformControls r186.1 contiene pares negativos nativos además de los creados antes por LevelForge; S02 retiró solamente los segundos. También había alterado los coeficientes visuales históricos de tamaño. **Se preserva el estado de fallo en el historial.**

**Corrección:** se retiran geometrías y pickers del semieje negativo de Move/Scale manteniendo los nombres de eje y ecuaciones del addon; se restauran los coeficientes Scale 0.5, Move 0.85, Rotate 0.95 sujetos a la preferencia existente. CA-004 delimita la corrección.

**Automatizado disponible:** Node focal 120/120 PASS, incluyendo VC-22; ampliada 130/131 con SCENE-09 histórico sin cambios (`docs/qa/evidence/LF-EDITOR-VIEWPORT-CONTROLS-S02-G001-INTEGRAL/extended-corr-001.log`); ver `docs/qa/evidence/LF-EDITOR-VIEWPORT-CONTROLS-S02-G001-INTEGRAL/focal-corr-001.log`. La suite amplia mantiene el fallo histórico SCENE-09 fuera de alcance.

**Pendiente obligatorio:** reejecutar `node --test scripts/test-editor-viewport-controls-s02-g001-integral-electron.mjs` en Electron embebido con Three.js real (23 comprobaciones esperadas), `npm run build`, `npm run electron`, y QA visual del usuario. Verificar a preferencia de tamaño 0.5, 1 y 2. Comprobar Move/Scale desde varios ángulos: debe haber solo tres asas positivas, sin zonas invisibles activas en extremos negativos. Probar Scale XYZ, Rotate E, Universal, Snap+Shift, Local/Global, selección múltiple y Undo/Redo.

**Estado:** S02 NO APROBADO por QA local; CORR-001 IMPLEMENTADA / Node PASS / Electron y build NO VERIFICADOS / QA CORR-001 PENDIENTE. NO CERRADO.


## CORR-002 — Asas orientadas a cámara (2026-11-02)

**QA observado:** usuario acepta parcialmente el tamaño y el número de asas, pero rechaza que el gizmo conserve siempre el mismo extremo al orbitar la cámara; captura `user-camera-facing-handles.png`. S02 sigue sin aprobación.

**Contrato:** CA-005 reemplaza solo las cláusulas de extremos estáticos de CA-004. Una sola punta/cubo por eje visible, ahora del lado próximo a la cámara; líneas y pickers coherentes; no se altera la dirección real de los ejes ni Global/Local.

**Node:** `node --test scripts/test-editor-viewport-controls-s02-g001-integral.mjs` → 25/25 PASS. Focal ampliada → 123/123 PASS (`focal-corr-002.log`). Ampliada con Scene Inspector → 133/134, con `SCENE-09` FAIL histórico de baseline anterior (`extended-corr-002.log`).

**Electron:** runner `scripts/test-editor-viewport-controls-s02-g001-integral-electron.mjs` ahora exige 30 checks con Vue + TransformControls reales, sin prueba GPU. **NO VERIFICADO** aquí: no existe Vite instalado (`electron-corr-002-attempt.log`). **Build NO VERIFICADO** aquí: Vite ausente (`build-corr-002-attempt.log`). No confundir fallo de preparación del entorno con fallo funcional.

### QA visual obligatorio del usuario

- V09. Seleccionar cubo desde frente y orbitar a la parte posterior: las flechas de Mover se desplazan al semieje orientado hacia la cámara. Debe haber UNA sola flecha por eje, nunca dos al mismo tiempo. Comprobar desde arriba/abajo/lados.
- V10. Repetir para Escalar: una sola punta por eje y asa central XYZ accesible; los cubos se reorientan sin cambiar los números de escala por sí mismos.
- V11. Inspeccionar zonas de clic: no arrastrar el extremo oculto. Comprobar que arrastrar la punta visible mueve/escala en ambos sentidos y que no cambia de lado durante el gesto.
- V12. Probar objeto con padre rotado y alternar Global/Local (Escalar siempre local); comprobar ejes y posición real de objetos en Inspector.
- V13. Probar tamaño 0.5×/1×/2×, Universal, Snap+Shift, selección múltiple, Undo/Redo, Rotar y Edit Mesh sin regresiones.

Repetir después:

```bash
node --test scripts/test-editor-viewport-controls-s02-g001-integral.mjs
node --test scripts/test-editor-viewport-controls-s02-g001-integral-electron.mjs
npm run build
npm run electron
```

**Para cierre:** enviar evidencia de Electron (30 verificaciones), compilación de Editor y Player, aceptación visual V09–V13 y aprobación. Hasta entonces S02 NO CERRADO, S03 no iniciado.
