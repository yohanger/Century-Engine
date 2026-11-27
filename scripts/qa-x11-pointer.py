"""System mouse input for the Electron QA runner on X11 (XTEST)."""
import ctypes as C
import json
import sys

X = C.CDLL('libX11.so.6')
T = C.CDLL('libXtst.so.6')
X.XOpenDisplay.argtypes = [C.c_char_p]
X.XOpenDisplay.restype = C.c_void_p
X.XDefaultRootWindow.argtypes = [C.c_void_p]
X.XDefaultRootWindow.restype = C.c_ulong
X.XQueryPointer.argtypes = [C.c_void_p, C.c_ulong, C.POINTER(C.c_ulong), C.POINTER(C.c_ulong), *([C.POINTER(C.c_int)] * 4), C.POINTER(C.c_uint)]
X.XQueryPointer.restype = C.c_int
X.XSync.argtypes = [C.c_void_p, C.c_int]
X.XCloseDisplay.argtypes = [C.c_void_p]
T.XTestQueryExtension.argtypes = [C.c_void_p, *([C.POINTER(C.c_int)] * 4)]
T.XTestFakeMotionEvent.argtypes = [C.c_void_p, C.c_int, C.c_int, C.c_int, C.c_ulong]
T.XTestFakeButtonEvent.argtypes = [C.c_void_p, C.c_uint, C.c_int, C.c_ulong]


def state(display):
    root, child = C.c_ulong(), C.c_ulong()
    x, y, wx, wy, mask = C.c_int(), C.c_int(), C.c_int(), C.c_int(), C.c_uint()
    if not X.XQueryPointer(display, X.XDefaultRootWindow(display), C.byref(root), C.byref(child), C.byref(x), C.byref(y), C.byref(wx), C.byref(wy), C.byref(mask)):
        raise RuntimeError('El cursor no está en la pantalla raíz X11')
    return {'x': x.value, 'y': y.value, 'left': bool(mask.value & 0x100)}


def main():
    action, *coords = sys.argv[1:]
    if action not in ('query', 'press', 'move', 'release', 'cleanup') or len(coords) != (2 if action in ('press', 'move', 'release') else 0):
        raise ValueError('Acción de ratón X11 inválida')
    display = X.XOpenDisplay(None)
    if not display:
        raise RuntimeError('No se pudo abrir DISPLAY X11')
    pressed_here = False
    try:
        args = [C.c_int() for _ in range(4)]
        if not T.XTestQueryExtension(display, *(C.byref(a) for a in args)):
            raise RuntimeError('XTEST no está disponible')
        before = state(display)
        if action == 'press' and before['left']:
            raise RuntimeError('Botón izquierdo ya pulsado; no iniciar otro gesto')
        if action in ('move', 'release') and not before['left']:
            raise RuntimeError('El botón izquierdo ya no está pulsado en X11')
        if coords:
            x, y = map(int, coords)
            if not T.XTestFakeMotionEvent(display, -1, x, y, 0):
                raise RuntimeError('XTEST rechazó el movimiento')
            X.XSync(display, 0)
            at = state(display)
            if (at['x'], at['y']) != (x, y):
                raise RuntimeError(f'Destino X11 no alcanzado: {at}')
        if action in ('press', 'release') or action == 'cleanup' and before['left']:
            if not T.XTestFakeButtonEvent(display, 1, int(action == 'press'), 0):
                raise RuntimeError('XTEST rechazó el cambio de botón')
            pressed_here = action == 'press'
        X.XSync(display, 0)
        after = state(display)
        if action in ('press', 'move', 'release', 'cleanup') and after['left'] != (action in ('press', 'move')):
            raise RuntimeError(f'Estado del botón X11 inesperado: {after}')
        print(json.dumps({'before': before, 'after': after}))
    except BaseException:
        if pressed_here:
            T.XTestFakeButtonEvent(display, 1, 0, 0)
            X.XSync(display, 0)
        raise
    finally:
        X.XCloseDisplay(display)


if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, ValueError, OSError) as error:
        sys.exit(str(error))
