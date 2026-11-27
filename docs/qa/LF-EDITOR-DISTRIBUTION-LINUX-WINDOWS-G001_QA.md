# LevelForge — LF-EDITOR-DISTRIBUTION-LINUX-WINDOWS-G001

**Estado:** AUTORIZADO / CONFIGURACIÓN DE DISTRIBUCIÓN IMPLEMENTADA / QA NODE PASS / BINARIOS Y QA REAL NO VERIFICADOS / APROBACIÓN PENDIENTE.  
**Base:** `LevelForge_CSG_SUBTRACT_NODE_CORR_G001_SOURCE_BASELINE.zip` (887 archivos); esta entrega no modifica componentes 3D, CSG, física ni editor de escenas.

## Qué se distribuye

**Editor de LevelForge**, no el juego exportado. Dos plataformas x64 con dos variantes cada una:

| Plataforma | Comando completo | Artefactos esperados bajo `release/` |
|---|---|---|
| Linux | `npm run dist:linux` | `LevelForge-0.26.13-linux-x86_64.AppImage`, `LevelForge-0.26.13-linux-x86_64.deb` |
| Windows | `npm run dist:win` | `LevelForge-Setup-0.26.13-win-x64.exe`, `LevelForge-Portable-0.26.13-win-x64.exe` |

El proceso `npm run build` genera `dist/` (Editor y Film Maker) y `dist-player/` (Player). Los comandos `dist:linux:package` y `dist:win:package` reutilizan las salidas existentes, ejecutan el preflight y verifican la cabecera y tamaño básico de los instaladores. **Una cabecera válida no sustituye abrir el ejecutable.**

Los iconos usan el rombo visual existente de LevelForge: `electron/vendor/icon.png`; recursos de empaquetado `build/icon.png`, `build/icon.ico` y `build/icons/`. No se añade un segundo generador de iconos ni se modifica el icono integrado del juego.

La configuración de electron-builder ya incluía los destinos y dependencias fundamentales, pero carecía de `build/` y de opciones estables para distinguir instalador Windows de portable. Se sustituyó el dominio de actualizaciones de ejemplo por `--publish never`, sin configurar actualizaciones automáticas. **No se firma el código**; Windows puede advertir sobre binarios no firmados. No se debe intentar eludir restricciones corporativas.

## Evidencia ejecutada en el entorno de entrega

| Comprobación | Resultado |
|---|---|
| `node --test scripts/test-editor-distribution-g001.mjs` | **24 PASS / 0 FAIL** |
| Regresión Node (`test-*.mjs`, excluyendo `test-starcat.mjs`) | **2002 PASS / 0 FAIL / 18 SKIP** |
| `node scripts/verify-editor-distribution.mjs source` | **PASS** (configuración, iconos, rutas) |
| `npm run dist:linux` | **BLOQUEADO** (`vite: not found`, exit 127) |
| `npm run dist:win` | **BLOQUEADO** (`vite: not found`, exit 127) |
| `npm ping` | **BLOQUEADO** (DNS `EAI_AGAIN registry.npmjs.org`) |
| Paquetes Linux AppImage/DEB reales | **NO GENERADOS / NO VERIFICADOS** |
| Windows Setup/Portable reales | **NO GENERADOS / NO VERIFICADOS** |
| Instalación, ejecución, Player y rutas entre dos computadoras | **NO VERIFICADOS** |

Las pruebas de firmas de archivos ejecutables usan **fixtures simulados** (cabeceras y tamaños). No representan un empaquetado exitoso.

## Requisitos y comandos para compilar localmente

**Linux:** Node.js y npm correspondientes al lockfile (se recomienda Node 24), acceso a npm durante la primera instalación, Electron Builder. Para DEB pueden ser necesarias herramientas y dependencias del sistema. Ejecutar **en tu copia de LevelForge**:

```bash
cd ~/ENGINES/lf-0.26.13/lf
npm ci
npm run test:distribution
npm run dist:linux
```

Comprueba que existen ambos archivos en `release/`. Para AppImage, concede permiso de ejecución y ábrelo desde la interfaz gráfica. Para DEB, instálalo mediante el gestor de paquetes habitual de tu distribución, comprobando que el acceso directo abre el Editor.

**Windows:** genera los EXE de forma nativa desde Windows o con la tarea `LevelForge Desktop · Linux / Windows` del workflow (requiere alojar tu proyecto en un repositorio privado y ejecutar manualmente GitHub Actions). Si compilas en Windows:

```powershell
npm ci
npm run test:distribution
npm run dist:win
```

GitHub Actions usa `ubuntu-24.04` y `windows-2022`, ejecuta `npm ci` y proporciona artefactos diferenciados `LevelForge-Linux` / `LevelForge-Windows`. Esta automatización **no se ejecutó aquí**. No exige Wine en Linux. Revisa los términos y las políticas de tu empresa antes de transferir o instalar la aplicación.

El instalador Windows puede mostrar avisos SmartScreen por falta de firma digital. La instalación en un PC corporativo requiere permiso de TI cuando aplique. No se incluyen claves de firma ni un mecanismo para eludir controles.

## QA local Linux y Windows (aceptación)

- [ ] **PKG-01:** Linux AppImage abre mediante doble clic; crea/abre proyecto sin Node ni npm.
- [ ] **PKG-02:** DEB instala y abre con acceso de menú; cerrarlo no deja procesos huérfanos.
- [ ] **PKG-03:** Windows Setup se instala y abre, con permisos normales de usuario.
- [ ] **PKG-04:** Windows Portable se abre sin instalación, sin npm.
- [ ] **PKG-05:** Editor carga escenas, mallas, materiales, texturas y recursos WASM sin CDN.
- [ ] **PKG-06:** Player/Play Mode abre, movimiento FPS, física Jolt y audio se reproducen.
- [ ] **PKG-07:** Guardar, cerrar, reabrir y Undo/Redo conservan el proyecto.
- [ ] **PKG-08:** Proyecto creado en Linux: copiar **toda la carpeta** que contiene `project.lfproj` a Windows; elegirla manualmente desde Abrir proyecto y validar recursos.
- [ ] **PKG-09:** Modificar y guardar en Windows; llevar la carpeta de vuelta a Linux y reabrirla sin rutas externas rotas.
- [ ] **PKG-10:** Importar y exportar recursos desde la aplicación empaquetada. Exportación **de juegos** a AppImage solo existe en Linux; este Gate NO añade exportación de juegos Windows.
- [ ] **PKG-11:** La aplicación conserva el proyecto al cerrar mediante la negociación `lf:before-close` y la escritura atómica.
- [ ] **PKG-12:** Si se invoca F12, aparecen las herramientas de desarrollo sin bloquear el guardado.

La carpeta del proyecto es portable; `userData`, el catálogo de recientes y permisos locales del sistema **no** se transportan automáticamente. En el PC de destino, abre de nuevo la carpeta mediante el selector del Editor. No abras el mismo proyecto de forma simultánea desde dos equipos sobre una carpeta sincronizada. Si un proyecto depende de una instalación externa de VS Code/Godot, esa integración deberá configurarse en el equipo destino.

## Alcance y continuidad

Se modifican únicamente la configuración de electron-builder (`package.json`), los recursos de iconos, verificador, pruebas, workflow de build, este informe y ledger de seis hojas. El comando existente `npm run electron` no se altera. El archivo `electron/main.cjs` no se modifica. Se conservan los Gates aprobados y sus fuentes sin reescribirlas.

**Criterio de cierre:** los cuatro artefactos generados, pruebas reales en Linux y Windows, portabilidad de proyecto validada por el usuario. Sin estas evidencias el Gate no se declara APROBADO ni CERRADO.

## Actualización de continuidad 2026-10-29

Se detectó que los SOURCE_BASELINE acumulados posteriores a este Gate **omitían los recursos `build/` y el workflow**, a pesar de que aquí figuraban como entregados. La corrección autorizada `LF-EDITOR-DISTRIBUTION-CORR-001` restaura los archivos reales y añade pruebas de integridad de las imágenes. Ver `docs/qa/LF-EDITOR-DISTRIBUTION-CORR-001_QA.md`. Esta nota no altera la evidencia histórica G001; la generación y ejecución final de los paquetes sigue requiriendo QA de plataforma.
