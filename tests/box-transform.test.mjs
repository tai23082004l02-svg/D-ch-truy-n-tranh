import test from 'node:test';
import assert from 'node:assert/strict';
import {boxHandles,handleAt,transformBox} from '../src/box-transform.js';
const b={x:100,y:80,w:200,h:150};
test('all eight handles resize against the opposite edge and stay inside the image',()=>{
 for(const [handle,x,y]of boxHandles(b)){
  assert.equal(handleAt(b,{x,y},5),handle);
  const r=transformBox(b,{x,y},{x:x+20,y:y+10},handle,600,600);
  assert.ok(r.w>=12&&r.h>=12&&r.x>=0&&r.y>=0&&r.x+r.w<=600&&r.y+r.h<=600);
  if(handle.includes('w'))assert.equal(r.x+r.w,300);
  if(handle.includes('n'))assert.equal(r.y+r.h,230);
 }
 assert.deepEqual(transformBox(b,{x:0,y:0},{x:1000,y:1000},'nw',600,600),{x:288,y:218,w:12,h:12});
 assert.deepEqual(transformBox(b,{x:0,y:0},{x:1000,y:1000},'se',600,600),{x:100,y:80,w:500,h:520});
});
test('moving clamps all edges without changing box dimensions',()=>{
 assert.deepEqual(transformBox(b,{x:0,y:0},{x:-1000,y:-1000},'move',600,600),{x:0,y:0,w:200,h:150});
 assert.deepEqual(transformBox(b,{x:0,y:0},{x:1000,y:1000},'move',600,600),{x:400,y:450,w:200,h:150});
});
