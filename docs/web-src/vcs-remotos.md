# Repositorios remotos: Clone, Fetch, Push y Pull

El panel **Remoto** utiliza el protocolo **HTTPS** para conectar un repositorio local con un servidor Git. El caso de GitHub o GitLab es el mismo: necesitas la **URL HTTPS real del repositorio** y, si el servidor lo exige, un token con permisos suficientes. Century Engine no ofrece inicio de sesión OAuth ni SSH en este flujo.

## Configurar origin

1. Abre un proyecto local con un commit y selecciona **Control de versiones → Remoto**.
2. Pega una URL HTTPS como `https://servidor/organizacion/proyecto.git` en **URL de origin**.
3. Pulsa **Guardar**. Si `origin` ya existe y deseas sustituirlo, marca **Confirmar sustitución de origin existente**.
4. Comprueba la rama local y los indicadores **Por enviar** / **Por recibir**.

No incluyas usuario, contraseña, token, parámetros de consulta ni fragmentos dentro de la URL. Las direcciones `ssh://`, `git@servidor:...` o `file://` no están permitidas en la interfaz publicada.

## Autenticación y token

Escribe el token en **Token HTTPS** cuando el servidor necesite autenticación. El campo utiliza entrada oculta. Si el sistema ofrece cifrado seguro, puedes utilizar **Guardar cifrado** y después **Olvidar credencial**. Cuando el almacenamiento seguro no está disponible, el token se utiliza temporalmente para la operación y no se guarda como credencial persistente.

El token nunca se guarda deliberadamente en `project.lfproj` ni en `.git/config`; aun así, un proceso del mismo usuario con acceso al entorno de la operación Git podría inspeccionar datos efímeros. Evita publicar capturas, registros o respaldos que contengan secretos.

## Consultar y publicar cambios

| Acción | Efecto |
|---|---|
| **Fetch** | Descarga información del remoto y actualiza referencias remotas; **no** sustituye los archivos de tu escena. |
| **Push** | Envía los commits de la rama actual. No fuerza la actualización de la rama remota. |
| **Preparar Pull** | Hace Fetch, comprueba limpieza y compatibilidad, y muestra los archivos que cambiarían. |
| **Aplicar Pull** | Tras confirmación, aplica únicamente un avance rápido (*fast-forward*) y recarga el proyecto. |

Los contadores **Por enviar** y **Por recibir** reflejan el estado del **último Fetch**, no una actualización permanente del servidor.

## Recibir cambios con Pull

1. Guarda todas las modificaciones y registra un commit de cualquier cambio pendiente; comprueba que el árbol Git esté limpio.
2. Pulsa **Preparar Pull**. Si hay divergencia de ramas, Git no dispone de seguimiento adecuado o el repositorio está sucio, Century Engine rechaza la operación.
3. Examina la lista de archivos que se reemplazarán.
4. Marca **Confirmo que deseo actualizar el proyecto y recargarlo** y pulsa **Aplicar Pull**.
5. Comprueba las escenas y scripts tras la recarga. Si la recarga falla, el backend intenta restaurar el respaldo anterior bajo las restricciones de seguridad documentadas.

**No hay merge automático de ramas divergentes.** No se ejecuta `push --force` ni `reset --hard` desde este panel.

## Clonar un proyecto

1. Desde **Remoto**, o desde el estado sin proyecto/sin repositorio, escribe una **URL HTTPS de clonación** y un token temporal si hace falta.
2. Pulsa **Seleccionar carpeta vacía y clonar…** (o **Clonar repositorio…**).
3. Selecciona una carpeta vacía mediante el selector nativo. El clon no debe sobreescribir otros archivos.
4. El repositorio debe contener un `project.lfproj` válido. Al terminar, abre el proyecto con **Archivo → Abrir proyecto**; Century Engine no ejecuta automáticamente sus scripts.

La operación rechaza enlaces simbólicos no admitidos, carpetas no vacías y proyectos fuera de los límites de validación. Un clon puede fallar si el servidor exige permisos distintos o el certificado TLS no es válido.

## Límites de sincronización

Las operaciones de red tienen un tiempo máximo por ejecución y no muestran progreso por bytes ni un botón de cancelación de Git ya iniciado. Git LFS, SSH, OAuth, merge interactivo y resolución de conflictos **no** forman parte de este módulo. Consulta [Seguridad y límites](#/vcs-seguridad) y [Problemas frecuentes](#/vcs-problemas).
