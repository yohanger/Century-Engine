# Mantener la documentación

## Fuente única de referencias

- API: `src/core/events/game-api.d.ts`.
- Comandos de eventos: `src/engine/runtime/events/commandDefs.js`.
- Nodos: `src/engine/runtime/nodes/` y el registro `registry.js`.
- Contenido editorial: `docs/web-src/*.md`.

## Reconstrucción

Con dependencias instaladas:

```bash
npm run docs:build
npm run docs:check
```

La generación utiliza el generador existente de referencias Markdown y luego crea el portal estático `public/docs/content.js`, consultado por `index.html`. No se requieren peticiones de red en tiempo de lectura.

## Al añadir API o comandos

Edita el archivo de definición real, regenera las referencias y ejecuta el test. **No edites a mano las firmas generadas.** El catálogo de comandos del Editor es distinto al de eventos.

## Integración Electron

Ayuda → Documentación abre la misma copia estática que puede consultarse en un navegador. El archivo `public/docs/index.html` funciona con `file://` sin servidor; Vite copia la carpeta `public` al resultado de compilación.

## Validación

Comprueba cobertura, ids únicos, enlaces internos, búsqueda, modo offline, navegación y diseño con docks estrechos. La prueba visual real de Electron sigue siendo parte de QA local.
