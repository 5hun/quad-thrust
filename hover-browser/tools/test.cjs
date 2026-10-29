const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),E=require('../dist/engine.js');const box={window:{}};vm.runInNewContext(fs.readFileSync(__dirname+'/../dist/tracks.js','utf8'),box);const tracks=box.window.HOVER_TRACKS.map(E.prepare);assert.equal(tracks.length,9);
const t=tracks[0];const near=(a,b,e=.000001)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
for(const tr of tracks){assert.ok(tr.length>1000);for(const n of tr.nodes){assert.ok(Number.isFinite(n.x+n.y+n.z));assert.ok(n.width>5);assert.equal(n.allTiles.length,n.tiles.length+4);}}
// First tick: CAR_CTR.C (240 >> 2)*128/128 =60 on EACH inertia vector.
let c=E.create(t);E.step(c,t,{accel:true},1/60);assert.equal(c.front[2],60);assert.equal(c.rear[2],60);near(c.vz,4.5);near(c.z-E.create(t).z,.075);
c=E.create(t);E.step(c,t,{l1:true,l2:true},1/60);near(c.heading,0);assert.equal(c.front[0],37);assert.equal(c.rear[0],37);
c=E.create(t);E.step(c,t,{r1:true,l2:true},1/60);near(c.heading,-22*Math.PI*2/4096);assert.equal(c.front[0],-38);assert.equal(c.rear[0],37);
c=E.create(t,2);for(let i=0;i<60;i++)E.step(c,t,{accel:true,steer:1},1/60);near(c.heading,0);
c=E.create(t,5);E.step(c,t,{l1:true,l2:true,r2:true},1/60);near(c.heading,0);assert.equal(c.front[0],0);
c=E.create(t);E.step(c,t,{turbo:true},1/60);assert.equal(c.damage,48);assert.equal(c.front[2],122);
c=E.create(t,4);E.step(c,t,{turbo:true},1/60);assert.equal(c.damage,0);assert.equal(c.turbo,false);
// Resistance, raw PS1 units (sum=3200 => speed282; drag140; 240 brake).
c=E.create(t);c.front[2]=c.rear[2]=1600;E.step(c,t,{brake:true},1/60);const sp=Math.floor(3200/Math.sqrt(128)),drag=Math.trunc(sp*18000/(128*(sp+1)));assert.equal(c.front[2],1600-((1600*(drag+240))>>13));
// Clone stage: place effect underneath stationary ship; repeated P doesn't re-fire.
function floor(symbol){const raw=JSON.parse(JSON.stringify(box.window.HOVER_TRACKS[0]));raw.samples.forEach(p=>p.tiles=symbol.repeat(p.tiles.length));return E.prepare(raw);}
let tr=floor('P');c=E.create(tr);c.damage=12000;E.step(c,tr,{},1/60);const d=c.damage;assert.ok(d<6000);E.step(c,tr,{},1/60);assert.ok(c.damage>d-20);
tr=floor('+');c=E.create(tr);c.damage=12000;E.step(c,tr,{},1/60);assert.ok(c.damage>11980,'+ is not repair');
tr=floor('J');c=E.create(tr);E.step(c,tr,{},1/60);assert.ok(c.front[1]<-1400);assert.ok(c.y>3);for(let i=0;i<10;i++)E.step(c,tr,{},1/60);assert.equal(c.grip,false);assert.ok(c.y>15);
tr=floor('B');c=E.create(tr);E.step(c,tr,{},1/60);assert.equal(c.reason,'destroyed');
c=E.create(t);c.x-=100;c.y=-75;E.step(c,t,{},1/60);assert.equal(c.reason,'course-out');
// Wall crossing vs overflying above the curb.
function hit(height){const c=E.create(t);c.x=t.nodes[0].r[0]-2;c.y=height;c.front[0]=c.rear[0]=2500;E.step(c,t,{},1/60);return c;}
assert.ok(hit(2).damage>0);assert.equal(hit(12).damage,0);
let a=E.create(t),b=E.create(t);b.x+=3;E.collide(a,b);assert.ok(a.front[0]<0&&b.front[0]>0);assert.ok(a.damage>0);
a=E.create(t);b=E.create(t);for(let i=0;i<120;i++)E.step(a,t,{accel:true},1/60);for(let i=0;i<240;i++)E.step(b,t,{accel:true},1/120);near(a.z,b.z);near(a.time,b.time);
c=E.create(t);c.progress=t.length-1;c.lastDistance=t.length-1;let p=E.at(t,3);Object.assign(c,{x:p.x,z:p.z,index:p.index,heading:p.heading,ticks:2400});E.step(c,t,{},1/60);assert.equal(c.laps.length,1);
c=E.create(t);c.lastDistance=3;p=E.at(t,t.length-3);Object.assign(c,{x:p.x,z:p.z,index:p.index});E.step(c,t,{},1/60);assert.equal(c.laps.length,0);
console.log('PASS: source thrust/drag/yaw formulas, independent inertias, frame-rate invariance, no-rudder/no-thruster machines, one-shot repair/jump, lethal floor, falling, aerial wall clearance, collisions, forward/reverse lap checks.');
