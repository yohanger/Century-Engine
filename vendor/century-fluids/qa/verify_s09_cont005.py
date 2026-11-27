#!/usr/bin/env python3
"""S09-G001 CONT005 single integral verification: physical correctness before FPS claims.

Does not close S09 or represent a running browser as QA GUI acceptance.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path
import subprocess
import sys
from verify_s01 import check_manifest,check_ledger,local_files
from verify_s06 import read_gate

GATE='CENTURY-FLUIDS-S09-G001-INTEGRAL-PERFORMANCE-AND-STABILITY'
REQUIRED={
 'src/liquid.ts','src/contacts.ts',
 'docs/27_S09_CONT005_INTEGRAL_PHYSICS_STABILITY_PERFORMANCE_AND_PLAYGROUND_QA.md',
 'tests/integral_physics_s09.test.mjs','tests/benchmark_integral_s09.mjs',
 'qa/verify_s09_cont005.py','qa/S09_CONT005_REVIEW.md','qa/S09_CONT005_RUN.log',
 'qa/MANIFEST.sha256','ledger/CENTURY_FLUIDS_LEDGER.xlsx',
 'qa/S09_CONT005_FOLLOWUP_REVIEW.md',
 'tests/benchmark_cont005_ab.mjs','tests/browser_cont005_qa.mjs',
 'qa/CONT005_followup/brave-after/run.json',
 'qa/S09_CONT005_SHORE_REVIEW.md','qa/CONT005_shore/shore-numeric.json',
 'playground/src/shore.mjs','playground/src/water-optics.mjs',
}
def run(root:Path,cmd:list[str])->None:
 print('S09_CONT005_QA_RUN',' '.join(cmd),flush=True)
 result=subprocess.run(cmd,cwd=root,check=False)
 if result.returncode:raise RuntimeError(f'QA command failed exit={result.returncode}: {cmd}')
def main()->None:
 p=argparse.ArgumentParser()
 p.add_argument('--project',type=Path,default=Path(__file__).resolve().parents[1])
 p.add_argument('--static-only',action='store_true')
 p.add_argument('--jolt',action='store_true',help='real Node Jolt WASM 1.1.0 test; dependency must exist')
 p.add_argument('--browser-build',action='store_true',help='real Vite production build; NOT graphical acceptance')
 a=p.parse_args();root=a.project.resolve();files=local_files(root)
 if not REQUIRED<=set(files):raise RuntimeError(f'missing S09 CONT005 artifacts: {sorted(REQUIRED-set(files))}')
 check_manifest(files);check_ledger(root)
 if read_gate(root,14)!=GATE:raise RuntimeError('S09 main G001 gate changed')
 doc=files['docs/27_S09_CONT005_INTEGRAL_PHYSICS_STABILITY_PERFORMANCE_AND_PLAYGROUND_QA.md'].decode()
 if 'CONT-005-INTEGRAL-PHYSICS-STABILITY-PERFORMANCE-AND-PLAYGROUND-QA autoriza comenzar' not in doc:
  raise RuntimeError('literal CONT005 authorization missing')
 if not all(x in doc for x in ('EN PAUSA','NO AUTORIZADO','88','1/8','NO VERIFICADOS')):
  raise RuntimeError('incomplete QA/authority status')
 fluid=json.loads(files['package.json']);playground=json.loads(files['playground/package.json'])
 if fluid.get('dependencies') or 'three' in fluid.get('devDependencies',{}):
  raise RuntimeError('renderer dependency imported into physical library')
 if playground['dependencies']['jolt-physics']!='1.1.0':raise RuntimeError('changed Jolt ABI')
 print(f'S09_CONT005_STATIC_PASS files={len(files)} sheets=6 sprints=11 gates=11',flush=True)
 if a.static_only:return
 flags=['--project',str(root)]
 if a.jolt:flags.append('--jolt')
 if a.browser_build:flags.append('--browser-build')
 run(root,[sys.executable,'qa/verify_s09_cont004.py',*flags])
 run(root,['node','tests/benchmark_integral_s09.mjs'])
 run(root,['node','tests/benchmark_chunks.mjs'])
 print('S09_CONT005_AUTHOR_QA_PASS reference_convergence=PARTIAL gravity_sleep=CONSERVATIVE browser_evidence=SEE_FOLLOWUP user_acceptance=PENDING',flush=True)
if __name__=='__main__':
 try:main()
 except (RuntimeError,ValueError,AssertionError,OSError,KeyError,json.JSONDecodeError) as e:
  print('S09_CONT005_QA_FAIL',e,file=sys.stderr);sys.exit(1)
