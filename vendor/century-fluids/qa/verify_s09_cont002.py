#!/usr/bin/env python3
"""S09 CONT-002 verifier; no invented GUI, performance or Jolt WASM PASS."""
from __future__ import annotations
import argparse
from pathlib import Path
import subprocess
import sys
from verify_s01 import check_manifest,check_ledger,local_files
REQUIRED={'src/regional.ts','tests/regional_physics_s09.test.mjs','tests/benchmark_regional.mjs',
 'docs/23_CF_CA_005_CHUNKED_SPATIAL_AUTHORITY_AND_VOXEL_MASS_REPRESENTATION.md',
 'docs/24_S09_CONT002_REGIONAL_PHYSICS_SCHEDULING.md',
 'qa/verify_s09_cont002.py','qa/S09_CONT002_REVIEW.md','qa/S09_CONT002_RUN.log'}
def run(root,cmd):
 print('S09_CONT002_QA_RUN',*cmd,flush=True)
 result=subprocess.run(cmd,cwd=root,check=False)
 if result.returncode:raise RuntimeError(f'QA failed exit={result.returncode}: {cmd}')
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--project',type=Path,default=Path(__file__).resolve().parents[1]);
 ap.add_argument('--static-only',action='store_true');ap.add_argument('--jolt',action='store_true');ap.add_argument('--browser-build',action='store_true')
 a=ap.parse_args();root=a.project.resolve();files=local_files(root)
 if not REQUIRED<=set(files):raise RuntimeError(f'missing files: {sorted(REQUIRED-set(files))}')
 check_manifest(files);check_ledger(root)
 doc=files['docs/23_CF_CA_005_CHUNKED_SPATIAL_AUTHORITY_AND_VOXEL_MASS_REPRESENTATION.md'].decode()
 if 'RATIFICADO' not in doc or 'EN PAUSA' not in doc:raise RuntimeError('no ratified authority / S08 pause')
 print(f'S09_CONT002_STATIC_PASS files={len(files)} sheets=6 sprints=11 gates=11',flush=True)
 if a.static_only:return
 flags=['--project',str(root)]
 if a.jolt:flags.append('--jolt')
 if a.browser_build:flags.append('--browser-build')
 run(root,[sys.executable,'qa/verify_s09.py',*flags])
 run(root,['node','tests/benchmark_chunks.mjs'])
 run(root,['node','tests/benchmark_regional.mjs'])
 print('S09_CONT002_AUTHOR_QA_PASS GUI=NOT_VERIFIED moving_gravitating_solids=FULL_SOLVER fixed_point_cont003=ELIGIBLE',flush=True)
if __name__=='__main__':
 try:main()
 except (RuntimeError,ValueError,OSError) as exc:
  print('S09_CONT002_QA_FAIL',exc,file=sys.stderr);sys.exit(1)
