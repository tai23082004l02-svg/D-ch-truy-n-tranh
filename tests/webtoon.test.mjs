import test from 'node:test';
import assert from 'node:assert/strict';
import {flatRows,planCuts} from '../src/webtoon.js';

test('flat row detector rejects even thin balloon edges',()=>{
  const width=200,height=4,data=new Uint8ClampedArray(width*height*4);data.fill(255);
  for(const x of [30,170]){const i=(width+x)*4;data[i]=data[i+1]=data[i+2]=0;}
  for(let x=0;x<width;x++){const i=(width*2+x)*4;data[i]=data[i+1]=data[i+2]=0;}
  for(let x=0;x<width;x++){const i=(width*3+x)*4;data[i]=120;data[i+1]=100;data[i+2]=80;}
  assert.deepEqual([...flatRows({width,height,data})],[1,0,2,0]);
});
test('cuts move from a tile boundary to a wide blank gutter',()=>{
  const plan=planCuts(10000,[{start:3500,end:3700},{start:7100,end:7300}],{target:4000});
  assert.ok(plan[0].end>=3520&&plan[0].end<=3680);assert.equal(plan[0].forced,false);
  assert.equal(plan[0].start,0);assert.equal(plan.at(-1).end,10000);
  for(let i=1;i<plan.length;i++)assert.equal(plan[i].start,plan[i-1].end);
});
test('search extends beyond desired height instead of cutting speech',()=>{
  const plan=planCuts(22000,[{start:8000,end:8200}],{target:4000});
  assert.equal(plan[0].start,0);assert.ok(plan[0].end>=8000);assert.equal(plan[0].forced,false);
});
test('no safe gutter uses bounded segments with documented overlap and full coverage',()=>{
  const plan=planCuts(25000,[],{target:4000,hardMax:12000,overlap:400});
  assert.equal(plan[0].end,12000);assert.equal(plan[0].forced,true);
  assert.equal(plan[1].start,11600);assert.equal(plan[1].overlapBefore,400);
  assert.equal(plan.at(-1).end,25000);
  assert.ok(plan.every(p=>p.end-p.start<=12000));
  for(let i=1;i<plan.length;i++)assert.ok(plan[i].start<=plan[i-1].end);
});
test('final unsplit segment does not get a false warning, narrow gaps are ignored',()=>{
  assert.deepEqual(planCuts(9000,[],{target:4000}),[{start:0,end:9000,forced:false,overlapBefore:0}]);
  assert.equal(planCuts(25000,[{start:3998,end:4002}],{target:4000,minGap:40})[0].end,12000);
});
