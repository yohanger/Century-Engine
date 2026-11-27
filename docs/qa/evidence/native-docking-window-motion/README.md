# Recuperación de movimiento nativo

Evidencia de entrada: build Editor y Runtime PASS, Wayland solicitado/CDP 22 comprobaciones PASS, X11 solicitado/XTEST FAIL antes del desacoplamiento; movimiento manual FAIL. Comparación de fuentes: la última entrega desactivaba la región de arrastre nativo de toda la cabecera. Se restituye la región libre, con título/pestaña independiente para Docking. La única expectativa histórica incompatible se reemplaza por una que exige ambas regiones. El IPC registra coordenadas observadas, no confirmadas o rechazo, sin confundirlas con una medición física.

Node: 46/46 Docking, 70/70 ratón, 9/9 Edit Mesh. Electron bloqueado antes de inicio por falta de Vite. No se obtuvo evidencia visual de ventanas reales. El nuevo runner X11 mide cambio de bounds y preservación de layout; CDP declara ese criterio no verificado. No se modifica el backend predeterminado. No se han auditado cambios locales.

QA manual prioritario: recompilar, abrir un panel flotante, moverlo desde el espacio libre de la cabecera; comprobar que no inicia Docking. Arrastrar el título/pestaña a un destino válido y soltar; comprobar destino, contenido único y recuperación del ratón. Repetir con Code y una herramienta de recurso. Si falla, registrar backend solicitado/efectivo cuando sea posible y diagnóstico `[Century/Docking] window-position`.

Regresión adicional: iconografía 11/11; Code 20/21, mismo fallo histórico de CSS que en el baseline anterior; API documental 28/28 y portal 14/14. PDF regenerado (388 páginas, página de cambio inspeccionada). Marked alternativo. Ledger de seis hojas actualizado; las 46.442 celdas previas conservan sus valores o fórmulas. Compilación de las fuentes nuevas no verificada. Los runners normal, X11 y Wayland se bloquean por falta de Vite.
