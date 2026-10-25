// Blobs and immutable repair patches are shared; editable page/box records are copied.
export function snapshotProject(state, context = '') {
  const copy = pages => pages?.map(p => ({...p, boxes:p.boxes.map(b=>({...b}))})) ?? null;
  return {pages:copy(state.pages),webtoonOriginals:copy(state.webtoonOriginals),webtoonLayout:state.webtoonLayout,active:state.active,selected:state.selected,context};
}
export function createHistory(initial, {limit=30,maxBytes=350*1024**2} = {}) {
  let present=initial, entries=[], lastGroup=null, lastTime=0;
  function bytes() {
    const blobs=new Set();
    for(const s of [...entries,present])for(const p of [...s.pages,...(s.webtoonOriginals||[])]){
      blobs.add(p.blob);for(const b of p.boxes){if(b.artPatch){blobs.add(b.artPatch.blob);blobs.add(b.artPatch.maskBlob);}}
    }
    return [...blobs].reduce((n,b)=>n+(b?.size||0),0);
  }
  return {
    get size(){return entries.length;},
    breakGroup(){lastGroup=null;},
    commit(next,group=null,now=Date.now()) {
      if(!group||group!==lastGroup||now-lastTime>700)entries.push(present);
      present=next;lastGroup=group;lastTime=now;
      while(entries.length>limit||entries.length&&bytes()>maxBytes)entries.shift();
    },
    undo(){if(!entries.length)return null;present=entries.pop();lastGroup=null;return present;}
  };
}
