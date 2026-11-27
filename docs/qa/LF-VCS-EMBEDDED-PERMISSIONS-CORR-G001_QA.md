# QA — LF-VCS-EMBEDDED-PERMISSIONS-CORR-G001

**Estado de entrega:** IMPLEMENTADO. QA local de Git/Electron y aceptación del usuario pendientes; no CERRADO.

## Evidencia disponible en esta entrega

| ID | Resultado | Evidencia y límite |
|---|---|---|
| VCS-P01/P02 | PASS | Tres ELF válidos, test de extracción simulada `0644` a `0755` |
| VCS-P03/P04/P05 | PASS | Idempotencia; archivos ajenos preservados; auxiliar ausente, enlace simbólico y archivo inválido bloqueados |
| VCS-P06 | PASS estático | Windows sin preparación Linux |
| VCS-P07/P08 | PASS real | Git embebido `2.47.3` ejecutado con `PATH` sin Git del sistema; `GIT_EXEC_PATH` correcto |
| VCS-P09 HTTP/HTTPS | PASS local | Ambos helpers conectan a loopback; reciben rechazo esperado del puerto cerrado, sin `EACCES` |
| VCS S01–S04 | PASS | 47/47 Node, incluye smoke HTTPS con CA y servidor local; prueba HTTPS usa recursos Linux del entorno |
| Regresión S03 | PASS | 88/88 Node de docking y geometría; código de paneles sin cambios |
| Distribución `source` | PASS tras `dist:prepare` | Recursos fuente verificados, sin ejecución AppImage/DEB |
| Distribución general | 121/123 PASS | 2 fallos preexistentes por `.github/workflows/desktop-build.yml` ausente del baseline |
| Reparación en startup Electron | PASS para permisos | Tras poner tres ejecutables en `0644`, `node scripts/electron-start.mjs` los restauró a `0755` antes de fallar posteriormente por Vite ausente |
| Build Editor/Player | NO VERIFICADO | `npm run build` detenido por `vite: not found` en este entorno |
| Electron UI/Versiones | NO VERIFICADO | No se inició Electron localmente para este Gate |
| Linux AppImage/DEB | NO VERIFICADO | No se generaron ni ejecutaron paquetes reales |
| QA local del usuario | PENDIENTE | El usuario ejecuta pruebas en su equipo |

Los resultados de consola se conservan en `docs/qa/evidence/LF-VCS-EMBEDDED-PERMISSIONS-CORR-G001/`.

## Instalación

**Opción recomendada:** extraer `LevelForge_VCS_EMBEDDED_PERMISSIONS_CORR_G001_SOURCE_BASELINE.zip` en una carpeta nueva, sin sobrescribir el proyecto local. O aplicar CHANGE solo a una copia fiel de `LevelForge_EDITOR_DOCKING_S03_G001_INTEGRAL_CORR-002_SOURCE_BASELINE.zip`, comparando primero cualquier cambio local.

No reemplazar escenas, Assets, datos personales ni `node_modules`. No combinar ambos ZIP. Mantener el baseline anterior hasta aprobar QA.

## Comandos para el usuario — desde la raíz del proyecto

```bash
npm run vcs:prepare
ls -l vendor/git/linux-x64/bin/git vendor/git/linux-x64/libexec/git-core/git-remote-http vendor/git/linux-x64/libexec/git-core/git-remote-https
node --test scripts/test-vcs-embedded-permissions-corr-g001.mjs
npm run vcs:test
npm run build
npm run electron
```

Esperado: `npm run vcs:prepare` termina sin error; tres archivos aparecen con `-rwxr-xr-x`; 12/12 pruebas específicas PASS y regresión VCS S01–S04 PASS; build termina con Editor/Player completos; en Electron, **Versiones** obtiene `git version 2.47.3` sin `spawn EACCES`. Comprobar además crear/consultar un repositorio de prueba, sin modificar el proyecto principal.

La prueba opcional de distribución Linux es `npm run dist:linux:package`; solo marcar AppImage/DEB PASS después de generar y ejecutar realmente los instaladores. La preparación genera recursos de distribución que faltan mediante scripts existentes. No ejecutar este paso cuando solo se desea validar el Editor de desarrollo.

## Evidencia que devolver

Salida de la prueba específica y de `npm run vcs:test`; resultado de build; si el panel Versiones abre sin error `EACCES` y permite inicializar Git en un proyecto de prueba; cualquier error con su texto exacto. Para AppImage/DEB, resultado de ejecución del paquete si se generó.

## Reglas de cierre

No declarar FIXED, QA LOCAL PASS ni CERRADO hasta que el usuario valide el entorno. Mantener S03 CORR-002 abierto por su QA visual independiente.

## Evidencia del usuario y cierre — 2026-11-03

**Aprobación expresa:** «Aprobado». Registro de salida local: `docs/qa/evidence/LF-VCS-EMBEDDED-PERMISSIONS-CORR-G001/user-qa-local-2026-11-03.log`.

| Comprobación | Estado confirmado |
|---|---|
| `npm run vcs:prepare` | PASS; tres ejecutables `-rwxr-xr-x` (`0755`) |
| Pruebas específicas VCS-P01…P11 | 12/12 PASS |
| Regresión `npm run vcs:test` | 35/35 PASS (el texto `unknown option detach` aparece en una prueba, pero la suite termina sin FAIL) |
| `npm ci` | Instalación completada; auditoría advierte 31 vulnerabilidades (17 moderadas, 13 altas, 1 crítica) |
| `npm run build` | PASS: Editor 826 módulos, Player 414 módulos |
| `npm run electron` | **NO VERIFICADO gráfico**: termina en `Downloading Electron binary...`, sin demostración de interfaz levantada |
| AppImage/DEB | NO VERIFICADOS |
| QA local y aceptación | APROBADO POR USUARIO; Gate CERRADO en su alcance |
| Docking S03 CORR-002 | Sigue pendiente de aceptación visual separada |

Las advertencias de Vite y la deuda de seguridad npm no se corrigen en este Gate. La prueba de inicio Electron, cuando se ejecute de extremo a extremo, deberá comprobar la apertura de Versiones sin `EACCES`; no se inventa un PASS gráfico. La aprobación no acredita AppImage/DEB.
