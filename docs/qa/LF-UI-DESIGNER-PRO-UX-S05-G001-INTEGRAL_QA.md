# LF-UI-DESIGNER-PRO-UX-S05-G001-INTEGRAL — Matriz QA

## Automatización en raíz del proyecto

1. `node --test scripts/test-ui-designer-pro-ux-s05-g001-integral.mjs` — esperado 15/15 PASS, sin ejecutar cambios en proyectos personales.
2. `node --test scripts/test-ui-designer-pro-ux-s05-g001-integral-electron.mjs` — esperado 1 PASS, al menos 16 checks DOM Vue en Electron embebido; **NO VERIFICADO** en entrega.
3. `npm run build` — Editor y Player terminan sin errores; **NO VERIFICADO** en entrega. Las advertencias de bundling no son QA visual.
4. `npm run electron` — QA visual manual del usuario, no reemplazable por tests DOM.

## Pruebas locales obligatorias (S05)

| ID | Acción | Resultado requerido | Estado |
|---|---|---|---|
| UX-01 | Abrir `.ui` nuevo en Diseño | Paleta / Jerarquía / Canvas / Inspector visibles, misma paleta grafito | PENDIENTE |
| UX-02 | Buscar herramienta por nombre con/sin tilde | Resultados del catálogo original; limpia búsqueda y reaparecen todas | PENDIENTE |
| UX-03 | Expandir/plegar grupos y seleccionar herramienta | Estado distinguible, doble clic añade control, no se duplica catálogo | PENDIENTE |
| UX-04 | Dibujar y seleccionar control desde Canvas | Marcador/handles con acento del Editor; mouse y teclado no pierden selección | PENDIENTE |
| UX-05 | Cambiar selección desde Jerarquía con clic y Enter/Espacio | Inspector cambia entre Formulario y tipo real, sin selección fantasma | PENDIENTE |
| UX-06 | Mover/reparentar control en Jerarquía | Posición global se conserva, no hay ciclos ni pérdida de controles | PENDIENTE |
| UX-07 | Modificar posición, anclajes, aspecto, eventos | Cambios reales y guardados; no sólo UI decorativa | PENDIENTE |
| UX-08 | Canvas: resolución, Zoom y Snap | Actualizan vista y ajuste sin cambiar el diseño al sólo cambiar Snap/Zoom | PENDIENTE |
| UX-09 | Asignar textura y audio desde Assets | Drop conserva referencias en la `.ui` y las mismas validaciones | PENDIENTE |
| UX-10 | Guardar y reabrir `.ui` | Mismos controles, propiedades, jerarquía y eventos | PENDIENTE |
| UX-11 | Abrir `.ui` con HTML editado manualmente | No se regenera ni borra HTML sin confirmación | PENDIENTE |
| UX-12 | Alternar Diseño/HTML/Script/Estilo | CodeMirror y vista previa siguen funcionando | PENDIENTE |
| UX-13 | Ventana estrecha, dock y floating, redimensionar | Canvas utilizable y paneles sin desbordamientos | PENDIENTE |
| UX-14 | Player / juego con interfaz guardada | Se conserva runtime y exportación sin transformación extra | PENDIENTE |
| UX-15 | Cerrar y reabrir Editor | No hay datos perdidos, ni cambio de configuración del proyecto por preferencias de paleta | PENDIENTE |

No marcar QA LOCAL PASS, COMPILADO, ELECTRON PASS ni CERRADO sin resultado del usuario. El desarrollo de IntelliSense para anotaciones de tipos JavaScript queda **PENDIENTE PLANIFICADO** y fuera de S05.

## Resultado de aceptación posterior (2026-11-03)

El usuario aprobó S05 («AProbado. Sigamos.»). Se considera **QA LOCAL PASS declarado** para la intervención integral, sin logs individuales de UX-01..UX-15. Se conserva la matriz original como contrato y no se fabrican salidas para cada caso. Electron S05 y compilación S05 continúan **NO VERIFICADOS** en la evidencia disponible. Ver evidencia de aprobación y documento CLOSE.
