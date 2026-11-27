# S01A · Auditoría de prerrequisitos para seguimiento visual 6DoF

Fecha: 2026-11-04. Gate autorizado literalmente: `LF-FILMMAKER-MOBILE-CAMERA-VISUAL-TRACKING-FEASIBILITY-S01A-G001`.

**Estado:** AUTORIZADO · IMPLEMENTACIÓN BLOQUEADA por prerrequisito de S01 no aprobado/cerrado. Este documento no abre S02 ni autoriza una sustitución del requisito de caminar físicamente.

## Evidencia física disponible

El usuario aportó JSON diagnóstico nativo ZTE Z2473 con 40 muestras 3DoF del vector de rotación, cámaras frontal/trasera, permiso concedido, ARCore `UNSUPPORTED_DEVICE_NOT_CAPABLE`, `poseProbe:null` y `hasTranslation:false`. No existe evidencia de pose 6DoF métrica ni soporte ARCore en el dispositivo. El usuario confirmó además el scroll táctil de la pantalla S01. Véase `docs/qa/evidence/LF-FILMMAKER-MOBILE-CAMERA-CAPABILITIES-S01-G001/user-z2473-diagnostic-scroll-pass-20261104.md`.

## Puntos existentes que deberán contrastarse después de cerrar S01

- `filmmaker-mobile/` es el proyecto Android/Capacitor activo; no crear segundo producto.
- `MobileCapabilitiesPlugin.java`, `MainActivity.java` y `MobileCapabilities.vue` concentran adquisición e interfaz de diagnóstico S01; S01A debe extenderlos antes de duplicar.
- El seguimiento posicional con ARCore no es aplicable al Z2473; 3DoF no suple traslación.
- El mecanismo autorizado para viabilidad es adquisición limitada de cámara trasera, calibración de intrínsecos y estimación fuera de línea con marcadores conocidos; el sistema LAN y el control de la cámara virtual siguen excluidos.
- Toda dependencia de AprilTag/OpenCV u otras requiere verificar versión, licencia, instalación y rendimiento antes de incorporación. No hay detector ni estimador de pose implementados en este Gate al redactar esta auditoría.
- El PC conserva autoridad sobre escena, colisiones, render, pases y `.nfm`. El PC solo podrá analizar capturas fuera de línea durante el experimento S01A conforme a su declaración; esto no se convierte en pipeline de tracking productivo.

## Bloqueos antes de implementación S01A

1. Compilar CORR-004 sobre el SOURCE_BASELINE acumulado de S01.
2. El usuario debe comprobar en el Z2473 que los botones respetan permiso concedido/denegado y que el diagnóstico, scroll y exportación no regredieron.
3. Registrar QA local de la corrección y recibir aprobación de cierre de S01.
4. Solo entonces, con el código y las dependencias reauditorados, continuar S01A bajo su autorización literal existente. La entrega de S01A requerirá exactamente dos ZIP y pruebas métricas reales.

**No confundir este bloqueo de implementación con revocación de la autorización de S01A.**

## Desbloqueo e implementación posterior (2026-11-04)

El usuario confirmó QA local del último APK S01 CORR-004: los controles contractualmente deshabilitados permanecen deshabilitados, sin extender esa expectativa al resto. Con el inventario físico, scroll y exportación previamente validados, S01 se declara cerrado en **alcance diagnóstico**, distinguiendo los logs Gradle CORR002 de la confirmación verbal de compilación CORR004. Véase `docs/qa/LF-FILMMAKER-MOBILE-CAMERA-CAPABILITIES-S01-G001_CLOSE.md`.

S01A pudo iniciar implementación bajo autorización existente. El mecanismo elegido es cámara nativa mediante Intent y análisis local con OpenCV AprilTag 36h11 (no procesamiento en red ni seguimiento continuo). La validación física de S01A continúa NO VERIFICADA. Contratos de filmación, colisiones, LAN, Cinematics y .nfm intactos.
