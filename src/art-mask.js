export function suggestMask({width,height,data},{polarity='light',threshold=210,dilation=2}={}) {
  const size=width*height,selected=new Uint8Array(size),seen=new Uint8Array(size),queue=new Int32Array(size),mask=new Uint8Array(size);
  for(let i=0;i<size;i++){
    const r=data[i*4],g=data[i*4+1],b=data[i*4+2],gray=(r+g+b)/3;
    selected[i]=polarity==='light'?Number(gray>=threshold&&Math.max(r,g,b)-Math.min(r,g,b)<70):Number(gray<=255-threshold);
  }
  for(let start=0;start<size;start++){
    if(seen[start]||!selected[start])continue;
    let head=0,tail=0,x0=width,y0=height,x1=0,y1=0;
    seen[start]=1;queue[tail++]=start;
    while(head<tail){
      const i=queue[head++],x=i%width,y=Math.floor(i/width);x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if((dx||dy)&&x+dx>=0&&x+dx<width&&y+dy>=0&&y+dy<height){const n=i+dy*width+dx;if(!seen[n]&&selected[n]){seen[n]=1;queue[tail++]=n;}}
    }
    const w=x1-x0+1,h=y1-y0+1;
    if(tail<3||h<4||w*h>size*.4||w>width*.95||h>height*.95)continue;
    for(let i=0;i<tail;i++)mask[queue[i]]=255;
    // Fill the black cores enclosed by bright text outlines as well.
    const local=new Uint8Array(w*h),fill=new Int32Array(w*h);let fhead=0,ftail=0;
    const enter=i=>{const x=i%w,y=Math.floor(i/w),global=(y+y0)*width+x+x0;if(!local[i]&&!selected[global]){local[i]=1;fill[ftail++]=i;}};
    for(let x=0;x<w;x++){enter(x);enter((h-1)*w+x);}for(let y=0;y<h;y++){enter(y*w);enter(y*w+w-1);}
    while(fhead<ftail){const i=fill[fhead++],x=i%w,y=Math.floor(i/w);for(const n of [x?i-1:-1,x<w-1?i+1:-1,y?i-w:-1,y<h-1?i+w:-1])if(n>=0)enter(n);}
    for(let i=0;i<w*h;i++)if(!local[i])mask[(Math.floor(i/w)+y0)*width+i%w+x0]=255;
  }
  return dilateMask(mask,width,height,dilation);
}

export function dilateMask(mask,width,height,radius) {
  const out=mask.slice();radius=Math.max(0,Math.min(8,Math.round(radius)));
  if(!radius)return out;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(mask[y*width+x])for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++)if(dx*dx+dy*dy<=radius*radius&&x+dx>=0&&x+dx<width&&y+dy>=0&&y+dy<height)out[(y+dy)*width+x+dx]=255;
  return out;
}

export function maskedOCRInput(original,mask,{ink='dark'}={}) {
  const {width,height,data}=original,out=new Uint8ClampedArray(data.length);out.fill(255);
  let min=255,max=0;
  for(let i=0;i<mask.length;i++)if(mask[i]){const value=(data[i*4]+data[i*4+1]+data[i*4+2])/3;min=Math.min(min,value);max=Math.max(max,value);}
  const threshold=ink==='light'?Math.max(160,max-32):Math.min(96,min+32);
  for(let i=0;i<mask.length;i++)if(mask[i]){const value=(data[i*4]+data[i*4+1]+data[i*4+2])/3;if(ink==='light'?value>=threshold:value<=threshold)out[i*4]=out[i*4+1]=out[i*4+2]=0;}
  return {width,height,data:out};
}

// Conservative dark-ink selection: edge-connected contours and long lines are protected.
export function speechTextMask({width,height,data},{threshold=180,dilation=1}={}) {
  const size=width*height,seen=new Uint8Array(size),queue=new Int32Array(size),mask=new Uint8Array(size),protectedInk=new Uint8Array(size);
  const dark=i=>(data[i*4]+data[i*4+1]+data[i*4+2])/3<threshold;
  for(let start=0;start<size;start++){
    if(seen[start]||!dark(start))continue;
    let head=0,tail=1,x0=width,y0=height,x1=0,y1=0,edge=false;queue[0]=start;seen[start]=1;
    while(head<tail){const i=queue[head++],x=i%width,y=Math.floor(i/width);x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);if(x===0||y===0||x===width-1||y===height-1)edge=true;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if((dx||dy)&&x+dx>=0&&x+dx<width&&y+dy>=0&&y+dy<height){const n=i+dy*width+dx;if(!seen[n]&&dark(n)){seen[n]=1;queue[tail++]=n;}}
    }
    const w=x1-x0+1,h=y1-y0+1;
    const border=edge||w>width*.8||h>height*.65||w>h*12||h>w*12;
    for(let j=0;j<tail;j++)if(border)protectedInk[queue[j]]=255;else if(tail>=2)mask[queue[j]]=255;
  }
  const expanded=dilateMask(mask,width,height,dilation),guard=dilateMask(protectedInk,width,height,1);
  for(let i=0;i<size;i++)if(guard[i])expanded[i]=0;
  return expanded;
}
export function clearSpeechInk(original,mask){
  const data=original.data.slice();
  for(let i=0;i<mask.length;i++)if(mask[i])data[i*4]=data[i*4+1]=data[i*4+2]=255;
  return {width:original.width,height:original.height,data};
}
