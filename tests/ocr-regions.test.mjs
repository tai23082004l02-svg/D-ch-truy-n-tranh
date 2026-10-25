import test from 'node:test';
import assert from 'node:assert/strict';
import {findSpeechRegions,usableOCR,isolateCropInk} from '../src/ocr-regions.js';

function fixture() {
  const width=600,height=800,data=new Uint8ClampedArray(width*height*4);data.fill(255);
  const rect=(x,y,w,h,value)=>{for(let py=y;py<y+h;py++)for(let px=x;px<x+w;px++){const i=(py*width+px)*4;data[i]=data[i+1]=data[i+2]=value;}};
  // Panel edges span the page and must never become OCR text bounds.
  rect(10,10,580,4,0);rect(10,10,4,780,0);rect(10,786,580,4,0);rect(586,10,4,780,0);
  for(const y of [80,400]){
    rect(350,y,180,130,0);rect(354,y+4,172,122,255);
    for(const ly of [y+30,y+65])for(let x=370;x<490;x+=20)rect(x,ly,10,18,0);
  }
  // Busy outside artwork should not join the two balloons.
  for(let y=220;y<380;y+=12)rect(50,y,240,3,0);
  return {width,height,data};
}
test('speech detection isolates enclosed text and omits panel borders',()=>{
  const regions=findSpeechRegions(fixture());
  assert.equal(regions.length,2);
  for(const r of regions){assert.ok(r.x>350);assert.ok(r.w<180);assert.ok(r.h<130);assert.ok(r.mask.some(v=>v===0));assert.equal(r.mask[0],255);}
  assert.ok(regions[0].y<200);assert.ok(regions[1].y>400);
});
test('blank pages and unclosed white background do not become text regions',()=>{
  const data=new Uint8ClampedArray(200*200*4);data.fill(255);
  assert.equal(findSpeechRegions({width:200,height:200,data}).length,0);
});
test('OCR confidence gate rejects garbage, missing scores and single letters',()=>{
  for(const data of [{text:'HELLO',confidence:12},{text:'7 | AV HN ~ =',confidence:70},{text:'A',confidence:90},{text:'HELLO'}])assert.equal(usableOCR(data),false);
  assert.equal(usableOCR({text:'WHAT DO YOU THINK, GRANDFATHER?',confidence:86}),true);
  assert.equal(usableOCR({text:'HMMM...',confidence:65}),true);
  assert.equal(usableOCR({text:'NO!',confidence:88}),true);
  assert.equal(usableOCR({text:'NO!',confidence:50}),false);
});
test('manual crop removes edge-connected artwork while retaining enclosed letters',()=>{
  const width=100,height=80,data=new Uint8ClampedArray(width*height*4);data.fill(255);
  const black=(x,y)=>{const i=(y*width+x)*4;data[i]=data[i+1]=data[i+2]=0;};
  for(let x=0;x<50;x++)black(x,10);
  for(let y=25;y<45;y++)for(let x=40;x<48;x++)black(x,y);
  const result=isolateCropInk({width,height,data});
  assert.equal(result.mask[10*width+20],255);assert.equal(result.mask[30*width+43],0);
});
