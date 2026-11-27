# QA — integridad de selección y fusión de caras

**Gate:** `CENTURY-EDITOR-MESH-S01-G001-CORR-007-FACE-PICKING-AND-MERGE-CONNECTIVITY-INTEGRITY`

**Fuente anterior:** `CENTURY-EDITOR-MESH-S01-G001-CORR-006-MERGE-FACES-RUNTIME-DISPATCH_SOURCE_BASELINE.zip`.

| Verificación | Resultado | Evidencia |
|---|---|---|
| Nuevas pruebas de CORR-007 | 14/14 PASS | `face-integrity-runner.log` |
| `node scripts/qa-suite.mjs mesh-face-integrity` | 69/69 PASS | `face-integrity-runner.log` |
| `node scripts/qa-suite.mjs mesh-merge-runtime-dispatch` | 70/70 PASS | `previous-merge-runner.log` |
| `node --test scripts/test-mesh*.mjs scripts/test-trimesh-reference-integrity.mjs` | 350 PASS, 53 FAIL, total 403 | `full-mesh-regression.log` |
| Mismo comando sobre SOURCE_BASELINE anterior | 336 PASS, 53 FAIL, total 389 | `baseline-mesh-regression.log` |
| Comparación de fallos | Los mismos 53 nombres; **0 fallos nuevos** | Ambos logs de regresión |
| `node scripts/qa-suite.mjs smoke` | 29/30 PASS; 1 FAIL preexistente | `smoke.log`; `baseline-smoke.log` |
| `node --check` en módulos JavaScript y test nuevos | PASS | Revisión sintáctica |
| `npm run build` | EXIT 127 — `vite: not found` | `build.log` |
| Electron, geometría renderizada y validación visual | NO VERIFICADO | Pendiente de instalación local |

Los archivos de evidencia se encuentran en `docs/qa/evidence/CENTURY-EDITOR-MESH-S01-G001-CORR-007-FACE-PICKING-AND-MERGE-CONNECTIVITY-INTEGRITY/`.

## Cobertura nueva

- Mapa de caras válido, ausente, de longitud obsoleta, con índice fuera de rango y con referencias inválidas.
- Raycast repetido tras reconstruir el mapa; selección vacía sin alterar la geometría.
- Índices de triángulos 113, 119, 134, 136 y 137 tras fusión de caras y serialización.
- Fusión de caras conectadas; rechazo no destructivo de aristas que se superponen espacialmente pero tienen IDs distintos, conexión solo por vértice, unión en T, caras separadas y caras no coplanares.

## Validación manual requerida

1. Abrir la escena de la pared aportada en las capturas; seleccionar caras con índices de triángulo altos antes y después de Fusionar caras.
2. Repetir extrusión, corte, subdivisión y fusión, entrar/salir de Edit Mesh, guardar y reabrir; verificar ausencia de excepciones `_pickFace`.
3. Si se rechaza una fusión, identificar si el mensaje corresponde a aristas con IDs separados, unión en T o falta real de adyacencia; no unir automáticamente geometría previamente separada.
4. Confirmar Ctrl+Z/Ctrl+Y, UV, materiales y referencias TriMesh.

**Limitación:** el proyecto exacto de las capturas no fue aportado y en el entorno no está instalado Vite/Three para compilar Electron. El fallo inmediato de `_pickFace` está demostrado mediante el código, pero la causa concreta de la pérdida del mapa durante esa sesión no ha sido reproducida visualmente.
