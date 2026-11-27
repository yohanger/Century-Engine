# LF-VCS-EMBEDDED-PERMISSIONS-CORR-G001 — Permisos Git embebido Linux

**Gate autorizado:** `Listo. LF-VCS-EMBEDDED-PERMISSIONS-CORR-G001 autoriza comenzar`.
**SOURCE_BASELINE de entrada:** `LevelForge_EDITOR_DOCKING_S03_G001_INTEGRAL_CORR-002_SOURCE_BASELINE.zip`.
**Estado:** IMPLEMENTADO, Node VCS 47/47 PASS, Node S03 88/88 PASS; compilación/Electron y QA local de esta corrección NO VERIFICADOS. No cerrar sin aceptación del usuario.

## Hechos y causa raíz

El ZIP de entrada tenía atributos Unix `0600` para `vendor/git/linux-x64/bin/git`, `git-remote-http` y `git-remote-https`. En la instalación del usuario, `git` estaba con modo `0644`, sin permiso de ejecución; Electron reportaba `spawn .../vendor/git/linux-x64/bin/git EACCES`. El preparador anterior solo aplicaba chmod a `bin/git`, no a los auxiliares HTTP/HTTPS. No se infiere ningún error de comandos Git ni del sistema de docking.

## Integración implementada

- `scripts/prepare-vcs-git.mjs`: amplía el mecanismo existente `prepareGit` en Linux. Primero comprueba los tres archivos regulares, no simbólicos, con cabecera ELF 64-bit x86-64 válida. Después aplica **solo** `0755` a los tres ejecutables cuando sea necesario y verifica `X_OK`. Comprueba `git --version` con la ruta absoluta al binario y `PATH` reducido al directorio embebido; comprueba disponibilidad del `GIT_EXEC_PATH` de los auxiliares. Errores de permisos, dependencias o `noexec` impiden declarar éxito. Comprobación adicional: tras retirar `x` a los tres ejecutables de una extracción de prueba, `electron-start.mjs` restauró `0755` antes de intentar Vite; el arranque total siguió NO VERIFICADO por ausencia de dependencias. No realiza chmod recursivo, instalación global ni sustitución por Git del sistema.
- `scripts/electron-start.mjs` y `scripts/electron-dev.mjs`: llaman al preparador existente únicamente en Linux, antes de crear el proceso Electron y antes del build de inicio. Windows conserva la ruta previa.
- `electron/vcs.cjs`: solo mejora el texto de diagnóstico para `spawn EACCES`, indicando permisos y posible `noexec`; no cambia operaciones VCS ni el aislamiento del runner.
- `package.json` conserva `npm run vcs:prepare` dentro de `dist:linux:package`, antes de electron-builder. Su configuración `build.linux.extraResources` sigue copiando `vendor/git/linux-x64` a `resources/git/linux-x64` fuera del ASAR. No se añadieron dependencias.
- Los tres binarios existentes conservan exactamente sus bytes, pero en los ZIP de este Gate sus metadatos Unix son `0755`. El empaquetado del Gate se valida como ZIP Unix, y se prueba extracción mediante `unzip`. La ejecución desde ZIP extraído se repara automáticamente en `npm run electron` incluso si otra herramienta de extracción descarta los permisos.

**Compatibilidad:** se preservan VCS S01–S04, credenciales, operaciones, formatos de proyecto, Windows, Player y todas las correcciones de docking S03. No se incluye ningún ejecutable externo al Git ya distribuido.

## Dependencias y límites

La ejecución empaquetada en AppImage/DEB y la compatibilidad ABI de las bibliotecas dinámicas **no están demostradas** por un `git --version` local. Deben verificarse en distribución nativa. Un sistema de archivos `noexec` puede seguir prohibiendo ejecución incluso después de `chmod`; se informa con error específico. La suite general de distribución tiene dos fallos históricos por falta de `.github/workflows/desktop-build.yml` en el SOURCE_BASELINE recibido; no se crea ni se modifica un workflow fuera de este Gate.

**Estado de S03:** CORR-002 sigue pendiente de QA visual del usuario. Node 88/88, Electron 44/44 y build Editor/Player PASS aportados por el usuario en su versión S03; no confundirlos con una ejecución Electron/build de VCS realizada aquí.

## Cierre posterior a QA — 2026-11-03

**Estado del Gate:** APROBADO por el usuario y CERRADO en su alcance funcional, tras pruebas locales. La declaración de aprobación del usuario es evidencia de aceptación local; no debe confundirse con cobertura automatizada de todos los escenarios de distribución.

**Observado en la evidencia local:** `npm run vcs:prepare` PASS; los tres ejecutables Git Linux presentan `0755`. Node Gate VCS 12/12 PASS; regresión VCS 35/35 PASS; `npm run build` culminó Editor (826 módulos) y Player (414 módulos).

**Limitaciones verificadas:** la salida de `npm run electron` termina en `Downloading Electron binary...`; no hay constancia de que la interfaz se haya abierto ni de una prueba visual del panel Versiones en ese log. AppImage/DEB no fueron generados y ejecutados en la evidencia aportada. `npm ci` reportó 31 vulnerabilidades en el árbol de dependencias (17 moderadas, 13 altas, 1 crítica); se registra como deuda de seguridad independiente. No ejecutar `npm audit fix` ni actualizar dependencias dentro del Gate ya cerrado.

**Continuidad:** S03 CORR-002 conserva su estado PENDIENTE de QA visual. El SOURCE_BASELINE resultante acumula la implementación VCS aprobada y esta actualización documental, sin modificaciones adicionales al código ni a los permisos ya corregidos.
