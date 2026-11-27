#!/usr/bin/env python3
"""S01A: evaluación local de fotogramas Android con AprilTag; NO tracking en producción."""
import argparse
import base64
import json
import math
import sys
import time
import tempfile
import zipfile
from pathlib import Path
import resource

import cv2
import numpy as np

GATE = 'LF-FILMMAKER-MOBILE-CAMERA-VISUAL-TRACKING-FEASIBILITY-S01A-G001'
MARKER_M = 0.120
CHECKER_SQUARE_M = 0.018
CHECKER_INNER = (9, 6)
DICT = cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_APRILTAG_36h11)


def write_json(path, value):
    dest = Path(path)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')


def target_pages(directory):
    out = Path(directory)
    out.mkdir(parents=True, exist_ok=True)
    raw = cv2.aruco.generateImageMarker(DICT, 0, 600)
    success, png = cv2.imencode('.png', raw)
    if not success:
        raise RuntimeError('No se generó el marcador AprilTag')
    encoded = base64.b64encode(png.tobytes()).decode('ascii')
    target = f'''<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="297mm" viewBox="0 0 210 297">
<rect width="210" height="297" fill="white" />
<text x="15" y="30" font-size="5" fill="black">S01A - AprilTag 36h11 / ID 0</text>
<image x="45" y="65" width="120" height="120" href="data:image/png;base64,{encoded}" />
<text x="45" y="198" font-size="4.5" fill="black">CUADRADO NEGRO 120 mm de lado - imprimir al 100%</text>
<path d="M45 207 h50" stroke="black" stroke-width=".5"/>
<text x="45" y="214" font-size="4">Comprobar con regla: línea 50 mm</text>
<text x="15" y="278" font-size="3.6">Fijar el marcador. No deformar ni adaptar a página. Medir 120 mm después de imprimir.</text>
</svg>'''
    (out / 'apriltag36h11-id0-120mm-A4.svg').write_text(target, encoding='utf-8')
    # Tablero 10x7 cuadrados: 9x6 esquinas interiores, cuadrados físicos 18 mm.
    rects = []
    for row in range(7):
        for column in range(10):
            if (row + column) % 2 == 0:
                rects.append(f'<rect x="{15 + column * 18}" y="{60 + row * 18}" width="18" height="18" fill="black"/>')
    checker = '''<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="297mm" viewBox="0 0 210 297">
<rect width="210" height="297" fill="white" />
<text x="15" y="31" font-size="5">S01A - tablero de calibración (9x6 esquinas internas)</text>
''' + '\n'.join(rects) + '''
<text x="15" y="198" font-size="4.5">Cada cuadrado: 18 mm de lado. Imprimir al 100%.</text>
<path d="M15 208 h50" stroke="black" stroke-width=".5"/>
<text x="15" y="215" font-size="4">Comprobar con regla: línea 50 mm</text>
<text x="15" y="277" font-size="3.6">Capturar al menos 8 vistas con ángulos variados; mismo zoom y resolución.</text>
</svg>'''
    (out / 'checkerboard-9x6-18mm-A4.svg').write_text(checker, encoding='utf-8')
    return [str(p) for p in sorted(out.glob('*.svg'))]


class Captures:
    def __init__(self, path):
        self.path = Path(path)
        self.is_zip = self.path.is_file() and zipfile.is_zipfile(self.path)
        if not self.is_zip and not self.path.is_dir():
            raise ValueError('Se requiere un ZIP válido de S01A o carpeta extraída')
        if self.is_zip:
            with zipfile.ZipFile(self.path) as archive:
                if archive.getinfo('manifest.json').file_size > 65536: raise ValueError('Manifiesto demasiado grande')
                raw = archive.read('manifest.json')
        else:
            raw = (self.path / 'manifest.json').read_bytes()
        self.manifest = json.loads(raw)
        if self.manifest.get('schema') != 'lf-filmmaker-mobile-visual-tracking-s01a':
            raise ValueError('No es un conjunto de capturas S01A')
        if self.manifest.get('productionSixDoFApproved') is not False:
            raise ValueError('El manifiesto no declara los límites contractuales')
        self.frames = self.manifest.get('frames', [])
        if not isinstance(self.frames, list) or not 1 <= len(self.frames) <= 12:
            raise ValueError('El conjunto S01A debe incluir entre 1 y 12 capturas')

    def image(self, filename):
        if Path(filename).name != filename or not filename.endswith('.jpg'):
            raise ValueError('Nombre de captura inseguro')
        if self.is_zip:
            with zipfile.ZipFile(self.path) as archive:
                if archive.getinfo(filename).file_size > 1_200_000:
                    raise ValueError(f'Archivo de captura excede el límite: {filename}')
                binary = archive.read(filename)
        else:
            binary = (self.path / filename).read_bytes()
        if len(binary) > 1_200_000:
            raise ValueError(f'Archivo de captura excede el límite: {filename}')
        image = cv2.imdecode(np.frombuffer(binary, dtype=np.uint8), cv2.IMREAD_COLOR)
        if image is None:
            raise ValueError(f'JPEG no decodificable: {filename}')
        return image


def calibrate(captures):
    start = time.monotonic()
    points = np.zeros((CHECKER_INNER[0] * CHECKER_INNER[1], 3), np.float32)
    points[:, :2] = np.mgrid[0:CHECKER_INNER[0], 0:CHECKER_INNER[1]].T.reshape(-1, 2) * CHECKER_SQUARE_M
    object_points, image_points, accepted, rejected = [], [], [], []
    expected_size = None
    for entry in captures.frames:
        if entry.get('stage') != 'calibracion':
            continue
        name = entry['filename']
        image = captures.image(name)
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        actual_size = (gray.shape[1], gray.shape[0])
        if expected_size is not None and actual_size != expected_size:
            rejected.append({'filename': name, 'reason': 'RESOLUCION_DIFERENTE'})
            continue
        if hasattr(cv2, 'findChessboardCornersSB'):
            found, corners = cv2.findChessboardCornersSB(gray, CHECKER_INNER)
        else:
            found, corners = cv2.findChessboardCorners(gray, CHECKER_INNER)
            if found:
                corners = cv2.cornerSubPix(gray, corners, (11, 11), (-1, -1),
                    (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, 0.001))
        if not found:
            rejected.append({'filename': name, 'reason': 'TABLERO_NO_DETECTADO'})
            continue
        expected_size = actual_size
        object_points.append(points.copy())
        image_points.append(corners)
        accepted.append(name)
    if len(accepted) < 8:
        return {'status': 'CALIBRACION_INSUFICIENTE', 'accepted': accepted, 'rejected': rejected,
            'minimumViews': 8, 'elapsedMs': round((time.monotonic() - start) * 1000, 2),
            'productionSixDoFApproved': False}
    rms, K, distortion, rotation, translation = cv2.calibrateCamera(object_points, image_points,
        expected_size, None, None)
    if not np.isfinite(K).all() or not np.isfinite(distortion).all() or not math.isfinite(rms):
        raise ValueError('La calibración produjo valores no finitos')
    return {'status': 'CALIBRACION_ESTIMADA', 'gate': GATE, 'source': 'jpeg-android-captured',
        'calibrationIsValidForUnchangedZoomResolution': True, 'imageWidth': expected_size[0],
        'imageHeight': expected_size[1], 'boardInnerCorners': list(CHECKER_INNER),
        'squareSizeMeters': CHECKER_SQUARE_M, 'rmsReprojectionPixels': float(rms),
        'cameraMatrix': K.tolist(), 'distortionCoefficients': distortion.flatten().tolist(),
        'accepted': accepted, 'rejected': rejected, 'elapsedMs': round((time.monotonic() - start) * 1000, 2),
        'pcMaxResidentSetKiB': resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
        'productionSixDoFApproved': False}


def object_corners(marker_side_m=MARKER_M):
    half = marker_side_m / 2
    return np.array([[-half, half, 0], [half, half, 0], [half, -half, 0], [-half, -half, 0]], dtype=np.float64)


def pose_from_corners(corners, K, dist):
    object_xyz = object_corners()
    success, rvec, tvec = cv2.solvePnP(object_xyz, np.asarray(corners, dtype=np.float64).reshape(4, 2),
        K, dist, flags=cv2.SOLVEPNP_IPPE_SQUARE)
    if not success or tvec[2, 0] <= 0:
        raise ValueError('Pose PnP no válida o detrás de la cámara')
    rotation, _ = cv2.Rodrigues(rvec)
    # La cámara en referencia del marcador; NO se expresa en el espacio virtual FilmMaker.
    center = -rotation.T @ tvec
    projected, _ = cv2.projectPoints(object_xyz, rvec, tvec, K, dist)
    reproj = np.linalg.norm(projected.reshape(-1, 2) - np.asarray(corners).reshape(-1, 2), axis=1)
    return center.reshape(3), rotation.T, float(np.sqrt(np.mean(reproj**2)))


def analyze(captures, calibration, ground_truth=None):
    if calibration.get('status') != 'CALIBRACION_ESTIMADA':
        raise ValueError('La calibración de JPEG no está acreditada')
    K = np.array(calibration['cameraMatrix'], dtype=np.float64)
    dist = np.array(calibration['distortionCoefficients'], dtype=np.float64)
    if K.shape != (3, 3) or not np.isfinite(K).all() or not np.isfinite(dist).all():
        raise ValueError('Parámetros de calibración inválidos')
    detector = cv2.aruco.ArucoDetector(DICT, cv2.aruco.DetectorParameters())
    frames, reference, previous_valid = [], None, False
    started = time.monotonic()
    valid = 0
    for entry in captures.frames:
        if entry.get('stage') == 'calibracion':
            continue
        name = entry['filename']
        image = captures.image(name)
        size = (image.shape[1], image.shape[0])
        info = {'filename': name, 'stage': entry.get('stage'), 'valid': False}
        if size != (calibration['imageWidth'], calibration['imageHeight']):
            info['reason'] = 'RESOLUCION_DISTINTA_A_CALIBRACION'
        else:
            corners, ids, _ = detector.detectMarkers(cv2.cvtColor(image, cv2.COLOR_BGR2GRAY))
            selection = None
            if ids is not None:
                selection = next((j for j, marker_id in enumerate(ids.flatten()) if int(marker_id) == 0), None)
            if selection is None:
                info['reason'] = 'MARKER_0_NO_VISIBLE'
            else:
                try:
                    center, rotation, reproj = pose_from_corners(corners[selection], K, dist)
                    if reference is None:
                        reference = center.copy()
                    info.update(valid=True, reason=None, positionMarkerFrameMeters=center.tolist(),
                        reprojectionRmsPixels=reproj, displacementFromFirstValidMeters=float(np.linalg.norm(center-reference)),
                        recoveredAfterLoss=bool(not previous_valid and valid > 0))
                    if ground_truth is not None and name in ground_truth:
                        measured = float(ground_truth[name])
                        if not math.isfinite(measured) or measured < 0:
                            raise ValueError('La medición física debe ser finita y no negativa')
                        info['groundTruthDistanceFromFirstMeters'] = measured
                        info['absoluteDistanceErrorMeters'] = abs(info['displacementFromFirstValidMeters'] - measured)
                    valid += 1
                except (ValueError, cv2.error) as error:
                    info['reason'] = 'PNP_INVALIDA:' + str(error)[:120]
        previous_valid = info['valid']
        frames.append(info)
    errs = [x['absoluteDistanceErrorMeters'] for x in frames if 'absoluteDistanceErrorMeters' in x]
    return {'gate': GATE, 'status': 'EVALUACION_EXPERIMENTAL' if valid else 'SIN_POSES_VALIDAS', 'coordinateFrame': 'marker0-center-right-up-out-meters',
        'markerId': 0, 'markerLengthMeters': MARKER_M, 'framesEvaluated': len(frames), 'framesWithValidPose': valid,
        'framesInvalid': len(frames)-valid, 'fractionValid': valid/len(frames) if frames else None,
        'meanAbsoluteDistanceErrorMeters': sum(errs)/len(errs) if errs else None,
        'physicalGroundTruthProvided': bool(errs), 'elapsedProcessingMs': round((time.monotonic()-started)*1000,2),
        'pcMaxResidentSetKiB': resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
        'frames':frames, 'productionSixDoFApproved':False,
        'limitations':['Solo capturas discretas; no mide latencia de streaming ni rendimiento en tiempo real.',
            'La cámara trasera solicitada no está certificada por el Intent; verificar físicamente.',
            'Las poses son relativas al marcador 0; oclusión implica pérdida de referencia.',
            'Sin mediciones físicas explícitas no hay evaluación de precisión métrica.']}


def self_test():
    # Comprobación matemática sintética, NO constituye evidencia del Z2473.
    K = np.array([[800, 0, 320], [0, 800, 240], [0, 0, 1]], dtype=np.float64)
    dist = np.zeros(5)
    obj = object_corners()
    desired = np.array([[0.02], [-0.01], [0.70]], dtype=np.float64)
    pts, _ = cv2.projectPoints(obj, np.array([[.05], [.03], [0.]], dtype=np.float64), desired, K, dist)
    center, rotation, reproj = pose_from_corners(pts, K, dist)
    if not (abs(np.linalg.norm(center)-np.linalg.norm(desired)) < .005 and reproj < .01):
        raise AssertionError('La estimación matemática no recupera la distancia sintética')
    marker = cv2.aruco.generateImageMarker(DICT, 0, 200)
    page = np.full((400, 400), 255, np.uint8)
    page[100:300, 100:300] = marker
    detected, ids, _ = cv2.aruco.ArucoDetector(DICT, cv2.aruco.DetectorParameters()).detectMarkers(page)
    if ids is None or 0 not in ids:
        raise AssertionError('El detector no recuperó el marcador ID 0')
    # Prueba integral artificial: JPEGs -> ZIP/manifest -> calibración -> estimación.
    with tempfile.TemporaryDirectory(prefix='lf-s01a-synthetic-') as temp:
        cal_zip = Path(temp) / 'calibration.zip'
        board = np.full((490, 700), 255, dtype=np.uint8)
        for row in range(7):
            for col in range(10):
                if (row + col) % 2 == 0:
                    board[row*70:(row+1)*70, col*70:(col+1)*70] = 0
        entries = []
        with zipfile.ZipFile(cal_zip, 'w') as archive:
            for i in range(9):
                destination = np.float32([[220+i*4, 100+i*3], [920-i*3, 110+i*5],
                    [925-i*4, 650-i*3], [205+i*5, 655-i*5]])
                H = cv2.getPerspectiveTransform(np.float32([[0,0],[699,0],[699,489],[0,489]]), destination)
                image = cv2.warpPerspective(board, H, (1280,800), borderValue=255)
                success, jpeg = cv2.imencode('.jpg', image, [int(cv2.IMWRITE_JPEG_QUALITY),85])
                if not success: raise AssertionError('Fallo de codificación de tablero sintético')
                filename = f's01a_{i+1:02}_calibracion.jpg'
                entries.append({'filename':filename,'stage':'calibracion'})
                archive.writestr(filename, jpeg.tobytes())
            archive.writestr('manifest.json',json.dumps({'schema':'lf-filmmaker-mobile-visual-tracking-s01a',
                'productionSixDoFApproved':False, 'frames':entries}))
        calib = calibrate(Captures(cal_zip))
        if calib['status'] != 'CALIBRACION_ESTIMADA' or len(calib['accepted']) != 9:
            raise AssertionError('La calibración sintética del ZIP no se pudo completar')
        pose_zip = Path(temp) / 'poses.zip'
        entries = []
        with zipfile.ZipFile(pose_zip, 'w') as archive:
            for i, (mx,my) in enumerate(((450,270),(500,260),(550,265))):
                image = np.full((800,1280), 255, np.uint8)
                image[my:my+240, mx:mx+240] = cv2.aruco.generateImageMarker(DICT, 0, 240)
                success, jpeg = cv2.imencode('.jpg', image)
                if not success: raise AssertionError('Fallo de codificación de pose sintética')
                filename = f's01a_{i+1:02}_estatico.jpg'
                archive.writestr(filename, jpeg.tobytes())
                entries.append({'filename':filename,'stage':'estatico'})
            archive.writestr('manifest.json', json.dumps({'schema':'lf-filmmaker-mobile-visual-tracking-s01a',
                'productionSixDoFApproved':False, 'frames':entries}))
        output = analyze(Captures(pose_zip),calib)
        if output['framesWithValidPose'] != 3:
            raise AssertionError('La detección de poses sintéticas no fue íntegra')
    return {'status': 'SINTETICO_PASS', 'opencv':cv2.__version__, 'poseMetersApprox':center.tolist(),
        'syntheticReprojectionPixels':reproj,'syntheticCalibrationViews':9, 'syntheticDetectedPoses':3,
        'productionSixDoFApproved':False}


def main():
    parser = argparse.ArgumentParser(description='S01A seguimiento visual experimental, NO filmación')
    sub = parser.add_subparsers(dest='command', required=True)
    targets = sub.add_parser('targets'); targets.add_argument('--out', required=True)
    calib = sub.add_parser('calibrate'); calib.add_argument('--captures', required=True); calib.add_argument('--out', required=True)
    solve = sub.add_parser('analyze'); solve.add_argument('--captures', required=True); solve.add_argument('--calibration', required=True)
    solve.add_argument('--ground-truth', help='JSON {"filename.jpg": distancia_medida_en_metros}'); solve.add_argument('--out', required=True)
    sub.add_parser('self-test')
    args = parser.parse_args()
    if args.command == 'targets':
        result = target_pages(args.out)
    elif args.command == 'calibrate':
        result = calibrate(Captures(args.captures)); write_json(args.out, result)
    elif args.command == 'analyze':
        gt = json.loads(Path(args.ground_truth).read_text(encoding='utf-8')) if args.ground_truth else None
        result = analyze(Captures(args.captures), json.loads(Path(args.calibration).read_text(encoding='utf-8')), gt)
        write_json(args.out, result)
    else:
        result = self_test()
    print(json.dumps(result, indent=2, ensure_ascii=False))
    if isinstance(result,dict) and result.get('status')=='CALIBRACION_INSUFICIENTE': return 2
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (OSError, KeyError, ValueError, zipfile.BadZipFile, RuntimeError) as error:
        print('S01A: ' + str(error), file=sys.stderr)
        sys.exit(1)
