# LF-NODE-SIGNALS-GODOT-UX-S04-G001 — QA

**Estado:** IMPLEMENTADO · TEST NODE PASS · ELECTRON/BUILD NO VERIFICADOS · QA LOCAL PENDIENTE · NO CERRADO.

| Evidencia | Resultado |
|---|---|
| S04-G001 suite nueva, `scripts/test-node-signals-godot-ux-s04-g001.mjs` | 18/18 Node PASS |
| 20 suites focales acumuladas, incluidas todas las pruebas S01–S03, Audio, Animation, Multiscript y CharacterBody3D/Area3D | **391/391 Node PASS**, 0 FAIL, 0 SKIP |
| `node scripts/gen-docs.mjs --check` | PASS — referencia al día |
| `scripts/test-node-signals-godot-ux-electron-s04-g001.mjs` | NO VERIFICADO — no se dispone de Vite para levantar fixture Vue |
| `npm run build` | NO VERIFICADO — `vite: not found` |
| QA visual Godot 4.7 | PENDIENTE DE USUARIO |

## Comandos locales

```bash
npm ci
node --test scripts/test-node-signals-godot-ux-s04-g001.mjs
node --test scripts/test-node-signals-godot-ux-electron-s04-g001.mjs
node --test scripts/test-node-signals-custom-discovery-s03-g001.mjs
node scripts/gen-docs.mjs --check
npm run build
npm run electron
```

## QA visual comparativo — Godot 4.7

Usar como referencias oficiales `https://docs.godotengine.org/en/4.7/_images/signals_11_pressed_signals.webp` (lista), `https://docs.godotengine.org/en/4.7/_images/signals_12_node_connection.webp` (modal básico).

1. En Inspector > Señales elegir un Area3D. Verificar grupo Nodo, Animación y Area3D según metadata, firmas `body_entered(event: Area3DEvent)` y `animation_finished(clipName: string)`, en filas compactas. **No debe verse la antigua lista de tarjetas.**
2. Doble clic sobre `body_entered`: debe aparecer ventana de conexión con la señal preseleccionada, emisor indicado, árbol de escena y campo de método. Seleccionar receptor hijo de otro nodo y comprobar indentación; buscarlo por nombre y constatar que siguen visibles sus ancestros.
3. Indicar un método publicado mediante `node.expose()` y conectar. La conexión aparece como hija de la señal, con estado Registrada. Editar método, Undo/Redo, desconectar y Undo.
4. Crear Custom Signal literal sin conexiones; debe figurar en Personalizadas, con contador 0 y etiqueta de detección estática. Añadir colisión con nombre reservado o declaración duplicada: mostrar diagnóstico sin ejecutar JavaScript en Edit Mode.
5. Probar búsqueda, plegar/expandir, Enter, Escape, flechas y Tab; comprobar foco y que modal no se corta con dock estrecho.
6. Entrar en Play: la conexión se activa solo cuando existe el método receptor real, se deshabilita edición en Play y no aparecen conexiones duplicadas. Reiniciar Stop/Play.
7. Verificar terreno y panel Inspector no afectados; preservar Editor y Player, carga/guardado de escenas y recursos existentes.

**Evidencia a devolver:** resultado del runner Electron, build Editor/Player, capturas comparativas de lista/modal y cualquier incidencia con secuencia de reproducción. Compilar no sustituye QA visual.

## Predecesor S03-G001

El usuario respondió «Aprobado. Sigamos. Para el rediseño mira a Godot». Corresponde a **QA LOCAL PASS DECLARADO y APROBADO de S03-G001**, sin adjuntar nuevos logs de Electron/build. El registro administrativo de esa aprobación se incorpora al ledger S04; no se inventan pruebas ausentes.

## QA local posterior — incidencia contextual

El usuario aportó dos capturas en el Editor el 2026-11-02 y manifestó «Sí, pero no»: el diálogo de S04-G001 permite iniciar conexión desde botón genérico con campo de señal libre. Decidió expresamente **Modelo A: Signals contextual como Godot**. S04-G001 queda **QA CON OBSERVACIONES / NO APROBADO**, sujeto al Gate correctivo autorizado `LF-NODE-SIGNALS-GODOT-UX-S04-G001_CORR-001`; los 391/391 Node PASS originales no demuestran aceptación funcional de la interfaz.
