# LF-NODE-SIGNALS-GODOT-COMPARATIVE-AUDIT-S00-G001 — Contrato y dictamen S00

**Gate:** documental/autorizado. **Parent:** LF-NODE-SIGNALS-MULTISCRIPT-CONTRACT-AMEND-G001; SOURCE_BASELINE `LevelForge_NODE_MULTISCRIPT_S01_G003_SOURCE_BASELINE.zip` (1.554 archivos). **Fecha:** 2026-11-02.

## Objetivo y mecanismo autorizados

Auditar la referencia Godot 4.x y los módulos reales de LevelForge para documentar paridad visual, semántica, interna y de persistencia de Signals, con inventario por familias, causas de diferencias, riesgos, dependencias y Gates posteriores de implementación **no autorizados**. No escribir código, modificar el Inspector, Jolt, el Player, shaders ni archivos de recursos. **0 cambios de producción es criterio contractual**.

## Prerrequisitos comprobados

- Baseline Multiscript S01-G003 íntegro y aprobado por usuario; el ledger de G003 incorporará su aprobación y evidencias recientes de Node, Electron y build.
- Amendment de Signals/Multiscript ya aprobado y vinculante; se preserva el historial de S01–S06 y S01 Multiscript.
- Fuentes Godot 4.x oficiales documentadas por URL en `_AUDIT.md` y referencias a rutas reales.

## Alcance permitido y medios indispensables

Solo: el presente contrato, `_AUDIT.md`, `docs/qa/LF-NODE-SIGNALS-GODOT-COMPARATIVE-AUDIT-S00-G001_QA.md`, actualización del QA histórico G003 por aprobación y las seis hojas del ledger. Se reutilizan los test Node existentes **sin crear runners**; Electron no es requisito para este Gate documental. Dos ZIP exactamente: CHANGE (solo documentos y ledger) y SOURCE_BASELINE íntegro.

## Condiciones vinculantes para la siguiente declaración

1. **No declarar equivalencia Godot** basándose en apariencia, nombres de callbacks o nombres de nodos similares.
2. Toda señal nativa deberá documentar tipo propietario, emisor real, fase, condiciones, firma y payload estable, cómo se conecta/desconecta, soporte Editor/Player y regresión. Si no existe origen, estado AUSENTE o NO VERIFICADO; nunca marcar IMPLEMENTADO.
3. El orden de la activación de `signalConnections` **posterior a `_ready`** se tratará explícitamente antes de ofrecer `ready` o `tree_entered` como nativas; no retroactividad simulada.
4. Las cuatro señales de Area3D ya aprobadas deben preservarse, con evaluación de la forma del argumento propio de LevelForge; no transformar objetos arbitrarios en Node3D por analogía Godot.
5. Metadata de custom signals/métodos debe obtenerse sin ejecutar scripts en Edit Mode. Respetar multinstancia y colisiones de nombres de `node.define_signal()` y `node.expose()`.
6. `signalConnections` sigue siendo una sola fuente de autoría de escena, con runtime `NodeScriptRuntime` como ejecutor. No agregar buses, tablas persistidas o helpers genéricos paralelos. Migración de esquema solo mediante Gate que la declare.
7. Godot Deferred/One Shot, argumentos vinculados y autogeneración de callbacks **continúan excluidos** hasta que el usuario defina su prioridad y se autorice mecanismo real.
8. El rediseño debe reutilizar `InspectorDock` y `SignalConnectionsPanel`, con árbol, doble clic, receptor jerárquico, acciones sobre conexión y navegación verificable. Eliminar la pestaña Terreno solo cuando el Inspector contextual conserve toda su funcionalidad.
9. La corrección de Consola se mantiene **aplazada hasta el final** de los trabajos de Signals y Terreno.

## Contradicciones y resolución

- **OBSERVADO:** el contrato anterior S06-G001 aceptaba una UI que enumera únicamente cuatro señales Area3D; el Amendment posterior exige señales reales de diferentes nodos y UX tipo Godot. Por jerarquía documental, el Amendment aprobado **supersede solo los requisitos UX incompatibles**; la persistencia, identidad, QA y runtime previamente aprobados siguen vinculantes.
- **OBSERVADO:** los callbacks `_ready/_enter_tree` son ejecución del ciclo de vida, **no** eventos conectables. La activación actual posterga los vínculos editoriales hasta después de `_ready`. No autorizar `ready` en el catálogo antes de resolver la contradicción temporal.
- No se encontró contradicción que impida una auditoría **sin implementación**. Las contradicciones técnicas pendientes se documentan para resolución por los Gate(s) de Signals siguientes, no se ocultan.

## Evidencia y estado de cierre

AUDITORÍA COMPLETADA, 153/153 Node PASS focal leídas/ejecutadas, baseline íntegro, producción intacta; comparación `_AUDIT.md` y QA `_QA.md`. QA contractual del usuario **PENDIENTE**; no marcar APROBADO/CERRADO antes de su respuesta. Los test Electron/build no se ejecutaron en este Gate documental. El ledger refleja estados, no expectativas.

**Siguiente acción real:** entregar dos ZIP, solicitar QA contractual del usuario y, después de aprobación, declarar el primer Gate de catálogo y señales nativas según prioridades del usuario. Este contrato no autoriza implementar señales.
