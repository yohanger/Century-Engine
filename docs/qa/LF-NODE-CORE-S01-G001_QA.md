# QA — LF-NODE-CORE-S01-G001

**Fecha:** 2026-10-28. **Estado:** IMPLEMENTADO / QA AUTOMÁTICO PASS; QA VISUAL LOCAL Y APROBACIÓN PENDIENTES.
**Entrada:** `LevelForge_NODE_ARCH_AUDIT_S00_G001_SOURCE_BASELINE.zip` (909 archivos, sin ECS).

## Pruebas

```bash
node --test scripts/test-node-core-s01-g001.mjs
```

**43 PASS / 0 FAIL / 0 SKIP**. Incluye IDs, jerarquía/ciclos, parenting permitido y rechazado, Node sin Transform, Node3D espacial, ciclo de vida inactivo durante Edit Mode, orden enter/ready/exit, sin duplicar ready, process/fixed process opcionales, reparent y sustitución de tipo, cobertura de integración estática con SceneGraph/Inspector. El test es principalmente unitario/estático; no sustituye un test de interfaz real de Electron.

```bash
node --test $(find scripts -maxdepth 1 -name 'test-*.mjs' ! -name 'test-starcat*' ! -name 'test-clouds*' | sort)
```

Se ejecutó la regresión general sobre la versión final del código: **2,080 PASS / 0 FAIL / 18 SKIP** (2,098 pruebas). Las suites `test-starcat*` y `test-clouds*` se excluyeron del conjunto general por no corresponder al contrato; no declararlas verificadas.

`npm run build` / Electron / GPU / Jolt real / Player exportado: **NO VERIFICADO** en este entorno porque no están disponibles los paquetes `node_modules`. No se infiere su validez de pruebas estáticas.

## Criterios de aceptación

| Código | Estado | Alcance |
|---|---|---|
| N-S01-01 | PASS TEST | Node registrado, sin Transform ni física implícita |
| N-S01-02 | PASS TEST | Node3D registrado, TRS y escala propagada a hijos por implementación Three.js |
| N-S01-03 | PASS TEST | IDs, padres, ciclos, ancestros validados |
| N-S01-04 | PASS TEST | Reparent conserva mundo o local según opción, rechaza casos no representables |
| N-S01-05 | PASS TEST | Ciclo de vida en orden y sin callbacks duplicados |
| N-S01-06 | PASS CÓDIGO | SceneGraph conserva un solo árbol y entrada `project.objects` |
| N-S01-07 | PASS REGRESIÓN | 100 ficheros de pruebas Node, 2.080 PASS, 0 FAIL, 18 SKIP |
| N-S01-08 | PASS COMPARACIÓN ZIP | 49 archivos protegidos idénticos, sin ECS, sin cambios inesperados (ver entrega) |
| N-S01-09 | NO VERIFICADO | UI Godot-like completa, Player/export/Electron/Jolt reales |
| N-S01-10 | PENDIENTE | QA visual local del usuario y aprobación del Gate |

## Pruebas locales recomendadas

1. Extraer CHANGE en una copia de la carpeta local, conservando un respaldo del SOURCE_BASELINE anterior.
2. Ejecutar las pruebas anteriores en el entorno local con dependencias instaladas.
3. `npm run build` y `npm run electron` (comando preferido). Crear Node y Node3D desde el catálogo.
4. Comprobar que el Inspector de Node no presenta Transform; Node3D sí presenta posición, rotación y escala.
5. Crear una jerarquía Node3D → Node3D → Cubo, cambiar TRS; verificar propagación real de escala y orientación en vista 3D.
6. Reparentar con Ctrl+P/Alt+P, arrastrar por Scene Tree, validar que Undo/Redo conserva IDs y jerarquía. Para escalas incompatibles verificar que rechaza operaciones peligrosas.
7. Iniciar Play y exportar una escena de prueba, confirmar que Event Pages, Player y físicas anteriores funcionan sin regresión.
8. Enviar logs de Node tests, salida de build y capturas o descripción de fallos de la prueba visual.

**No marcar APROBADO hasta que el usuario confirme QA.** El ciclo de vida de scripts asociados a nodos no se activa aún durante Play; S05 lo conectará sin alterar el Event Order Flow.
