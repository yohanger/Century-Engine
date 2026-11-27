# Documentación de Century Engine 0.26.13

La documentación oficial de esta versión se presenta como un **portal HTML/CSS/JavaScript** independiente del editor y utilizable sin conexión.

- **Navegador / archivo local:** abre [`public/docs/index.html`](../public/docs/index.html).
- **Editor Electron:** selecciona **Ayuda → Documentación** (`F1`).
- **Generación:** `npm run docs:build` actualiza API, comandos y el portal desde el código.
- **Verificación:** `npm run docs:check` comprueba referencias y cobertura.

El portal está organizado en introducción, editor, escenas/nodos, scripting global y por nodo, eventos, física, render, audio, Database, UI, exportación, tutoriales, referencias de API/comandos y solución de problemas.

## Fuente de cada referencia

- **API JavaScript:** `src/core/events/game-api.d.ts` → `docs/referencia/api.md` → portal web.
- **Comandos de eventos:** `src/engine/runtime/events/commandDefs.js` → `docs/referencia/comandos.md` → portal web.
- **Nodos:** definiciones en `src/engine/runtime/nodes/`, convertidas a páginas individuales.
- **Manuales:** `docs/web-src/*.md`, convertidos a HTML durante la generación.

La documentación legacy en `docs/guia/` se conserva como apoyo histórico, pero el portal web es el punto de consulta principal. La API declarada no certifica por sí sola las pruebas visuales o físicas en todas las plataformas.
