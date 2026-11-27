import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {createJoltHost} from '../playground/src/jolt-runtime.mjs';
import {SimulationSession} from '../playground/src/simulation.mjs';

const host = await createJoltHost();
const resolution=process.env.CENTURY_VOXEL_CUP_CELL;
const session = new SimulationSession({scenarioId:'cup',jolt:host,voxelSizeMeters:resolution?Number(resolution):undefined});
const stages = [
  ['dip', .075, 0, 160], ['hold low', .075, 0, 100],
  ['lift', .68, 0, 180], ['pour', .76, -2.12, 335]
];
const mass = session.world.totalMassKg, data = [];
try {
  for (const [name, y, tilt, steps] of stages) {
    session.setCupTarget({x:0,y,z:0},tilt);
    let contacts = 0;
    const times=[];
    for(let tick=0;tick<steps;tick++) {
      try {
        const start=performance.now();
        const step = session.step();
        times.push(performance.now()-start);
        contacts += step.boundaryContacts;
        assert.ok(step.maximumSolidExcessM3 <= 1e-10);
      } catch(error) {throw Error(name+' step '+tick+' at '+JSON.stringify(session.cupTransform),{cause:error});}
    }
    const sum = [...session.world.cells()].reduce((a,c)=>a+c.volumeM3,0)*1000;
    assert.ok(Math.abs(mass-sum) < 1e-6,'water volume changed');
    times.sort((a,b)=>a-b);
    const result = {name,simulatedSeconds:session.simulatedSeconds, waterInCupKg:session.cupContents.massKg,
      pose:session.cupTransform, contacts, physicsP50:times[Math.floor(times.length*.5)], physicsP95:times[Math.floor(times.length*.95)],
      cellSizeMeters:session.world.cellSizeMeters, massErrorKg:Math.abs(sum-mass)};
    data.push(result);
    console.log(JSON.stringify(result));
  }
  assert.ok(data[2].waterInCupKg>.1, 'the lifted cup must retain water');
  assert.ok(data[3].waterInCupKg<data[2].waterInCupKg*.25,'the measured contents must spill with tilt');
} finally {
  session.shutdown();
  host.shutdown();
}
