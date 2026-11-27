# Cámara móvil FilmMaker: QA y entrega documental S00

Fecha: 2026-11-04. Estado: DOCUMENTADO PARA REVISIÓN; APROBACIÓN DEL USUARIO PENDIENTE; NO CERRADO. Este Gate produce un contrato y plan, no la cámara remota funcionando.

## Documentos de revisión

- [Auditoría](../architecture/LF-FILMMAKER-MOBILE-CAMERA-CONTRACT-S00-G001_AUDIT.md): código, dependencias, hardware y evidencia.
- [Contrato](../architecture/LF-FILMMAKER-MOBILE-CAMERA-CONTRACT-S00-G001_CONTRACT.md): MC-01 a MC-16.
- [Amendment CA-MC-001](../architecture/LF-FILMMAKER-MOBILE-CAMERA-CONTRACT-S00-G001_AMENDMENT.md): especialización del APK preservando editor y datos.
- [Plan](../architecture/LF-FILMMAKER-MOBILE-CAMERA-CONTRACT-S00-G001_PLAN.md): fases futuras, límites y dependencia de distribución.

## Matriz de aceptación futura

| Requisito | Comprobación necesaria | Gate previsto | Estado real en S00 |
|---|---|---|---|
| MC-01 | APK de cámara/monitor, sin cargar otro editor 3D | S01/S02/S03 | PENDIENTE PLANIFICADO |
| MC-02 | PC único dueño de cámara, escena, reloj y toma | S02/S05 | PENDIENTE PLANIFICADO |
| MC-03 | Reutilización; sin renderer, formato o motor duplicado | Todos | Contrato propuesto; producto sin cambios |
| MC-04 | Diagnóstico en Z2473 real y pose efectiva si se promete caminar | S01/S06 | NO VERIFICADO |
| MC-05 | Origen, escala, ejes y orientación de pantalla sin salto | S01/S02/S05 | PENDIENTE PLANIFICADO |
| MC-06 | Emparejamiento y producción/cliente correctos | S02 | NO IMPLEMENTADO |
| MC-07 | Mensajes dañados, tardíos, ajenos o no finitos rechazados | S02 | NO IMPLEMENTADO |
| MC-08 | Desconexión/tracking perdido suspenden sin toma falsa | S02/S05 | NO IMPLEMENTADO |
| MC-09 | Mismo encuadre virtual, aspecto y FOV; calidad independiente | S03 | NO IMPLEMENTADO |
| MC-10 | Primera imagen válida; detectar congelación; pausa si se pierde | S03/S05 | NO IMPLEMENTADO |
| MC-11 | Medir control/monitor en N5030 y teléfono; ratificar presupuesto | S03/S06 | NO MEDIDO |
| MC-12 | Pared fina, esquina, suelo/techo, giro y movimiento rápido | S04 | NO INTEGRADO EN CAMARÓGRAFO |
| MC-13 | Seguir caminando bloqueado y retroceder sin deuda | S04/S06 | NO IMPLEMENTADO |
| MC-14 | Grabar pose resuelta; reproducción e interpolación sin atravesar | S05 | Grabador base existe; integración pendiente |
| MC-15 | Guardar/reabrir/ZIP/export conservan escena, IDs y pases | S05/S06 | Base existente; nueva integración pendiente |
| MC-16 | Sesión integral en equipos y modalidad de distribución reales | S06 | NO VERIFICADO |

La columna de Gate previsto identifica dependencias, no autorizaciones. El QA integral incluirá intentos de romper el flujo: cambiar película con mensajes pendientes, segundo móvil, pérdida de Wi-Fi/vídeo/tracker, reconexión con origen distinto, grabación duplicada, avance prolongado contra pared, retroceso inmediato, esquina y reapertura de la película.

## Comprobaciones de S00

- Baseline inicial comparado con el ZIP S04 CLOSE aprobado: 2.121 archivos idénticos; no había modificaciones locales previas.
- Fuentes externas primarias consultadas y ausencia de Z2473/Blade A56 en lista pública registradas en `evidence/LF-FILMMAKER-MOBILE-CAMERA-CONTRACT-S00-G001/sources.json`. No se atribuye a esa consulta una prueba del teléfono real.
- Configuración FilmMaker independiente inspeccionada en modo lectura: entrada compartida sin extraResources. No se ejecutó el AppImage; la incidencia está documentada sin corrección de código.
- Pruebas Node existentes del baseline ejecutadas con registro en `evidence/LF-FILMMAKER-MOBILE-CAMERA-CONTRACT-S00-G001/node-baseline.log`. Se separan de cualquier QA AR/LAN/Android futuro.
- Integridad documental, enlaces relativos, requisitos MC-01…MC-16, referencias de fases y preservación del ledger se verifican antes de empaquetar. Las seis hojas registran el Gate actual y el trabajo futuro como no autorizado; EVIDENCE solo añade hechos ya observados.
- Código, scripts, dependencias, configuración de producción, VSIX y proyectos permanecen idénticos a la base. No se hace una nueva compilación ni QA visual por cambios exclusivamente documentales.

## Entrega e instrucciones

Exactamente dos ZIP: `LevelForge_FILMMAKER_MOBILE_CAMERA_CONTRACT_S00_G001_CHANGE.zip` y `LevelForge_FILMMAKER_MOBILE_CAMERA_CONTRACT_S00_G001_SOURCE_BASELINE.zip`. El inventario detallado está en `LF-FILMMAKER-MOBILE-CAMERA-CONTRACT-S00-G001_FILES.md`. No se entrega SHA separado ni .sh.

CHANGE: solo archivos nuevos/modificados de documentos, evidencia y ledger. Aplicarlo sobre una copia exacta del SOURCE_BASELINE S04 CLOSE aprobado, comparando cualquier cambio local antes de reemplazar rutas. No eliminar archivos ni tocar código, proyectos, Assets, perfiles de VS Code, node_modules, builds o APK instalados.

SOURCE_BASELINE: copia completa acumulada para el próximo Gate. Extraer en carpeta nueva `~/Desktop/LevelForge_FILMMAKER_MOBILE_CAMERA_CONTRACT_S00_G001_SOURCE_BASELINE`, con package.json en su raíz. No aplicar ambos ZIP uno sobre otro. Mantener la base S04 CLOSE y los proyectos del usuario hasta aprobar S00; conservar el nuevo baseline como base del siguiente Gate después de aprobarlo.

No hay comandos obligatorios de instalación, compilación o prueba móvil para revisar este Gate documental. Si se quiere repetir la regresión de base, desde una carpeta que ya tenga sus dependencias:

```bash
node --test --test-concurrency=1 scripts/test-filmmaker-frame-s01-g001.mjs scripts/test-filmmaker-anim-s01-g001.mjs scripts/test-filmmaker-anim-zip-s01-g001.mjs
```

Salida esperada: 21/21 PASS. Esto no prueba sensores, seguimiento AR, APK, visor LAN o colisiones nuevas. No se pide repetir pruebas ya declaradas para revisar únicamente documentos.

## Evidencia a devolver y cierre

Revisar responsabilidades móvil/PC, necesidad de visor, avance bloqueado descartado, presupuesto medido y condición de diagnóstico del Z2473. Devolver aprobación documental o correcciones concretas. No hacen falta nuevos logs para aprobar este contrato; no se aprobará por ello la implementación de una función todavía inexistente.

La aprobación de S00 ratifica el contrato y CA-MC-001. Se registrará después y se actualizarán las seis hojas al cerrar. Hasta recibirla, S00 permanece abierto; no se declara aprobado, implementado el sistema remoto ni cerrado el Sprint. La siguiente acción será declarar S01 de capacidades, con medios y autorización literal propios.
