let ready;
async function loadCV(){
  if(!ready)ready=(async()=>{importScripts(new URL('./inpaint/opencv.js',self.location.href).href);let cv=self.cv;if(cv instanceof Promise)cv=await cv;else if(!cv.Mat)await new Promise(resolve=>{cv.onRuntimeInitialized=resolve;});if(typeof cv.inpaint!=='function')throw new Error('Bản OpenCV không có chức năng inpaint.');return {cv};})();
  return ready;
}
self.onmessage=async({data:{width,height,pixels,mask,radius=3}})=>{
  let src,rgb,m,dst,rgba;
  try{
    if(width*height>2_000_000||pixels.byteLength!==width*height*4||mask.byteLength!==width*height)throw new Error('Vùng phục hồi quá lớn hoặc không hợp lệ (tối đa 2 triệu pixel).');
    const {cv}=await loadCV();
    src=cv.matFromArray(height,width,cv.CV_8UC4,new Uint8Array(pixels));rgb=new cv.Mat();cv.cvtColor(src,rgb,cv.COLOR_RGBA2RGB);
    m=cv.matFromArray(height,width,cv.CV_8UC1,new Uint8Array(mask));dst=new cv.Mat();cv.inpaint(rgb,m,dst,Math.max(1,Math.min(9,radius)),cv.INPAINT_TELEA);
    rgba=new cv.Mat();cv.cvtColor(dst,rgba,cv.COLOR_RGB2RGBA);const output=new Uint8Array(pixels).slice(),selected=new Uint8Array(mask);
    for(let i=0;i<selected.length;i++)if(selected[i])for(let c=0;c<3;c++)output[i*4+c]=rgba.data[i*4+c];
    self.postMessage({pixels:output.buffer},[output.buffer]);
  }catch(error){self.postMessage({error:error.message||String(error)});}
  finally{for(const mat of [src,rgb,m,dst,rgba])mat?.delete();}
};
