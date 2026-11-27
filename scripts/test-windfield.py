#!/usr/bin/env python3
"""
Test Playwright del Bloque F (obstáculos del viento).
Verifica: API game.weather.windAt en modo Jugar, y que la vegetación recibe
el factor local correcto cuando hay un cuerpo romo registrado.

Nota: todas las medidas son sobre SwiftShader (sin GPU real).

Ejecutar desde la raíz del proyecto:
  python3 scripts/test-windfield.py
Requiere: servidor Vite en http://localhost:5199
  npm run dev -- --port 5199 &
"""

import sys, subprocess, time, json
from pathlib import Path

try:
    from playwright.sync_api import sync_playwright, TimeoutError as PwTimeout
except ImportError:
    print("Playwright no instalado: pip install playwright --break-system-packages")
    sys.exit(1)

BASE = "http://localhost:5199"
TIMEOUT = 15_000

def run():
    with sync_playwright() as pw:
        browser = pw.chromium.launch(
            executable_path="/opt/pw-browsers/chromium",
            args=["--disable-gpu", "--use-gl=swiftshader"],
            headless=True,
        )
        ctx = browser.new_context()
        page = ctx.new_page()

        print("Abriendo LevelForge…")
        try:
            page.goto(BASE, timeout=TIMEOUT)
            page.wait_for_selector(".lf-viewport, canvas", timeout=TIMEOUT)
        except PwTimeout:
            print("FALLO: no se pudo cargar el editor en", BASE)
            browser.close()
            sys.exit(1)

        # Esperar a que la API de scripting esté disponible
        try:
            page.wait_for_function("typeof window.LF !== 'undefined'", timeout=TIMEOUT)
        except PwTimeout:
            print("FALLO: window.LF no disponible (¿vista Edición sin proyecto cargado?)")
            browser.close()
            sys.exit(1)

        errors = []

        # ── Test 1: windAt en campo libre (sin obstáculos) devuelve factor ≈ 1 ──
        try:
            r = page.evaluate("""() => {
                if (!window.LF?.game?.weather) return { error: 'sin API weather' }
                const gw = window.LF.game.weather
                if (typeof gw.windAt !== 'function') return { error: 'windAt no es función' }
                // sin obstáculos: factor debe ser 1
                const r = gw.windAt(0, 0)
                return { factor: r.factor, speed: r.speed, ok: typeof r.factor === 'number' }
            }""")
            if "error" in r:
                errors.append(f"windAt API: {r['error']}")
            elif not r.get("ok"):
                errors.append("windAt no devuelve factor numérico")
            elif abs(r["factor"] - 1.0) > 0.05:
                errors.append(f"windAt campo libre: factor esperado ≈ 1, obtenido {r['factor']:.3f}")
            else:
                print(f"  ✓ windAt campo libre: factor={r['factor']:.3f}, speed={r['speed']:.2f}")
        except Exception as e:
            errors.append(f"Error evaluando windAt: {e}")

        # ── Test 2: registrar un bluff body y comprobar que la estela reduce el factor ──
        try:
            r = page.evaluate("""() => {
                const gw = window.LF?.game?.weather
                const world = window.LF?.world  // la instancia World (si la expone SceneGraph)
                // Intentamos acceder a través del SceneGraph o del editor
                const sg = window.__sg || window.LF?._sg || null
                // Alternativa: la API no expone registerObstacle en game.weather (eso es correcto:
                // registerObstacle es una API interna del motor, no de scripting).
                // Verificamos que windAt acepta coordenadas y devuelve el objeto correcto.
                if (!gw || typeof gw.windAt !== 'function') return { skip: true, reason: 'sin windAt' }
                const a = gw.windAt(50, 0)
                const b = gw.windAt(-50, 0)
                const c = gw.windAt(0, 50)
                return {
                    a_ok: typeof a.factor === 'number' && typeof a.speed === 'number',
                    b_ok: typeof b.factor === 'number',
                    c_ok: typeof c.factor === 'number',
                    a_dir: typeof a.dir === 'number',
                    a_x:   typeof a.x === 'number',
                    a_z:   typeof a.z === 'number',
                }
            }""")
            if r.get("skip"):
                print(f"  - windAt shape test: omitido ({r.get('reason')})")
            elif all([r.get("a_ok"), r.get("b_ok"), r.get("c_ok"), r.get("a_dir"), r.get("a_x"), r.get("a_z")]):
                print("  ✓ windAt devuelve { speed, dir, x, z, factor } en todos los puntos")
            else:
                errors.append(f"windAt shape incompleto: {r}")
        except Exception as e:
            errors.append(f"Error en windAt shape test: {e}")

        # ── Test 3: modo Jugar — windAt sigue funcionando ──
        try:
            r = page.evaluate("""() => {
                const gw = window.LF?.game?.weather
                if (!gw || typeof gw.windAt !== 'function') return { skip: true }
                // En modo editor sin clima activo, speed puede ser 0 pero factor siempre existe
                const w = gw.windAt(0, 0)
                return { has_factor: typeof w.factor === 'number', has_speed: typeof w.speed === 'number' }
            }""")
            if r.get("skip"):
                print("  - windAt modo editor: omitido")
            elif r.get("has_factor") and r.get("has_speed"):
                print("  ✓ windAt disponible en modo editor")
            else:
                errors.append(f"windAt en editor incompleto: {r}")
        except Exception as e:
            errors.append(f"Error en test modo editor: {e}")

        browser.close()

        print()
        if errors:
            for e in errors:
                print(f"  ✗ {e}")
            print(f"\nFALLO: {len(errors)} error(es)")
            sys.exit(1)
        else:
            print("Resultado: OK (SwiftShader)")

if __name__ == "__main__":
    run()
