/** Fixed timestep policy. No second physics clock; callback is the sole step authority. */
export function advanceClock({accumulatorSeconds=0,elapsedSeconds,rate=1,stepSeconds=1/120,maxSteps=4,advance}){
  if(!Number.isFinite(accumulatorSeconds)||accumulatorSeconds<0||!Number.isFinite(elapsedSeconds)||elapsedSeconds<0||
     !Number.isFinite(rate)||rate<=0||!Number.isFinite(stepSeconds)||stepSeconds<=0||
     !Number.isSafeInteger(maxSteps)||maxSteps<1||typeof advance!=='function')throw Error('Invalid fixed-step clock arguments');
  let pending=accumulatorSeconds+Math.min(elapsedSeconds,.25)*rate;
  let performed=0;
  while(pending+1e-12>=stepSeconds&&performed<maxSteps){
    advance(stepSeconds);
    pending=Math.max(0,pending-stepSeconds);performed++;
  }
  const dropped=Math.floor((pending+1e-12)/stepSeconds);
  if(dropped)pending=0;
  return {accumulatorSeconds:pending,performed,dropped};
}
