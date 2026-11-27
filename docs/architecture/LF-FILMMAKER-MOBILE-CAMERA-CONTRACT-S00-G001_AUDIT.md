# Cámara móvil FilmMaker: auditoría S00

Fecha: 2026-11-04. Gate autorizado: `LF-FILMMAKER-MOBILE-CAMERA-CONTRACT-S00-G001`. Autorización literal: «Listo. LF-FILMMAKER-MOBILE-CAMERA-CONTRACT-S00-G001 autoriza comenzar».

Base vinculante: `LevelForge_VSCODE_LOCAL_BRIDGE_S04_G001_CLOSE_SOURCE_BASELINE.zip`, 2.121 archivos, S04 aprobado/cerrado. Comparación inicial: archivos locales idénticos. S00 permite documentos y ledger; no implementación, APK ni nuevo servidor.

## Requisitos recibidos

- El celular cumple la función de cámara del rodaje. El editor del PC conserva la producción.
- Debe verse en el teléfono el escenario virtual por la cámara de FilmMaker mientras se filma.
- La cámara debe detenerse ante una pared virtual aunque el operador siga avanzando físicamente.
- Reutilizar la función ya programada y conectar ambos equipos por red local.
- Equipo móvil declarado: ZTE Blade A56, Z2473, MyOS 15, Android 15, software `MyOs15.0.2_Z2473_LA2`, «4 GB de RAM + 8 GB RAM». No se ha medido la memoria física disponible; se adopta un presupuesto conservador de 4 GB, sin tratar la ampliación declarada como 12 GB físicos certificados.
- PC de referencia: Pentium Silver N5030, 4 GB RAM. No hay medición de codificación de vídeo o latencia LAN en ese equipo.

## Código y dependencias inspeccionados

| Código real | OBSERVADO | Consecuencia para la extensión |
|---|---|---|
| `src/filmmaker/operator.js`, `deviceQuat`, `startSensors` | Lee orientación del dispositivo y corrige orientación de pantalla | Reutilizar conversiones; verificar sensores efectivos en el teléfono |
| `OperatorRig.startAR` | Obtiene posición/cuaternión con WebXR; utiliza el renderer del editor local | Separar adquisición de pose de aplicación al editor del PC; no iniciar WebXR en el PC por recibir datos |
| `OperatorRig.update/apply` | Usa cámara, escena y consulta de suelo locales; aplica posición directamente | No es un cliente remoto ligero; requiere una entrada remota explícita |
| `OperatorRig.ground` | Raycast vertical para altura del suelo | No implementa bloqueo horizontal contra paredes |
| `OperatorRig.sample` | Genera claves `{t,pos,rot,fov}` aproximadamente a 30 muestras/s | Reutilizar grabador y registrar el resultado corregido en el PC |
| `src/filmmaker/session.js`, `startPass/stopPass/viewPass` | Usa reloj del entorno, crea pases y reproduce claves | Mantener un único dueño de cámara y reloj; integrar la fuente remota aquí |
| `src/filmmaker/film.js`, `montage.js` | `.nfm` v4 conserva pases y montaje | Preservar formato, IDs y consumidores; no persistir credenciales LAN |
| `src/filmmaker/FilmApp.vue` | Crea `new Editor`; interfaz móvil conserva paneles y escena | APK actual ejecuta FilmMaker completo, no solo cámara |
| `scripts/build-filmmaker-web.mjs`, `filmmaker-mobile/` | Empaqueta la misma web en Capacitor 8.5.3; plugins Filesystem y Share | Especializar este proyecto existente, sin crear otra aplicación o editor paralelo |
| `MainActivity.java`, Gradle y manifiesto Android | Actividad básica Capacitor; no integración nativa ARCore observada | AR nativo sería implementación futura, no capacidad existente del APK |
| `src/filmmaker/files.js` | Guarda en Documentos y abre compartir | Transferencia manual de archivos; no enlace de cámara en vivo |
| Búsqueda en FilmMaker, Android y captura | No se encontró servidor/receptor LAN, WebSocket o WebRTC de cámara | Emparejamiento, protocolo y monitor son PENDIENTES PLANIFICADOS |
| `capture-app/`, README raíz | Aplicación antigua marcada obsoleta; orientación y captura de actor, sin ARCore | Preservar; no reactivarla como solución del requisito |
| `src/engine/runtime/events/play.js` | FilmMaker corre el entorno sin jugador encarnado | Las colisiones FPS no se heredan automáticamente por la cámara |
| `physics/jolt-character.js`, `jolt.js`, `filmmaker/contact.js` | Existen física/consultas y contacto del actor | Reutilizar motor y consultas; contacto de manos/pies no es colisión del camarógrafo |
| `electron/vscode-bridge.cjs` | TCP loopback y protocolo para extensión VS Code | No convertir ese servicio en el servidor LAN de FilmMaker |

En el ledger no se encontró un Gate específico de cámara móvil AR/LAN ni evidencia de esa integración. Los Gates de Cinematics conservan su responsabilidad de consumir películas FilmMaker; no serán receptores de cámara ni herramientas de autoría remota.

## Compatibilidad AR y límites

Consulta oficial del 2026-11-04: ni Blade A56 ni Z2473 aparecen en la lista pública de ARCore. Esto no demuestra que toda técnica de seguimiento sea imposible; impide asumir ARCore disponible. Sensores efectivos, servicios instalados, permisos y seguimiento real del equipo siguen NO VERIFICADOS.

La ruta AR actual es WebXR. Chromium identifica WebXR entre las APIs no expuestas en Android WebView. La documentación de Google exige dispositivo/navegador compatibles y contexto seguro para WebXR. La configuración `server.androidScheme: https` de Capacitor configura el origen local del WebView; no crea un servidor LAN. `allowMixedContent` está desactivado en la app. La futura conexión debe funcionar sin instrucciones de desactivar validaciones o instalar certificados manualmente para cada uso.

Fuentes primarias y límites de consulta: `../qa/evidence/LF-FILMMAKER-MOBILE-CAMERA-CONTRACT-S00-G001/sources.json`.

## Diagnóstico, inferencias y riesgos

CAUSA de la brecha LAN: adquisición, transformación, render y grabación comparten el mismo proceso/dispositivo; no hay protocolo de entrada remota. La causa no es un botón de conexión deshabilitado.

CAUSA de la ausencia de bloqueo de paredes: el camarógrafo aplica su posición sin resolución de movimiento contra obstáculos. La consulta vertical de suelo no sustituye a esa resolución.

INFERENCIA a verificar: el móvil podrá ser más ligero si deja la escena y el render en el PC. El coste añadido de codificar/devolver el monitor podría ser relevante para el N5030; no hay una cifra de FPS o latencia acreditada.

RIESGO observado: una pose WebXR ausente conserva la última `_ar`; el fin de sesión solo limpia `xr`. El comportamiento de pérdida de seguimiento y de conexión necesita un contrato explícito antes del enlace remoto. No se declara un fallo físico reproducido en un móvil real.

## Incidencia independiente de distribución

La configuración efectiva de electron-builder para `electron-builder.filmmaker.json` usa `electron/filmmaker.cjs`, sin `extraResources`, sin `linux.extraResources` y sin `extends`. Su entrada carga `main.cjs`, que lee de forma síncrona `resources/vscode-extension/manifest.json` al inicializar la integración VS Code.

OBSERVADO: esa dependencia externa no queda cubierta por el paquete propio FilmMaker. INFERENCIA: puede producir ENOENT al arrancar ese AppImage. El arranque real del paquete propio NO se ejecutó. Debe corregirse y probarse en un Gate independiente antes de distribuir el servidor LAN como AppImage. No se modifica ni se reabre el cierre S04 en este Gate documental.

## QA y continuidad

Se ejecutan únicamente pruebas existentes de encuadre, normalización/animación y round-trip ZIP `.nfm`, con salida en `../qa/evidence/LF-FILMMAKER-MOBILE-CAMERA-CONTRACT-S00-G001/node-baseline.log`. No prueban sensores, AR, APK ni red. README cita también tres runners históricos ausentes (`test-filmmaker.mjs`, `test-filmmaker.py`, `test-filmmaker-actor.py`); no se usan como evidencia ni se recrean aquí.

La especialización móvil se propone en el [Amendment](LF-FILMMAKER-MOBILE-CAMERA-CONTRACT-S00-G001_AMENDMENT.md), el comportamiento en el [Contrato](LF-FILMMAKER-MOBILE-CAMERA-CONTRACT-S00-G001_CONTRACT.md) y las dependencias en el [Plan](LF-FILMMAKER-MOBILE-CAMERA-CONTRACT-S00-G001_PLAN.md). Todo queda DOCUMENTADO PARA REVISIÓN, sin aprobar ni cerrar S00 automáticamente.
