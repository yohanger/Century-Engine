#!/usr/bin/env python3
"""S09 CONT-003 rigorous source, numerical, CPU characterization and optional host QA.
Do not declare visual/Jolt WASM verified without executing their respective runners.
"""
from __future__ import annotations
import argparse
from pathlib import Path
import subprocess
import sys
from verify_s01 import check_manifest,check_ledger,local_files
REQUIRED={
 'src/hydrostatic.ts','src/regional.ts','tests/hydrostatic_s09.test.mjs',
 'tests/characterize_hydrostatics.mjs','tests/benchmark_hydrostatic.mjs',
 'docs/25_S09_CONT003_HYDROSTATIC_EQUILIBRIUM_AND_REGIONAL_SLEEP.md',
 'qa/verify_s09_cont003.py','qa/S09_CONT003_REVIEW.md','qa/S09_CONT003_RUN.log',
}
def run(root,cmd):
 print('S09_CONT003_QA_RUN',*cmd,flush=True)
 r=subprocess.run(cmd,cwd=root,check=False)
 if r.returncode:raise RuntimeError(f'QA failed exit={r.returncode}: {cmd}')
def main():
 p=argparse.ArgumentParser()
 p.add_argument('--project',type=Path,default=Path(__file__).resolve().parents[1])
 p.add_argument('--static-only',action='store_true')
 p.add_argument('--jolt',action='store_true')
 p.add_argument('--browser-build',action='store_true')
 a=p.parse_args();root=a.project.resolve();files=local_files(root)
 if not REQUIRED<=set(files):raise RuntimeError(f'missing files: {sorted(REQUIRED-set(files))}')
 check_manifest(files);check_ledger(root)
 doc=files['docs/25_S09_CONT003_HYDROSTATIC_EQUILIBRIUM_AND_REGIONAL_SLEEP.md'].decode()
 if 'AUTORIZADO' not in doc.upper() and 'autoriza comenzar' not in doc:raise RuntimeError('missing literal CONT-003 authority')
 if 'EN PAUSA' not in doc or 'PENDIENTE' not in doc:raise RuntimeError('unproven integration or regional sleep closure')
 print(f'S09_CONT003_STATIC_PASS files={len(files)} sheets=6 sprints=11 gates=11',flush=True)
 if a.static_only:return
 flags=['--project',str(root)]
 if a.jolt:flags.append('--jolt')
 if a.browser_build:flags.append('--browser-build')
 run(root,[sys.executable,'qa/verify_s09_cont002.py',*flags])
 run(root,['node','tests/characterize_hydrostatics.mjs'])
 run(root,['node','tests/benchmark_hydrostatic.mjs'])
 print('S09_CONT003_AUTHOR_QA_PASS certification=EXACT_FIXED_POINT multilayer_tank=FULL_SOLVER GUI=NOT_VERIFIED',flush=True)
if __name__=='__main__':
 try:main()
 except (ValueError,RuntimeError,OSError) as e:
  print('S09_CONT003_QA_FAIL',e,file=sys.stderr);sys.exit(1)
