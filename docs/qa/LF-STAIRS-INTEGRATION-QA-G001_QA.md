# LF-STAIRS-INTEGRATION-QA-G001 — QA automatizado del Sprint Escaleras

## Autorización y alcance

Autorización literal recibida el **2026-10-27**. Se evalúa la cadena **Escalera recta (LF-STAIRS-PARAM-G001) → Curvatura (LF-STAIRS-CURVE-G001) → Laterales (LF-STAIRS-SIDES-G001)**. Los tres Gates funcionales habían sido aprobados por el usuario. Este Gate autoriza exclusivamente pruebas de integración, su documentación y la sincronización del ledger de seis hojas. **No se ha modificado código de producción.**

El SOURCE_BASELINE de entrada es `LevelForge_STAIRS_SIDES_G001_SOURCE_BASELINE.zip` (822 archivos, integridad ZIP verificada). `LF-STAIRS-SIDES-G001` figura ahora como aprobado por el usuario. No se declara Sprint cerrado automáticamente.

## Ejecución automatizada — evidencia observada

Desde la raíz de este SOURCE_BASELINE:

```bash
node --test scripts/test-stairs-param-g001.mjs scripts/test-stairs-curve-g001.mjs scripts/test-stairs-sides-g001.mjs
node --test scripts/test-stairs-integration-qa-g001.mjs
node --test $(find scripts -maxdepth 1 -name 'test-*.mjs' ! -name 'test-starcat.mjs' | sort)
node --check scripts/test-stairs-integration-qa-g001.mjs
npm run build
```

**Resultado real en el entorno de ejecución del asistente (2026-10-27):**

| Verificación | Resultado |
|---|---|
| Suites PARAM (20), CURVE (22), SIDES (26) | 68 PASS / 0 FAIL / 0 SKIP |
| Suite nueva STAIRS-INT-01..12 | 12 PASS / 0 FAIL / 0 SKIP |
| Regresión Node disponible (sin starcat) | 1559 PASS / 0 FAIL / 18 SKIP |
| Sintaxis `node --check` del test nuevo | PASS |
| `npm run build` | NO COMPILADO: exit 127, `vite: not found` |
| `scripts/test-starcat.mjs` | NO EJECUTADO en la regresión: paquete Three.js ausente |
| Electron, Player, física Jolt, CSG visual, Godot real | NO VERIFICADOS |

Los **18 SKIP** pertenecen a la regresión disponible. La exclusión de `test-starcat.mjs` se declara aparte; no se cuenta como PASS o SKIP dentro del total. La inspección de conexiones entre archivos **no** prueba su funcionamiento en ejecución. Los resultados automatizados PASS no equivalen a compilación ni QA local PASS.

## Matriz de integración y límite de evidencia

| ID | Prueba | Evidencia |
|---|---|---|
| STAIRS-INT-01 | Cambios sucesivos de pasos, giro y laterales | Generador Node, PolyMesh sin geometría obsoleta |
| STAIRS-INT-02 | Dimensiones XYZ variables | Mallas generadas cerradas con volumen positivo |
| STAIRS-INT-03 | Matriz recta/curva/laterales y 2/8/64 pasos | Triangulación válida, sin triángulos degenerados |
| STAIRS-INT-04 | Conversión a Edit Mesh | Igualdad exacta de vértices y caras en `fromPrimitive()` |
| STAIRS-INT-05 | Atributos métricos | UV, normales y Blockout finitos |
| STAIRS-INT-06 | Buffers y datos trimesh | Igualdad numérica de coordenadas de los triángulos |
| STAIRS-INT-07 | Guardado/reapertura de malla | `PolyMesh.toJSON()/fromJSON()` con tolerancia del formato |
| STAIRS-INT-08 | Curva/parapeto interior inviables | Validación y degradación a recta sin malla abierta |
| STAIRS-INT-09 | Escenas anteriores | Valores predeterminados y geometría preservados |
| STAIRS-INT-10 | Exportación GLB | Bytes GLB, índices y atributos del recurso, no ejecución Godot |
| STAIRS-INT-11 | Firmas de reconstrucción y CSG | Revisión estática de dependencias; **CSG no ejecutado** |
| STAIRS-INT-12 | Ramas del exportador Godot | Revisión estática de cajas históricas y GLB/trimesh; **Godot no ejecutado** |

## QA visual y funcional — usuario

El usuario decide y ejecuta el QA visual; la falta de estas evidencias **no bloquea la planificación siguiente**, pero impide etiquetar esas pruebas como PASS. Desde una **copia aislada** del proyecto, instalar dependencias con `npm ci`, compilar con `npm run build` e iniciar con `npm run electron`.

1. Crear Escalera recta de 2, 8 y 64 escalones; cambiar ancho, altura y profundidad. Verificar Inspector, volumen y caras.
2. Cambiar sucesivamente Giro de 0° a ±45° y ±90°, laterales ninguno/izquierdo/derecho/ambos, altura y grosor; comprobar que no sobreviven geometrías anteriores tras reconstruir.
3. Abrir Edit Mesh, seleccionar y manipular vértices/caras, Undo/Redo y Snap; comprobar materiales, UV y Blockout.
4. Guardar y reabrir la escena con ambas paredes y giro distinto de cero; comprobar parámetros y apariencia, y abrir una escena antigua sin esas propiedades.
5. Ejecutar CSG con Escalera como receptor y otra como cortador; variar `steps`, `turn`, `sides`, altura, grosor y XYZ, comprobar actualización correcta.
6. Abrir Player; recorrer huellas y comprobar colisiones Jolt contra parapetos (sin atravesarlos).
7. Exportar a Godot: recta sin laterales (cajas), curva y/o con laterales (GLB + trimesh). Comprobar medidas, materiales y colisiones en ejecución.

Para incidencias devolver **comando, salida completa, escena mínima, pasos de reproducción y captura/vídeo**. Separar defecto observado de hipótesis y causa raíz. Si se confirma un defecto de producción, proponer **Gate de corrección independiente**, sin repararlo dentro de este QA.

## Aprobación y cierre documental del Sprint Escaleras — 2026-10-27

**OBSERVADO — aceptación del usuario:** tras la entrega del Gate `LF-STAIRS-INTEGRATION-QA-G001`, el usuario respondió «Aprobado» y solicitó expresamente realizar el cierre antes del siguiente trabajo. Esta aprobación afecta al alcance del Gate autorizado y al cierre documental del Sprint Escaleras; no constituye evidencia de haber ejecutado QA visual o funcional local.

**Estado del Gate:** **APROBADO POR USUARIO · CERRADO (ALCANCE AUTOMATIZADO)**. El cierre se fundamenta en 12 pruebas de integración PASS, 68 pruebas anteriores de Escalera PASS y regresión disponible de **1559 PASS / 0 FAIL / 18 SKIP**, excluyendo `test-starcat.mjs` por faltar Three.js.

**Estado del Sprint Escaleras:** **CERRADO DOCUMENTALMENTE** por aceptación del usuario y pruebas automatizadas registradas. Los Gates `LF-STAIRS-PARAM-G001`, `LF-STAIRS-CURVE-G001`, `LF-STAIRS-SIDES-G001` y `LF-STAIRS-INTEGRATION-QA-G001` están aprobados por el usuario.

**Limitaciones expresas:** `npm run build` continúa **NO COMPILADO / NO VERIFICADO** (`vite: not found`). Electron, Player, física Jolt, CSG visual y exportación ejecutada en Godot permanecen **NO VERIFICADOS**. **QA LOCAL PASS no está declarado**. Una incidencia posterior se tratará mediante auditoría y Gate de corrección, sin cambiar retroactivamente la evidencia.

**Registro de cierre:** el ledger `docs/qa/LevelForge_DB_Ledger.xlsx` fue sincronizado en sus seis hojas (ROADMAP, BACKLOG, DEPENDENCIES, GATES, EVIDENCE, TRACEABILITY). No se han introducido modificaciones en producción ni nuevas funcionalidades. El siguiente Sprint y sus objetivos quedan **PENDIENTES DE DECISIÓN DEL USUARIO**.

