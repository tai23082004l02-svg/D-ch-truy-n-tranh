import test from 'node:test';
import assert from 'node:assert/strict';
import {safeFilename,validatePages,imageExtension,readImage} from '../extension/source.js';

test('capture filenames reject traversal, control characters and Windows device names',()=>{
  assert.equal(safeFilename('../chapter: 1?\u0000'),'..-chapter- 1--');
  assert.equal(safeFilename('CON'),'chapter-CON');
  assert.equal(safeFilename('...'),'chuong-truyen-raw');
  assert.ok(safeFilename('x'.repeat(200)).length<=90);
});
test('reader pages retain numeric order, but reject duplicates, gaps and title pages',()=>{
  const row=page=>({page,url:`https://cdn.example.test/${page}.webp`});
  assert.deepEqual(validatePages([row(2),row(1)]).map(r=>r.page),[1,2]);
  for(const data of [[],[row(2)],[row(1),row(3)],[row(1),row(1)],[{page:1,url:'javascript:alert(1)'}],[{page:1,url:'https://user:secret@example.test/a'}],Array.from({length:101},(_,i)=>row(i+1))])assert.throws(()=>validatePages(data));
});
test('image responses use binary signatures, not URL extensions or content-type claims',()=>{
  assert.equal(imageExtension(new Uint8Array([137,80,78,71,13,10,26,10])),'png');
  assert.equal(imageExtension(new Uint8Array([255,216,255])),'jpg');
  assert.equal(imageExtension(new TextEncoder().encode('RIFF1234WEBP')),'webp');
  assert.throws(()=>imageExtension(new TextEncoder().encode('<html>Access denied</html>')));
});
test('download reader rejects server denial and oversized declared content',async()=>{
  const signal=new AbortController().signal;
  await assert.rejects(readImage(new Response('Forbidden',{status:403}),signal),/403/);
  await assert.rejects(readImage(new Response('',{headers:{'Content-Length':31*1024**2}}),signal),/30 MB/);
});
test('download reader verifies stream size, preserves bytes and handles cancellation',async()=>{
  const bytes=new Uint8Array([137,80,78,71,13,10,26,10,12,13]);
  const result=await readImage(new Response(bytes),new AbortController().signal);
  assert.deepEqual(result.bytes,bytes);assert.equal(result.extension,'png');
  const controller=new AbortController();controller.abort();
  await assert.rejects(readImage(new Response(bytes),controller.signal),{name:'AbortError'});
  const stream=new ReadableStream({start(c){c.enqueue(new Uint8Array(31*1024**2));c.close();}});
  await assert.rejects(readImage(new Response(stream),new AbortController().signal),/30 MB/);
});
