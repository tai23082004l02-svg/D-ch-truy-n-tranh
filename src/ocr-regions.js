// Detect enclosed white speech balloons before OCR. Only enclosed ink is copied
// into the OCR image; panel borders, screentones and character outlines stay out.
export function findSpeechRegions(image) {
  const { width, height, data } = image, count = width * height;
  const gray = new Uint8Array(count), labels = new Int32Array(count), queue = new Int32Array(count);
  for (let i=0;i<count;i++) gray[i]=Math.round((data[i*4]*.299+data[i*4+1]*.587+data[i*4+2]*.114)*(data[i*4+3]/255)+255*(1-data[i*4+3]/255));
  const candidates=[]; let label=0;
  for(let start=0;start<count;start++) {
    if(labels[start] || gray[start]<240) continue;
    label++; let head=0,tail=0,area=0,x0=width,y0=height,x1=0,y1=0;
    queue[tail++]=start; labels[start]=label;
    while(head<tail){
      const index=queue[head++],x=index%width,y=Math.floor(index/width); area++;
      x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);
      for(const next of [x>0?index-1:-1,x<width-1?index+1:-1,y>0?index-width:-1,y<height-1?index+width:-1]){
        if(next>=0&&!labels[next]&&gray[next]>=240){labels[next]=label;queue[tail++]=next;}
      }
    }
    const w=x1-x0+1,h=y1-y0+1;
    if(x0>0&&y0>0&&x1<width-1&&y1<height-1&&w>=35&&h>=25&&w<width*.75&&h<height*.45&&area>=400&&w*h<count*.18&&area/(w*h)>.32) candidates.push({id:label,x0,y0,x1,y1,w,h});
  }
  const regions=[];
  for(const candidate of candidates){
    const {id,x0,y0,w,h}=candidate, visited=new Uint8Array(w*h), localQueue=new Int32Array(w*h);
    const isWall=index=>labels[(y0+Math.floor(index/w))*width+x0+index%w]===id;
    // Flood the non-white exterior of the balloon's bounding rectangle.
    let head=0,tail=0;
    const enter=index=>{if(!visited[index]&&!isWall(index)){visited[index]=1;localQueue[tail++]=index;}};
    for(let x=0;x<w;x++){enter(x);enter((h-1)*w+x);}
    for(let y=0;y<h;y++){enter(y*w);enter(y*w+w-1);}
    const visitNeighbors=(index,fn)=>{
      const x=index%w,y=Math.floor(index/w);
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if((dx||dy)&&x+dx>=0&&x+dx<w&&y+dy>=0&&y+dy<h)fn(index+dy*w+dx);
    };
    while(head<tail)visitNeighbors(localQueue[head++],enter);
    const holes=[];
    for(let start=0;start<w*h;start++){
      if(visited[start]||isWall(start))continue;
      head=0;tail=0;visited[start]=1;localQueue[tail++]=start;
      let hx0=w,hy0=h,hx1=0,hy1=0,ink=0;
      while(head<tail){
        const index=localQueue[head++],x=index%w,y=Math.floor(index/w);
        hx0=Math.min(hx0,x);hx1=Math.max(hx1,x);hy0=Math.min(hy0,y);hy1=Math.max(hy1,y);
        if(gray[(y0+y)*width+x0+x]<180)ink++;
        visitNeighbors(index,next=>{if(!visited[next]&&!isWall(next)){visited[next]=1;localQueue[tail++]=next;}});
      }
      const hw=hx1-hx0+1,hh=hy1-hy0+1;
      if(ink>=2&&hh<=Math.min(100,h*.6)&&hw<=w*.8&&hw/hh<12)holes.push({x0:hx0,y0:hy0,x1:hx1,y1:hy1,h:hh,ink,pixels:localQueue.slice(0,tail)});
    }
    const letterHeights=holes.filter(hole=>hole.h>=5&&hole.ink>=5).map(hole=>hole.h).sort((a,b)=>a-b);
    if(letterHeights.length<2)continue;
    const median=letterHeights[Math.floor(letterHeights.length/2)];
    const letters=holes.filter(hole=>hole.h>=Math.max(4,median*.4)&&hole.h<=median*2.2);
    if(letters.length<2)continue;
    // Keep punctuation close to a letter, but discard isolated specks/art details.
    const kept=holes.filter(hole=>letters.includes(hole)||letters.some(l=>hole.h<median*.4&&Math.abs((hole.x0+hole.x1-l.x0-l.x1)/2)<median*1.3&&hole.y0<=l.y1+median*.5&&hole.y1>=l.y0-median*.5));
    const bx0=Math.min(...kept.map(h=>h.x0)),by0=Math.min(...kept.map(h=>h.y0)),bx1=Math.max(...kept.map(h=>h.x1)),by1=Math.max(...kept.map(h=>h.y1));
    const pad=Math.max(5,Math.round(median*.3)),x=Math.max(0,x0+bx0-pad),y=Math.max(0,y0+by0-pad);
    const rw=Math.min(width,x0+bx1+pad+1)-x,rh=Math.min(height,y0+by1+pad+1)-y;
    const mask=new Uint8Array(rw*rh);mask.fill(255);
    for(const hole of kept)for(const index of hole.pixels){const gx=x0+index%w,gy=y0+Math.floor(index/w);mask[(gy-y)*rw+gx-x]=gray[gy*width+gx];}
    const ink=kept.reduce((n,h)=>n+h.ink,0);
    if(ink<30||ink/(rw*rh)<.018||ink/(rw*rh)>.6||rh/rw>3.5)continue;
    regions.push({x,y,w:rw,h:rh,mask,fontSize:median});
  }
  return regions.sort((a,b)=>Math.abs(a.y-b.y)<Math.min(a.h,b.h)*.35?b.x-a.x:a.y-b.y).slice(0,120);
}

export function usableOCR(data, language='eng') {
  const text=(data.text||'').trim();
  if(!text||!Number.isFinite(data.confidence)||data.confidence<48)return false;
  if(language!=='eng')return /[\p{L}\p{N}]{2}/u.test(text.replace(/\s/g,''));
  const letters=(text.match(/[a-z]/gi)||[]).length, words=text.split(/\s+/);
  const junk=(text.match(/[^a-z\s.,!?':;"“”‘’()\-…0-9]/gi)||[]).length;
  return (letters>=3||(letters===2&&data.confidence>=65))&&letters/Math.max(1,words.length)>=1.8&&junk/Math.max(1,text.length)<.15;
}

// A hand-selected rectangle can cut through the balloon border. Remove dark
// components attached to its edges instead of treating those strokes as letters.
export function isolateCropInk(image) {
  const {width,height,data}=image,count=width*height;
  const mask=new Uint8Array(count),seen=new Uint8Array(count),queue=new Int32Array(count);
  for(let i=0;i<count;i++)mask[i]=Math.round((data[i*4]+data[i*4+1]+data[i*4+2])/3);
  let head=0,tail=0;
  const enter=index=>{if(!seen[index]&&mask[index]<240){seen[index]=1;queue[tail++]=index;}};
  for(let x=0;x<width;x++){enter(x);enter((height-1)*width+x);}
  for(let y=0;y<height;y++){enter(y*width);enter(y*width+width-1);}
  while(head<tail){const index=queue[head++],x=index%width,y=Math.floor(index/width);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if((dx||dy)&&x+dx>=0&&x+dx<width&&y+dy>=0&&y+dy<height)enter(index+dy*width+dx);}
  for(let i=0;i<tail;i++)mask[queue[i]]=255;
  return {w:width,h:height,mask};
}
