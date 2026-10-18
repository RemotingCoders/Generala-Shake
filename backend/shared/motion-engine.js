// GENERATED from shared/ — edit there and run node scripts/sync-shared.mjs
const module = { exports: {} };
/* Continuous dice motion and hysteretic shake detection; no network or sensor permission here. */
(function(root){
class ShakeDetector {
 constructor({threshold=7,quietMs=550}={}){this.threshold=threshold;this.quietMs=quietMs;this.reset();}
 reset(){this.peaks=[];this.lastEnergy=-Infinity;this.confirmed=false;this.gravity=null;this.lastSample=null;this.warmUntil=0;this.samples=0;}
 sample(event,now){
  let a=event.acceleration,hasLinear=a&&[a.x,a.y,a.z].every(Number.isFinite),v;
  if(hasLinear)v=[a.x,a.y,a.z];
  else{const g=event.accelerationIncludingGravity;if(!g||![g.x,g.y,g.z].every(Number.isFinite))return false;
   const raw=[g.x,g.y,g.z];if(!this.gravity){this.gravity=raw.slice();this.warmUntil=now+450;this.lastSample=now;return false;}
   const alpha=1-Math.exp(-Math.max(0,now-this.lastSample)/700);this.gravity=this.gravity.map((x,i)=>x+alpha*(raw[i]-x));v=raw.map((x,i)=>x-this.gravity[i]);}
  this.lastSample=now;this.samples++;if(now<this.warmUntil)return true;
  const magnitude=Math.hypot(...v);this.peaks=this.peaks.filter(t=>now-t<=180);
  if(magnitude>=this.threshold&&(!this.peaks.length||now-this.peaks[this.peaks.length-1]>=20))this.peaks.push(now);
  if(this.peaks.length>=2)this.confirmed=true;
  if(this.confirmed&&magnitude>=this.threshold*.45)this.lastEnergy=now;
  return true;
 }
 active(now){if(now-this.lastEnergy>this.quietMs){this.confirmed=false;return false;}return this.confirmed;}
}
// DiceMotion: spin while active, then a continuous brake onto exact cube poses (no snapping at the end).
// Optional subset animation: setActive(true, now, mask) spins only the dice whose mask entry is true; the
// others keep their pose and position. Without a mask every die moves (prototype behaviour).
// Options: minSpinMs (spin before braking, 350), durationMs (brake, 5000), randomFaces (pick random result
// faces when a spin starts from rest, true; pass false and call setFrontFaces() to land on given faces).
class DiceMotion {
 constructor({initial,frontFaces,choosePose,choosePositions,onTransition=()=>{},minSpinMs=350,durationMs=5000,randomFaces=true}){this.angles=initial.map(a=>a.slice());this.frontFaces=frontFaces.slice();this.choosePose=choosePose;this.choosePositions=choosePositions;this.positions=choosePositions(null);this.finalPositions=this.positions.map(p=>p.slice());this.onTransition=onTransition;this.velocity=initial.map(()=>[0,0,0]);this.phase='idle';this.time=null;this.active=false;this.roll=0;this.settled=0;this.spinStart=0;this.factors=initial.map((_,i)=>[1,1.3+i*.1,.7]);this.minSpinMs=minSpinMs;this.durationMs=durationMs;this.randomFaces=randomFaces;this.mask=initial.map(()=>true);}
 transition(phase){this.phase=phase;this.onTransition({phase,roll:this.roll,settled:this.settled});}
 moving(i){return this.phase!=='idle'&&this.mask[i];}
 setActive(value,now,mask){this.advance(now);if(value===this.active)return;this.active=value;if(value&&this.phase!=='spinning'){
   const m=mask?mask.map(Boolean):this.angles.map(()=>true);
   if(this.phase==='idle'){this.roll++;this.mask=m;if(this.randomFaces)this.frontFaces=this.frontFaces.map((f,i)=>this.mask[i]?1+Math.floor(Math.random()*6):f);this.finalPositions=this.choosePositions(this.positions,this.mask);}
   else this.mask=this.mask.map((x,i)=>x||m[i]); // re-spin during a brake: dice already braking keep moving
   this.spinStart=now;this.transition('spinning');
  }}
 // Result faces for the next brake (dice already braking keep their targets).
 setFrontFaces(faces){this.frontFaces=this.frontFaces.map((f,i)=>faces[i]===undefined?f:faces[i]);}
 // Put one resting die on `face` instantly (only for dice that are not moving).
 snapDie(i,face){if(this.moving(i))return false;this.angles[i]=this.choosePose(face);this.velocity[i]=[0,0,0];this.frontFaces[i]=face;return true;}
 // Everything at rest on `faces` instantly (first render, reduced motion). Fires an 'idle' transition.
 snap(faces,now){this.time=now;this.active=false;faces.forEach((f,i)=>{this.angles[i]=this.choosePose(f);this.velocity[i]=[0,0,0];this.frontFaces[i]=f;});this.positions=this.finalPositions.map(p=>p.slice());this.settled++;this.transition('idle');}
 startBrake(now){this.brakeStart=now;this.brakeAngles=this.angles.map(a=>a.slice());this.brakeVelocity=this.velocity.map(a=>a.slice());this.fromPositions=this.positions.map(p=>p.slice());this.duration=this.durationMs;
  this.targets=this.angles.map((a,i)=>{if(!this.mask[i])return a.slice();const pose=this.choosePose(this.frontFaces[i]);return a.map((v,j)=>{const turn=2*Math.PI,budget=this.velocity[i][j]*2.5;let d=((pose[j]-v)%turn+turn)%turn;if(d<1e-8)d=turn;while(d+turn<=budget)d+=turn;return v+d;});});this.transition('braking');}
 advance(now){if(this.time===null){this.time=now;return this.snapshot();}const dt=Math.max(0,(now-this.time)/1000);this.time=now;
  if(this.phase==='spinning'){
   const decay=Math.exp(-dt/.12);this.angles=this.angles.map((a,i)=>!this.mask[i]?a:a.map((v,j)=>{const target=4*this.factors[i][j],old=this.velocity[i][j];this.velocity[i][j]=target+(old-target)*decay;return v+target*dt+(old-target)*.12*(1-decay);}));
   if(!this.active&&now-this.spinStart>=this.minSpinMs)this.startBrake(now);
  }else if(this.phase==='braking'){
   const u=Math.min(1,Math.max(0,(now-this.brakeStart)/this.duration)),T=this.duration/1000;
   this.angles=this.brakeAngles.map((a,i)=>!this.mask[i]?this.angles[i]:a.map((v,j)=>{const d=this.targets[i][j]-v,p=this.brakeVelocity[i][j]*T/d;this.velocity[i][j]=u===1?0:this.brakeVelocity[i][j]*(1-u)**(p-1);return u===1?this.targets[i][j]:v+d*(1-(1-u)**p);}));
   const blend=u*u*u*(10+u*(-15+6*u));this.positions=this.fromPositions.map((p,i)=>!this.mask[i]?p:p.map((v,j)=>v+(this.finalPositions[i][j]-v)*blend));
   if(u===1){this.settled++;this.transition('idle');}
  }return this.snapshot();
 }
 snapshot(){return {rotations:this.angles,positions:this.positions,velocity:this.velocity,phase:this.phase,frontFaces:this.frontFaces,roll:this.roll,settled:this.settled,mask:this.mask};}
}
const api={ShakeDetector,DiceMotion};if(typeof module!=='undefined')module.exports=api;else root.DiceMotionCore=api;
})(typeof window==='undefined'?this:window);

export const { ShakeDetector, DiceMotion } = module.exports;
export default module.exports;
