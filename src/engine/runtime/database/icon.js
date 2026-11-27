// Icono de un registro de la base de datos (objetos, armas, armaduras, habilidades, estados…): un emoji o símbolo, o una IMAGEN
// del proyecto (png, jpg, webp… importada en Assets). La imagen se guarda como 'img:<id del recurso>'. Sin DOM: lo usan el editor,
// el juego, los textos (\I[item:3]) y las pruebas.
export const ICON_IMG = 'img:'
export const isImageIcon = (v) => typeof v === 'string' && v.startsWith(ICON_IMG) && v.length > ICON_IMG.length
export const iconAssetId = (v) => (isImageIcon(v) ? v.slice(ICON_IMG.length) : null)
export const imageIcon = (assetId) => ICON_IMG + assetId
/** Extensiones de imagen que se aceptan como icono. */
export const ICON_EXT = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg']
export const isIconFile = (name) => ICON_EXT.includes(String(name || '').split('.').pop().toLowerCase())
/** Carácter que ocupa el sitio de un icono-imagen dentro de un texto (parseMessage → msg.icons). */
export const ICON_CHAR = '￼'
