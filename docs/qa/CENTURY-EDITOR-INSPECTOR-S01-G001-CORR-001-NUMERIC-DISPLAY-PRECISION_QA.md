# QA — precisión de presentación

Estado: implementado en fuentes, pendiente de QA Electron y aprobación. Base original 4070 archivos, verificada byte a byte; SHA256 6b4d968727842a3fda292220b01323dedbe2dc80eb43a54cd3ca676b6ca26de5. No se tiene acceso al árbol local del usuario.

Se separa displayDecimals de decimals, sin modificar la cuantización operativa. Enfoque revela precisión completa; valores mixtos conservan el estado vacío hasta una edición explícita; las propiedades no opt-in no cambian. Cambios limitados a componentes editoriales.

## QA ejecutado
- Antes: 10/16 PASS en el runner de handlers con las seis nuevas comprobaciones; después: 16/16 PASS.
- Suite de presentación: 49/49 PASS. Con integridad numérica adicional: 59/59 PASS.
- Electron: 0/13 comprobaciones ejecutadas, runner bloqueado por falta de Vite. Compilación bloqueada por la misma dependencia.
- Los handlers se ejecutan aislados; no se acredita montaje de Vue ni visual real hasta el QA local.

## QA local
`npm run test:suite -- numeric-display-precision`

`npm run test:suite -- numeric-display-precision-electron`

Verificar manualmente nodos, selección múltiple y Edit Mesh: máximo dos decimales en reposo, precisión completa al editar, cancelar y confirmar sin modificar inadvertidamente el modelo, y Snap/arrastre/Undo/Redo intactos. No se cierra sin aprobación.
