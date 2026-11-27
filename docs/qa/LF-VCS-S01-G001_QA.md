# LF-VCS-S01-G001 — Protocolo y evidencias

| Prueba | Resultado / evidencia |
| --- | --- |
| Git embebido Linux con `PATH` vacío | PASS — test real que usa solo `vendor/git/linux-x64/bin/git` |
| Crear repositorio / status / commit / log | PASS — ejecución real sobre proyecto temporal |
| Bloqueo de acciones y carpetas ajenas | PASS |
| Repositorios anidados | PASS — rechazados |
| Rutas, identidad y mensajes | PASS |
| Renombres y rutas con espacios | PASS |
| MinGit versión/SHA-256 | PASS estático, **sin ejecución Windows** |
| UI dock / guardado previo | PASS estático, **sin prueba visual Vue** |
| Build Editor y Player Vite | PENDIENTE |
| AppImage / DEB y Git embebido runtime | PENDIENTE |
| Windows MinGit Setup/Portable sin Git instalado | PENDIENTE |
| Licencias y fuentes redistribuibles | PENDIENTE revisión final |

**No declarar el Gate cerrado** hasta que se reciban evidencias reales de ambos empaquetados y validación funcional del usuario.

## Ejecución focalizada final

- 8/8 tests propios de Git real (incluidos en 42/42 pruebas focalizadas Git + Road Paint + Shift+A).
- 35/35 tests de distribución.
- 77 pruebas distintas PASS, 0 FAIL, 0 SKIP en esas dos ejecuciones.
- `npm run build` no ejecutable en este entorno (`vite: not found`).
