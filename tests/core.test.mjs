import test from 'node:test';
import assert from 'node:assert/strict';
import { naturalCompare, validateBox, parseTranslations, fitText, paintBox } from '../src/core.js';

const box = {id:'a',x:10,y:10,w:200,h:100,fontSize:32,source:'Hello',translated:'Xin chào',background:'#ffffff',bold:true};
const context = () => ({font:'',measureText(text){return {width:text.length*parseInt(this.font.match(/(\d+)px/)?.[1]||'20')*.55};}});
test('chapter filenames follow natural order',()=>assert.deepEqual(['10.png','2.png','1.png'].sort(naturalCompare),['1.png','2.png','10.png']));
test('project boxes must remain inside original image',()=>{
  assert.throws(()=>validateBox({...box,x:-1},500,500),/ngoài ảnh/);
  assert.throws(()=>validateBox({...box,w:1000},500,500),/ngoài ảnh/);
  assert.throws(()=>validateBox({...box,x:NaN},500,500),/không hợp lệ/);
  assert.equal(validateBox({...box,fontSize:900,background:'url(evil)'},500,500).background,'#ffffff');
  assert.equal(validateBox({...box,fontSize:900},500,500).fontSize,160);
});
test('translation import supports fenced JSON without changing IDs',()=>{
  const result=parseTranslations('```json\n{"translations":[{"id":"a","translated":"Xin chào"}]}\n```',new Set(['a','b']));
  assert.equal(result.get('a'),'Xin chào');assert.equal(result.size,1);
});
test('translation import rejects duplicate, foreign, empty and malformed rows',()=>{
  for(const input of [[{id:'z',translated:'Xin chào'}],[{id:'a',translated:''}],[{id:'a',translated:'a'},{id:'a',translated:'b'}],{translations:[]},'not json'])assert.throws(()=>parseTranslations(input,new Set(['a'])));
});
test('layout shrinks Vietnamese text and flags impossible fit',()=>{
  const c=context();const layout=fitText(c,{...box,translated:'Đây là lời thoại tiếng Việt dài hơn để thử tự xuống dòng.'});
  assert.ok(layout.fits);assert.ok(layout.size<32);assert.ok(layout.lines.length>1);
  assert.equal(fitText(c,{...box,w:15,h:15,translated:'Quá nhiều lời thoại cho một ô rất nhỏ'}).fits,false);
});
test('layout wraps an uninterrupted word and preserves explicit newlines',()=>{
  const layout=fitText(context(),{...box,translated:'Xin chào\nABCDEFGHIJKLMNO',w:80,h:200});
  assert.ok(layout.fits);assert.ok(layout.lines.length>=3);
});
test('untranslated regions preserve original pixels',()=>{
  let touched=false;assert.equal(paintBox({save(){touched=true;}},{...box,translated:'  '}),null);assert.equal(touched,false);
});
