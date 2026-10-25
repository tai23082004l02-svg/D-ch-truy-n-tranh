import {LIMITS} from './core.js';

// A flat white/black row is safer than "mostly white": two thin balloon edges
// must disqualify a row, even when almost the whole row is white.
export function flatRows({width,height,data}) {
  const rows=new Uint8Array(height);
  for(let y=0;y<height;y++){
    let min=255,max=0;
    for(let x=0;x<width;x++){
      const i=(y*width+x)*4,alpha=data[i+3]/255;
      const value=(data[i]*.299+data[i+1]*.587+data[i+2]*.114)*alpha+255*(1-alpha);
      min=Math.min(min,value);max=Math.max(max,value);
      if(max-min>12)break;
    }
    if(max-min<=12){if(min>=243)rows[y]=1;else if(max<=20)rows[y]=2;}
  }
  return rows;
}

export function planCuts(totalHeight,runs,{target=4000,minGap=40,hardMax=12000,overlap=400}={}) {
  if(!Number.isInteger(totalHeight)||totalHeight<1||!Number.isInteger(target)||target<400||!Number.isInteger(hardMax)||hardMax<400)throw new Error('Kích thước chia ảnh không hợp lệ.');
  target=Math.min(target,hardMax);overlap=Math.min(overlap,Math.floor(hardMax/4));
  const minimum=Math.max(200,Math.floor(target*.45)),preferredMax=Math.min(hardMax,Math.floor(target*1.6));
  const safe=runs.filter(r=>r.end-r.start>=minGap).map(r=>({start:r.start+Math.floor(minGap/2),end:r.end-Math.floor(minGap/2)})).sort((a,b)=>a.start-b.start);
  const segments=[];let start=0,overlapBefore=0;
  while(start<totalHeight){
    if(segments.length>=LIMITS.pages)throw new Error('Bộ ảnh sau chia vượt 1.000 đoạn. Hãy xử lý một phần chương.');
    if(totalHeight-start<=preferredMax){segments.push({start,end:totalHeight,forced:false,overlapBefore});break;}
    const desired=start+target,lower=start+minimum,upper=Math.min(totalHeight,start+preferredMax);
    let end=null,distance=Infinity;
    for(const run of safe){
      const lo=Math.max(run.start,lower),hi=Math.min(run.end,upper);
      if(lo>hi)continue;
      const y=Math.max(lo,Math.min(hi,desired)),d=Math.abs(y-desired);
      if(d<distance){distance=d;end=y;}
    }
    // Extend the output rather than cutting a balloon just to hit target height.
    if(end===null)for(const run of safe){const y=Math.max(run.start,upper);if(y<=run.end&&y>start&&y<=start+hardMax){end=y;break;}}
    const forced=end===null&&totalHeight-start>hardMax;
    if(end===null)end=Math.min(totalHeight,start+hardMax);
    segments.push({start,end,forced,overlapBefore});
    overlapBefore=forced&&end<totalHeight?overlap:0;start=end-overlapBefore;
  }
  return segments;
}

const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
function check(signal){if(signal.aborted)throw new DOMException('Đã dừng','AbortError');}
async function image(url){const img=new Image();img.src=url;await img.decode();return img;}
async function png(canvas){const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('Không đủ bộ nhớ để tạo đoạn ảnh.');return blob;}

export async function reflowWebtoon(pages,options,{signal,onProgress=()=>{}}) {
  if(pages.length<2)throw new Error('Cần ít nhất hai ảnh để ghép webtoon.');
  const width=pages[0].width;
  if(pages.some(p=>p.width!==width))throw new Error('Các ảnh cần có cùng chiều rộng để ghép không méo hình. Hãy tách ảnh bìa/ảnh khác chiều rộng thành dự án riêng trước.');
  const sourceBytes=pages.reduce((n,p)=>n+p.blob.size,0);
  const sources=[];let totalHeight=0;
  for(const page of pages){sources.push({name:page.name,start:totalHeight,end:totalHeight+page.height,width,height:page.height});totalHeight+=page.height;}
  const hardMax=Math.min(12000,Math.floor(LIMITS.pixels/width));
  if(hardMax<400)throw new Error('Ảnh quá rộng để ghép an toàn.');
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=256;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  const runs=[];let currentKind=0,runStart=0,globalY=0;
  const output=[];
  try{
    for(const [index,page]of pages.entries()){
      check(signal);const original=await image(page.url);
      for(let y=0;y<page.height;y+=256){
        check(signal);const height=Math.min(256,page.height-y);
        ctx.clearRect(0,0,width,256);ctx.drawImage(original,0,y,width,height,0,0,width,height);
        for(const kind of flatRows(ctx.getImageData(0,0,width,height))){
          if(kind!==currentKind){if(currentKind)runs.push({start:runStart,end:globalY,kind:currentKind});currentKind=kind;runStart=globalY;}globalY++;
        }
        onProgress(`Đang tìm khoảng trống · ảnh ${index+1}/${pages.length}`,globalY/totalHeight*45);await tick();
      }
    }
    if(currentKind)runs.push({start:runStart,end:globalY,kind:currentKind});
    const segments=planCuts(totalHeight,runs,{...options,hardMax,overlap:Math.min(600,Math.max(256,Math.round(width*.6)))});
    let retainedBytes=sourceBytes,loadedIndex=-1,original=null;
    for(const [index,segment]of segments.entries()){
      check(signal);onProgress(`Đang tạo đoạn ${index+1}/${segments.length}`,45+index/segments.length*55);
      canvas.width=width;canvas.height=segment.end-segment.start;
      for(let i=0;i<sources.length;i++){
        const source=sources[i],from=Math.max(segment.start,source.start),to=Math.min(segment.end,source.end);
        if(to<=from)continue;
        if(loadedIndex!==i){original=await image(pages[i].url);loadedIndex=i;}
        check(signal);ctx.drawImage(original,0,from-source.start,width,to-from,0,from-segment.start,width,to-from);
      }
      const blob=await png(canvas);check(signal);
      if(blob.size>LIMITS.fileBytes)throw new Error('Một đoạn PNG vượt 30 MB. Hãy chọn chiều cao đoạn nhỏ hơn.');
      retainedBytes+=blob.size;
      if(retainedBytes>LIMITS.totalBytes)throw new Error('Ảnh gốc và ảnh mới vượt tổng 250 MB. Hãy xử lý ít ảnh hơn trong một dự án.');
      const thumb=document.createElement('canvas'),ratio=Math.min(1,160/width,200/canvas.height);thumb.width=Math.max(1,Math.round(width*ratio));thumb.height=Math.max(1,Math.round(canvas.height*ratio));thumb.getContext('2d').drawImage(canvas,0,0,thumb.width,thumb.height);
      output.push({id:crypto.randomUUID(),name:`webtoon-${String(index+1).padStart(4,'0')}${segment.forced||segment.overlapBefore?'-can-kiem-tra':''}.png`,blob,url:URL.createObjectURL(blob),width,height:canvas.height,thumb:thumb.toDataURL('image/jpeg',.7),boxes:[]});
      thumb.width=1;thumb.height=1;await tick();
    }
    check(signal);return {pages:output,layout:{version:1,width,totalHeight,sources,segments,target:options.target,minGap:options.minGap},forcedCount:segments.filter(s=>s.forced).length};
  }catch(error){output.forEach(p=>URL.revokeObjectURL(p.url));throw error;}
  finally{canvas.width=1;canvas.height=1;}
}
