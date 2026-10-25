import test from 'node:test';
import assert from 'node:assert/strict';
import {suggestMask,dilateMask,maskedOCRInput} from '../src/art-mask.js';
import {validateBox,paintBox} from '../src/core.js';

function fixture(){
  const width=100,height=80,data=new Uint8ClampedArray(width*height*4);for(let i=0;i<width*height;i++){data[i*4]=data[i*4+1]=data[i*4+2]=80;data[i*4+3]=255;}
  const rect=(x,y,w,h,v)=>{for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++){const i=(yy*width+xx)*4;data[i]=data[i+1]=data[i+2]=v;}};
  rect(20,20,22,32,255);rect(23,23,16,26,0);rect(28,30,6,10,80);rect(80,5,1,1,255);
  return {width,height,data};
}
test('outlined text mask includes dark cores and excludes unselected background/specks',()=>{
  const data=fixture(),mask=suggestMask(data,{dilation:1});assert.equal(mask[25*100+25],255);assert.equal(mask[20*100+20],255);assert.equal(mask[5*100+80],0);assert.equal(mask[5*100+5],0);
});
test('OCR normalization removes white outlines without filling letter counters',()=>{
  const data=fixture(),mask=suggestMask(data,{dilation:0});const normalized=maskedOCRInput(data,mask);
  assert.equal(normalized.data[(25*100+25)*4],0);assert.equal(normalized.data[(35*100+30)*4],255);assert.equal(normalized.data[(20*100+20)*4],255);
});
test('mask dilation never wraps around a row boundary',()=>{
  const mask=new Uint8Array(16);mask[3]=255;const out=dilateMask(mask,4,4,1);
  assert.equal(out[2],255);assert.equal(out[7],255);assert.equal(out[4],0);
});
test('art style persists explicit zero outline and sanitizes colors',()=>{
  const box=validateBox({x:0,y:0,w:100,h:100,mode:'art',strokeWidth:0,textColor:'url(evil)'},200,200);
  assert.equal(box.mode,'art');assert.equal(box.strokeWidth,0);assert.equal(box.textColor,'#ffffff');
});
test('repaired artwork renders even before translation; no flat white fill',()=>{
  let draws=0;const box={mode:'art',translated:'',artPatch:{canvas:{},x:1,y:2,w:3,h:4}};
  paintBox({drawImage(){draws++;},fillRect(){throw Error('Must not white out artwork');}},box);assert.equal(draws,1);
});
