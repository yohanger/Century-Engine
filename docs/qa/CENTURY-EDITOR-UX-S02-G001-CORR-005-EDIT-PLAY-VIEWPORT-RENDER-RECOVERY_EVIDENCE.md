# QA — CORR-005: recuperación de canvas Edit Mode / Play Mode

**Fuente:** SOURCE_BASELINE de CORR-004; escenario de referencia: captura aportada de The Room, Edit Mode activo con viewport vacío. Sin prueba Electron ejecutable en este entorno.

| Verificación | Resultado | Evidencia |
|---|---|---|
| Pruebas focalizadas de render recovery + docking/loopcut | **25/25 PASS** | `evidence/CENTURY-EDITOR-UX-S02-G001-CORR-005-EDIT-PLAY-VIEWPORT-RENDER-RECOVERY/focused-node.log` |
| Regresión ampliada de docking, selección, culling y viewport | **117/119 PASS** | `evidence/.../regression-node.log` |
| Contraprueba del docking en SOURCE_BASELINE CORR-004 | **50/52 PASS; mismos DOCK-30 y DOCK-C09** | `evidence/.../baseline-docking-node.log` |
| Dominio: loopcut, observación de culling y recuperación | **28/28 PASS** | `evidence/.../domain-node.log` |
| Ciclo Edit/Play heredado | **8/8 PASS** | `evidence/.../lifecycle-node.log` |
| `node --check` de módulos y `<script setup>` extraído de App.vue | **PASS** | `evidence/.../syntax.log` |
| `npm run build` | **BLOQUEADO: `vite: not found`** | `evidence/.../build.log` |
| Compilación Vue, Electron y GPU/WebGL | **NO VERIFICADOS** | Entorno sin dependencias instaladas |

Los casos **DOCK-30** y **DOCK-C09** fallan con el mismo diagnóstico también en CORR-004, antes de aplicar esta corrección. No se atribuyen a CORR-005 ni se alteraron sus subsistemas.

## QA local pendiente

1. Abrir The Room desde el Project Browser y confirmar que Edit Mode dibuja desde el primer montaje sin requerir clic o foco previo.
2. Con Edit/Play en el mismo grupo, alternar las dos pestañas y verificar que cada canvas se recupera en su vista.
3. Separar ambas vistas, redimensionar el grupo, flotar y volver a acoplar cada vista; comprobar que ninguna queda negra.
4. Iniciar Play, entrar a Edit Mode, volver a Play, Pause, Step, Stop y Restart; comprobar actualización e input independientes del foco.
5. Minimizar y restaurar Electron; repetir con cambios de proyecto y cierre de ventana flotante.
6. Confirmar que gizmos, selección, Inspector, Frustum y Occlusion Culling siguen funcionando y que las preferencias guardadas no se alteran accidentalmente.
7. Medir consumo GPU y FPS en el equipo objetivo; no asumir paridad de render sin evidencia.

**Estado:** pruebas Node acreditadas, compilación/QA local bloqueados, no aprobado ni cerrado.
