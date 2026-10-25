import test from 'node:test';
import assert from 'node:assert/strict';
import {createHistory,snapshotProject} from '../src/history.js';
test('undo retains deleted pages and repair canvases without sharing mutable boxes',()=>{
 const patch={canvas:{width:50},blob:new Blob(['repair']),maskBlob:new Blob(['mask'])};
 const state={pages:[{id:'p',blob:new Blob(['image']),boxes:[{id:'b',source:'old',artPatch:patch}]}]};
 const h=createHistory(snapshotProject(state));
 state.pages[0].boxes[0].source='new';h.commit(snapshotProject(state));
 state.pages=[];h.commit(snapshotProject(state));
 const restored=h.undo();assert.equal(restored.pages[0].boxes[0].source,'new');assert.equal(restored.pages[0].boxes[0].artPatch.canvas.width,50);
 assert.equal(h.undo().pages[0].boxes[0].source,'old');assert.equal(h.undo(),null);
});
test('typing groups end at focus boundary or time gap; history is bounded',()=>{
 const h=createHistory({pages:[],value:0},{limit:2});
 h.commit({pages:[],value:1},'field',0);h.commit({pages:[],value:2},'field',100);assert.equal(h.size,1);
 h.breakGroup();h.commit({pages:[],value:3},'field',200);assert.equal(h.undo().value,2);
 h.commit({pages:[],value:4},'field',1000);h.commit({pages:[],value:5},'field',2000);h.commit({pages:[],value:6},null,2100);
 assert.equal(h.size,2);assert.equal(h.undo().value,5);assert.equal(h.undo().value,4);
});
