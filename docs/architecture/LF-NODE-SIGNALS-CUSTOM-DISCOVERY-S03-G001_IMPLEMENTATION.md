# LF-NODE-SIGNALS-CUSTOM-DISCOVERY-S03-G001 — Implementación

**Fecha:** 2026-11-02. **Estado:** IMPLEMENTADO · QA LOCAL PENDIENTE · NO CERRADO.

## Auditoría

**Observado:** `customSignals` calculaba exclusivamente las conexiones persistentes salientes. Multiscript `scriptIds[]` y recursos `project.scripts[]` ya son la fuente de autoría; `NodeScriptRuntime` solo registra señales custom durante Play. **Causa raíz:** ausencia de descubrimiento conservador en Edit Mode; el filtro de conexiones no representa declaraciones sin enlaces.

## Modificaciones de producción

1. `src/engine/runtime/scene/node-scripts.js`: funciones puras y sin hooks `signalTokens`, `literalSignalCalls`, `discoverNodeSignals`. Solo recorren los códigos solicitados del nodo. Omiten comentarios, strings, plantillas y regex reconocibles, capturan argumentos literales sin escapes; producen `{signals:[{name,owners,nativeCollision,duplicate}],diagnostics}`. Reutilizan `nodeScriptIds()` y `getNativeSignal()`. No crean caches, no evalúan JS y no alteran `NodeScriptRuntime` ni el esquema persistente.
2. `src/components/SignalConnectionsPanel.vue`: `computed` para descubrimiento estático sobre el nodo seleccionado y sus Scripts de Nodo, unión con conexiones guardadas, etiquetas de nivel de certeza y propietarios; diagnósticos para nombres nativos reservados, duplicados, referencias inválidas y argumentos dinámicos. Se conserva el diálogo, la funcionalidad conectar/editar/desconectar y el historial.

## Riesgos y límites

El lexer no intenta una AST completa; no resuelve alias, accesos calculados, nombres interpolados, escapes ni condiciones del flujo de control. El análisis puede mostrar candidatos nunca ejecutados y no puede garantizar que un script valide en Play; la interfaz marca este estado. Un script de usuario puede ejecutar un nombre dinámico legítimo en runtime sin ser descubrible estáticamente. El contrato no bloquea esa señal ni altera el script.

Una conexión guardada cuya declaración no se reconoce sigue visible, sin mutar su contenido. Si el nombre coincide con un nativo, el nombre permanece en la sección nativa mientras los diagnósticos explican la colisión en los scripts; no se permite ocultar advertencias por filtrado.

## Evidencia

La suite de 28 pruebas focales usa importaciones de registry sin Three.js instalado mediante stubs de registro independientes. La regresión abarca historial de Signals/Multiscript y emisores Jolt/Audio/Animation. Runner Electron Vue+WebGL2/Jolt preparado para ejecución en el equipo del usuario. Sin Vite en este entorno no se confirma Electron ni compilación. Consultar `docs/qa/LF-NODE-SIGNALS-CUSTOM-DISCOVERY-S03-G001_QA.md`.
