# Recuperación de puntero editorial

Autoridad: ratificación literal del alcance de CENTURY-EDITOR-STABILITY-S01-G001-CORR-001-INTEGRAL-POINTER-RECOVERY-AND-DIAGNOSTICS. Este documento concreta la recuperación sin sustituir las autoridades previas de navegación, captura, selección y ventanas. No modifica el contrato Player. No se introduce un Amendment que cambie una autoridad ratificada.

## Invariantes

- ContinuousGrab conserva movimiento continuo y cursor virtual. Una solicitud editorial pendiente y una captura propia como máximo por documento. La reserva pendiente tiene un límite de 1000 ms; una cancelación restaura el estilo y termina el callback una vez, aunque la respuesta nativa todavía no haya llegado.
- Las respuestas tardías se asocian a la solicitud que las originó cuando existe Promise. Para implementaciones que solo emiten eventos, la vigilancia adicional es de 2000 ms y termina al comenzar una solicitud posterior; no es posible distinguir dos concesiones para el mismo elemento únicamente por un evento nativo sin identidad. No apropiarse de una captura de Player ni de otro elemento. No recapturar Pointer Lock sin gesto.
- Liberación del bloqueo propio: intento inmediato, un reintento a los 250 ms si sigue presente. Si persiste, registrar `release-timeout` y `release-not-confirmed`; Escape puede repetir la liberación propia. El estado nativo prevalece sobre el local; no fingir que el navegador desbloqueó el ratón.
- Escape durante espera y captura, blur, visibilidad, pointercancel, cambio de documento, escena, vista y entrada a Play cancelan la operación afectada. Al cambiar el documento del viewport se trasladan las escuchas de ContinuousGrab y las escuchas de navegación de ventana/documento. Las respuestas pendientes conservan el documento de origen.
- Denegación antes de conceder el bloqueo permite el mecanismo nativo existente de gizmos y Edit Mesh; timeout cancela esas operaciones. Vuelo conserva fallback de Pointer Capture en denegación o timeout cuando el gesto sigue activo. No se crea otro controlador.
- Los errores de captura/release y los incidentes de ContinuousGrab se informan con propietario, operación, estado y datos nativos disponibles; no se certifica recuperación física por restaurar únicamente el CSS. La observación no promete que una plataforma que rechaza exitPointerLock vaya a liberar el dispositivo.

## Límites

La captura nativa de Player y las políticas de Electron/OS no se cambian. La ruta de docking termina el gesto al perder Pointer Capture propio. La prueba DOM aislada no valida los addons Three.js, la composición completa Vue/Electron ni los gestores de ventanas reales. No hay evidencia de la causa exacta del incidente de usuario. Queda pendiente la verificación integrada, incluido el resto de handlers editoriales de documento en ventanas nativas.
