import {suggestMask,maskedOCRInput} from './art-mask.js';

export function artBounds(box,image){const x=Math.floor(box.x),y=Math.floor(box.y);return {x,y,w:Math.min(image.width,Math.ceil(box.x+box.w))-x,h:Math.min(image.height,Math.ceil(box.y+box.h))-y};}
function cropOriginal(image,bounds){const canvas=document.createElement('canvas');canvas.width=bounds.w;canvas.height=bounds.h;canvas.getContext('2d').drawImage(image,bounds.x,bounds.y,bounds.w,bounds.h,0,0,bounds.w,bounds.h);return canvas;}
export function artOCRCanvas(image,box){
  const bounds=artBounds(box,image),crop=cropOriginal(image,bounds),ctx=crop.getContext('2d'),data=ctx.getImageData(0,0,bounds.w,bounds.h);
  const patch=box.artPatch,mask=patch&&patch.x===bounds.x&&patch.y===bounds.y&&patch.w===bounds.w&&patch.h===bounds.h?patch.mask:suggestMask(data,{dilation:1});
  const binary=maskedOCRInput(data,mask,{ink:box.ocrInk||'dark'});ctx.putImageData(new ImageData(binary.data,bounds.w,bounds.h),0,0);
  const out=document.createElement('canvas'),scale=Math.min(2,1800/Math.max(bounds.w,bounds.h));out.width=Math.max(1,Math.round(bounds.w*scale));out.height=Math.max(1,Math.round(bounds.h*scale));out.getContext('2d').drawImage(crop,0,0,out.width,out.height);crop.width=1;crop.height=1;return out;
}
async function blob(canvas){const value=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!value)throw new Error('Không tạo được ảnh nền.');return value;}

export function createArtEditor({getBox,getImage,runTask,cancelTask,onApply}) {
  const $=id=>document.getElementById(id),dialog=$('art-dialog'),maskCanvas=$('art-mask-canvas'),preview=$('art-preview-canvas');
  let original=null,mask=null,bounds=null,ready=false,painting=false,last=null,worker=null,boxId=null,locked=false;
  let maskHistory=[];
  const rememberMask=()=>{maskHistory.push(mask.slice());if(maskHistory.length>30)maskHistory.shift();};
  function undoMask(){if(worker||locked||painting||!maskHistory.length)return;mask=maskHistory.pop();invalidate();render();info('Đã hoàn tác chỉnh sửa mặt nạ. Bấm Xem nền phục hồi để cập nhật bản xem trước.');}
  $('art-mask-undo').onclick=undoMask;
  dialog.addEventListener('keydown',event=>{
    if((event.ctrlKey||event.metaKey)&&!event.shiftKey&&!event.altKey&&event.key.toLowerCase()==='z'&&!event.isComposing&&!event.target.closest('input,textarea')){event.preventDefault();event.stopPropagation();undoMask();}
  });
  const info=(message,error=false)=>{$('art-status').textContent=message;$('art-status').classList.toggle('error',error);};
  const invalidate=()=>{ready=false;$('art-apply').disabled=true;};
  function render(){
    $('art-mask-undo').disabled=worker||locked||!maskHistory.length;
    if(!original)return;
    const ctx=maskCanvas.getContext('2d');ctx.drawImage(original,0,0);const overlay=ctx.createImageData(bounds.w,bounds.h);let count=0;
    for(let i=0;i<mask.length;i++)if(mask[i]){overlay.data[i*4]=230;overlay.data[i*4+1]=55;overlay.data[i*4+2]=45;overlay.data[i*4+3]=130;count++;}
    const layer=document.createElement('canvas');layer.width=bounds.w;layer.height=bounds.h;layer.getContext('2d').putImageData(overlay,0,0);ctx.drawImage(layer,0,0);layer.width=1;layer.height=1;
    $('art-mask-count').textContent=`Mặt nạ: ${(count/mask.length*100).toFixed(1)}% vùng ảnh. Chỉ phần đỏ được phục hồi.`;
  }
  function position(event){const r=maskCanvas.getBoundingClientRect();return {x:(event.clientX-r.left)*bounds.w/r.width,y:(event.clientY-r.top)*bounds.h/r.height};}
  function dab(point){const radius=Math.max(1,Number($('art-brush').value)/2),value=$('art-brush-mode').value==='erase'?0:255;for(let y=Math.max(0,Math.floor(point.y-radius));y<Math.min(bounds.h,point.y+radius);y++)for(let x=Math.max(0,Math.floor(point.x-radius));x<Math.min(bounds.w,point.x+radius);x++)if((x-point.x)**2+(y-point.y)**2<=radius**2)mask[y*bounds.w+x]=value;}
  function paint(point){const distance=last?Math.hypot(point.x-last.x,point.y-last.y):0,steps=Math.max(1,Math.ceil(distance/Math.max(1,Number($('art-brush').value)/4)));for(let i=1;i<=steps;i++)dab(last?{x:last.x+(point.x-last.x)*i/steps,y:last.y+(point.y-last.y)*i/steps}:point);last=point;invalidate();render();}
  maskCanvas.onpointerdown=e=>{if(worker||locked||e.button!==0)return;rememberMask();painting=true;last=null;maskCanvas.setPointerCapture(e.pointerId);paint(position(e));};
  maskCanvas.onpointermove=e=>{if(painting)paint(position(e));};
  maskCanvas.onpointerup=maskCanvas.onpointercancel=()=>{painting=false;last=null;};
  $('art-suggest').onclick=()=>{if(worker||locked||!original)return;rememberMask();mask=suggestMask(original.getContext('2d').getImageData(0,0,bounds.w,bounds.h),{polarity:$('art-polarity').value,threshold:Number($('art-threshold').value),dilation:Number($('art-dilation').value)});invalidate();render();info('Mặt nạ gợi ý có thể dính nét vẽ. Dùng cọ thêm/xóa để chỉ giữ chữ và viền chữ, rồi xem nền phục hồi.');};
  $('art-clear-mask').onclick=()=>{if(worker||locked)return;rememberMask();mask.fill(0);invalidate();render();};
  $('art-cancel-worker').onclick=cancelTask;
  $('art-preview-button').onclick=()=>runTask('Đang phục hồi nền cục bộ…',async signal=>{
    if(!mask?.some(v=>v)){info('Hãy tạo mặt nạ hoặc tô đỏ các nét chữ cần xóa.',true);throw new Error('Chưa có mặt nạ.');}
    const count=mask.reduce((n,v)=>n+Number(v>0),0);if(count/mask.length>.65){info('Mặt nạ phủ quá 65% vùng ảnh. Chỉ tô nét chữ để giữ đủ nền tham chiếu.',true);throw new Error('Mặt nạ quá rộng.');}
    locked=true;
    $('art-preview-button').disabled=true;$('art-cancel-worker').hidden=false;invalidate();info('Đang tải OpenCV cục bộ và phục hồi vùng đỏ…');
    const pixels=original.getContext('2d').getImageData(0,0,bounds.w,bounds.h).data.slice(),copy=mask.slice();
    try{
      worker=new Worker(new URL('./assets/inpaint-worker.js',document.baseURI));
      const result=await new Promise((resolve,reject)=>{
        let timeout;
        const finish=(error,value)=>{clearTimeout(timeout);signal.removeEventListener('abort',abort);error?reject(error):resolve(value);};
        const abort=()=>finish(new DOMException('Đã dừng','AbortError'));
        signal.addEventListener('abort',abort,{once:true});
        timeout=setTimeout(()=>finish(new Error('Phục hồi nền quá thời gian. Thử vùng nhỏ hơn.')),90000);
        worker.onerror=e=>finish(new Error(e.message||'Không tải được bộ phục hồi nền.'));
        worker.onmessage=({data})=>data.error?finish(new Error(data.error)):finish(null,data.pixels);
        worker.postMessage({width:bounds.w,height:bounds.h,pixels:pixels.buffer,mask:copy.buffer,radius:Number($('art-radius').value)},[pixels.buffer,copy.buffer]);
      });
      preview.width=bounds.w;preview.height=bounds.h;preview.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(result),bounds.w,bounds.h),0,0);
      ready=true;$('art-apply').disabled=false;info('Xem kỹ nền bên phải trước khi áp dụng. Đây là thuật toán Telea, không phải AI vẽ lại nét tranh; vùng nhiều chi tiết có thể bị nhòe.');
    }catch(error){info(error.name==='AbortError'?'Đã dừng, ảnh đang làm chưa thay đổi.':error.message,true);throw error;}
    finally{worker?.terminate();worker=null;locked=false;$('art-preview-button').disabled=false;$('art-cancel-worker').hidden=true;}
  });
  $('art-apply').onclick=()=>runTask('Đang lưu nền phục hồi…',async signal=>{
    if(!ready||getBox()?.id!==boxId)return;
    locked=true;
    try{
    const patchBlob=await blob(preview),maskPNG=document.createElement('canvas');maskPNG.width=bounds.w;maskPNG.height=bounds.h;
    const data=maskPNG.getContext('2d').createImageData(bounds.w,bounds.h);for(let i=0;i<mask.length;i++){data.data[i*4]=data.data[i*4+1]=data.data[i*4+2]=mask[i];data.data[i*4+3]=255;}maskPNG.getContext('2d').putImageData(data,0,0);
    const maskBlob=await blob(maskPNG),canvas=document.createElement('canvas');canvas.width=bounds.w;canvas.height=bounds.h;canvas.getContext('2d').drawImage(preview,0,0);maskPNG.width=1;maskPNG.height=1;
    if(signal.aborted){canvas.width=1;throw new DOMException('Đã dừng','AbortError');}
    await onApply({...bounds,blob:patchBlob,maskBlob,mask:mask.slice(),canvas});dialog.close();
    }catch(error){info(error.message,true);throw error;}finally{locked=false;}
  });
  $('art-close').onclick=()=>{if(worker||locked){cancelTask();return;}dialog.close();};
  dialog.addEventListener('cancel',event=>{if(worker||locked){event.preventDefault();cancelTask();}});
  dialog.addEventListener('close',()=>{original=null;mask=null;maskHistory=[];ready=false;maskCanvas.width=1;preview.width=1;});
  return {open(){
    const box=getBox(),img=getImage();if(!box||!img)return;bounds=artBounds(box,img);
    if(bounds.w*bounds.h>2_000_000)throw new Error('Khoanh vùng chữ nhỏ hơn (tối đa 2 triệu pixel) để phục hồi nền.');
    maskHistory=[];boxId=box.id;original=cropOriginal(img,bounds);mask=new Uint8Array(bounds.w*bounds.h);
    const old=box.artPatch;if(old&&old.x===bounds.x&&old.y===bounds.y&&old.w===bounds.w&&old.h===bounds.h)mask=old.mask.slice();
    maskCanvas.width=preview.width=bounds.w;maskCanvas.height=preview.height=bounds.h;preview.getContext('2d').drawImage(original,0,0);invalidate();render();info('Tạo mặt nạ gợi ý cho chữ sáng/viền trắng hoặc tô cọ lên chữ. Đừng tô cả khung hình.');dialog.showModal();
  }};
}
