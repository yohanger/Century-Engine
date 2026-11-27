# S09 CONT-005 CORR-001 — GitHub repository cleanup (QA review)

**Gate autorizado literalmente:** `Listo. CENTURY-FLUIDS-S09-G001-CONT-005-CORR-001-INTEGRAL-GITHUB-REPOSITORY-CLEANUP autoriza comenzar`.

## OBSERVADO antes del cambio

El ZIP actual aportado por el usuario contenía **2.234 entradas**, incluido `dist/`, `playground/node_modules/` (incluidas dependencias anidadas) y `playground/.local/century-fluids-0.1.0.tgz`. Al excluir exclusivamente directorios instalados/generados, quedaban **249 archivos fuente/evidencia** anteriores al Gate. Se compararon con CONT-005; se identificaron modificaciones físicas y de escenario recientes que **no podían sustituirse** por el SOURCE_BASELINE anterior.

## IMPLEMENTADO

- `package.json`: seis scripts npm útiles. Retirados todos los aliases por Sprint y benchmarks que el usuario indicó, además de duplicados de Vite/browser/legacy. Mantener `npm run qa` y `npm run playground`.
- `qa/verify_s02.py` a `qa/verify_s09.py`: los antiguos nombres npm fueron sustituidos por invocaciones directas de los archivos internos, incluidos los procedimientos para Jolt real y Vite. No se eliminan tests ni benchmarks.
- `.gitignore` y `.gitattributes`: impedir que Git añada dependencias locales, builds, tarballs, cachés y secretos, preservando los archivos QA que dan evidencia.
- `README.md` y documentos operativos activos: estado real del playground, forma de arrancar, comandos actuales, limitaciones, distribución y advertencia explícita sobre licencia.
- `tests/repository_hygiene.test.mjs` y `qa/verify_repository_cleanup.py`: prevenir reintroducción de aliases obsoletos y regresiones de publicación.
- Ledger de seis hojas actualizado sin alterar el historial; S08 EN PAUSA, S10 NO AUTORIZADO, S09 CONT-005 ABIERTO.

## EXCLUSIONES DEL ENTREGABLE

`dist/`, `**/node_modules/`, `playground/.local/` y cualquier caché/build están **fuera de los ZIP entregados**, pero no se modifica ni borra el archivo ZIP original que proporcionó el usuario. El SOURCE_BASELINE contiene el árbol de fuente/evidencia y no los artefactos del entorno local. La versión TypeScript de `dist/` se recompila con `npm run build` / `npm pack`.

## QA

El registro detallado de los comandos y resultados está en `qa/S09_CONT005_GITHUB_CLEANUP_RUN.log`. Comparar con el ZIP actual y el baseline anterior; verificar integridad de manifiesto, paquete ESM, suite Node, esquema de ledger, direct runners sin aliases y SHA-256 de delta.

**No verificado en esta intervención salvo registro expreso:** Jolt WASM real posterior a la limpieza, Brave manual y criterios de FPS, aprobación visual, equilibrio hidrostático general. Limpieza de Git ≠ terminación de S09.

## DECISIONES PENDIENTES

- GitHub público o privado y selección expresa de licencia (se mantienen `private: true` y `UNLICENSED`).
- Aprobación de usuario del Gate CORR-001 tras QA local.
- Aceptación de S09 y eventual reactivación de S08 independiente, con autorización propia.
