# CENTURY-EDITOR-SCRIPT-S01-G001 — Evidencia de QA

**Origen:** `source_baseline(8).zip`, extraído sin modificar archivos fuente iniciales. El ZIP no incluye un árbol Git para atribuir modificaciones previas; el contraste es contra los bytes entregados como baseline. No se realizaron operaciones Git.

## Ejecutado

| Comprobación | Baseline de entrada | Implementación actual | Resultado |
|---|---:|---:|---|
| `node --test scripts/test-script-editables-s01-g001.mjs` | No existía | 19 PASS / 0 FAIL | PASS específico |
| `node --test scripts/test-node-multiscript-s01-g001.mjs` | 11 PASS / 10 FAIL | 11 PASS / 10 FAIL | Sin aumento de fallos |
| `node --test scripts/test-node-multiscript-s01-g002.mjs` | 18 PASS / 2 FAIL | 18 PASS / 2 FAIL | Sin aumento de fallos |
| `node --test scripts/test-node-multiscript-s01-g003.mjs` | 14 PASS / 6 FAIL | 14 PASS / 6 FAIL | Sin aumento de fallos |
| `node --check` de los módulos JS modificados | — | PASS | Sintaxis JavaScript válida |
| `npm run build` | — | EXIT 127: `vite: not found` | NO COMPILADO |
| `npm ci` | — | Falla npm: `Exit handler never called!` | Dependencias no instaladas completamente |

Los 18 fallos de las tres suites Multiscript existían antes de este Gate. No se declara resuelta su causa raíz, ni se consideran pruebas PASS. La nueva prueba de remapeo de `.levelpackage` sí pasa.

## No verificado

- Compilación Editor/Player, renderizado real de `Inspector.vue` y montaje Electron.
- Guardar/abrir `.lfproj` con ediciones, duplicación/Prefab vinculados, Undo/Redo completo y QA Play real.
- Compatibilidad del servidor de lenguaje de VS Code externo con `@editable` como sintaxis no estándar.
- Validación del usuario en máquina de destino y aprobación de Gate.

## Protocolo manual

1. Crear un recurso Script de Nodo y añadir los cuatro decoradores antes de variables numéricas, textuales y booleanas.
2. Asociarlo a dos nodos distintos; editar campos en el Inspector y confirmar que difieren.
3. Entrar en Play y verificar valores en `_ready`; salir de Play y verificar persistencia de la configuración editorial.
4. Guardar/reabrir escena, duplicar, aplicar Prefab y comprobar Undo/Redo.
5. Importar un paquete con nodos que usen propiedades editadas y verificar que los IDs se remapean sin alterar cadenas literales.
6. Compilar y ejecutar el Player separado en la máquina de destino. Verificar las directivas en el editor Code y en VS Code opcional.

**Cierre:** PENDIENTE DE QA LOCAL Y APROBACIÓN DEL USUARIO.
