const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export function boxHandles(b){return [['nw',b.x,b.y],['n',b.x+b.w/2,b.y],['ne',b.x+b.w,b.y],['e',b.x+b.w,b.y+b.h/2],['se',b.x+b.w,b.y+b.h],['s',b.x+b.w/2,b.y+b.h],['sw',b.x,b.y+b.h],['w',b.x,b.y+b.h/2]];}
export function handleAt(box,point,radius){return boxHandles(box).find(([,x,y])=>Math.abs(x-point.x)<=radius&&Math.abs(y-point.y)<=radius)?.[0]||null;}
export function transformBox(box,start,end,handle,width,height){
 const dx=end.x-start.x,dy=end.y-start.y;
 if(handle==='move')return {x:clamp(box.x+dx,0,width-box.w),y:clamp(box.y+dy,0,height-box.h),w:box.w,h:box.h};
 let left=box.x,right=box.x+box.w,top=box.y,bottom=box.y+box.h;
 if(handle.includes('w'))left=clamp(left+dx,0,right-12);
 if(handle.includes('e'))right=clamp(right+dx,left+12,width);
 if(handle.includes('n'))top=clamp(top+dy,0,bottom-12);
 if(handle.includes('s'))bottom=clamp(bottom+dy,top+12,height);
 return {x:left,y:top,w:right-left,h:bottom-top};
}
