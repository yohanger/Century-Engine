#!/usr/bin/env python3
"""S02: project-name-agnostic structural check plus real TypeScript/Node QA.

Never changes existing files. Optional package delta check is against an exact prior ZIP.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import shutil
import subprocess
import sys
import zipfile

from verify_s01 import local_files, check_manifest, check_ledger, load_zip, sha

BASE = 'CENTURY_FLUIDS/'  # packaging convention; not a filesystem folder-name requirement
REQUIRED = {
    'src/particles.ts', 'src/spatial.ts', 'src/world.ts', 'src/index.ts',
    'docs/11_TYPESCRIPT_PARTICLES_AND_SPATIAL_S02.md',
    'tests/particles_spatial.test.mjs', 'tests/benchmark_particles.mjs',
    'qa/verify_s02.py', 'package.json', 'package-lock.json',
    'ledger/CENTURY_FLUIDS_LEDGER.xlsx', 'qa/MANIFEST.sha256'
}
GATE = 'CENTURY-FLUIDS-S02-G001-INTEGRAL-PARTICLES-AND-SPATIAL-QUERIES'


def check(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def check_delta(old_path: Path, baseline_path: Path, change_path: Path, current: dict[str, bytes]) -> None:
    old = load_zip(old_path, project=True)
    baseline = load_zip(baseline_path, project=True)
    change = load_zip(change_path, project=False)
    check(baseline == current, 'SOURCE_BASELINE differs from current source tree')
    remove_bytes = change.pop('CHANGE_REMOVALS.json', None)
    check(remove_bytes is not None, 'CHANGE missing safe removal declaration')
    removed = json.loads(remove_bytes)
    check(removed.get('schema') == 'century-fluids/incremental-removals/v1', 'bad removal schema')
    check(removed.get('previous_baseline_sha256') == sha(old_path.read_bytes()), 'wrong previous baseline hash')
    actual_removed = set(old) - set(current)
    specified = {p['path'][len(BASE):]: p['old_sha256'] for p in removed.get('paths', [])}
    check(actual_removed == set(specified), 'unexpected files removed from baseline')
    for rel in actual_removed:
        check(specified[rel] == sha(old[rel]), f'unsafe removal hash: {rel}')
    changes_expected = {BASE + rel: data for rel, data in current.items() if old.get(rel) != data}
    check(change == changes_expected, 'CHANGE contents differ from actual delta')
    print(f'S02_ARCHIVE_DELTA_PASS changed={len(changes_expected)} removed={len(actual_removed)}')


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--project', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--static-only', action='store_true')
    parser.add_argument('--previous-baseline', type=Path)
    parser.add_argument('--baseline', type=Path)
    parser.add_argument('--change', type=Path)
    args = parser.parse_args()
    root = args.project.resolve()
    check((root / 'package.json').is_file(), 'project must contain package.json')
    files = local_files(root)
    check(REQUIRED <= set(files), f'missing {sorted(REQUIRED-set(files))}')
    check_manifest(files)
    check_ledger(root)
    package = json.loads(files['package.json'])
    lock = json.loads(files['package-lock.json'])
    check(package['name'] == '@century/fluids' and package['type'] == 'module', 'wrong package identity')
    check(package.get('dependencies') in (None, {}), 'core must be host independent')
    check(lock['packages']['']['devDependencies'] == package['devDependencies'], 'lock mismatch')
    check('tests/benchmark_particles.mjs' in files, 'historical benchmark file missing')
    for file in ('src/particles.ts', 'src/spatial.ts', 'src/world.ts'):
        imports = [line for line in files[file].decode('utf8').splitlines() if line.lstrip().startswith('import ')]
        check(not any(token in line.lower() for line in imports for token in ('jolt', 'three', 'century/')), 'host integration imported by core')
    check(not any(f.endswith('.rs') for f in files), 'legacy Rust source active')
    if any((args.previous_baseline, args.baseline, args.change)):
        check(all((args.previous_baseline, args.baseline, args.change)), 'supply 3 ZIP arguments')
        check_delta(args.previous_baseline, args.baseline, args.change, files)
    print(f'S02_STATIC_PASS files={len(files)} sheets=6 sprints=11 gates=11 project={root.name}')
    if args.static_only:
        return 0
    check(all(shutil.which(x) for x in ('node', 'npm')), 'Node/npm missing; runtime QA not executed')
    result = subprocess.run(['npm', 'run', 'qa'], cwd=root, check=False)
    check(result.returncode == 0, 'npm run qa failed')
    bench = subprocess.run(['node', 'tests/benchmark_particles.mjs'], cwd=root, check=False)
    check(bench.returncode == 0, 'S02 benchmark oracle mismatch')
    print('S02_QA_PASS: compile + Node tests + spatial benchmark oracle')
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (OSError, KeyError, ValueError, zipfile.BadZipFile, json.JSONDecodeError) as exc:
        print(f'S02_QA_FAIL: {exc}', file=sys.stderr)
        sys.exit(1)
