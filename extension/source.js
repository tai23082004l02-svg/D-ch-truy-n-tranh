// This function is serialized by chrome.scripting. Keep it self-contained:
// inspect the normal reader DOM only; no framework internals or chapter APIs.
export async function inspectReader(options={}) {
  const naver=['comic.naver.com','m.comic.naver.com'].includes(location.hostname);
  const hread=['hentairead.com','www.hentairead.com'].includes(location.hostname);
  const keyOfLocation=()=>{const u=new URL(location.href);const query=hread?new URLSearchParams([...u.searchParams].filter(([k])=>['chapter','chapter_id','page','paged','id','p'].includes(k))).toString():'';return u.origin+(hread?u.pathname.replace(/\/p\/\d+\/?$/,'/').replace(/\/?$/,'/'):u.pathname)+(naver?'?titleId='+u.searchParams.get('titleId')+'&no='+u.searchParams.get('no'):query?'?'+query:'');};
  const key=keyOfLocation();
  if(options.sourceKey&&key!==options.sourceKey)return {error:'Tab nguồn đã đổi chương. Quét lại trước khi tiếp tục.'};
  if(options.readBlobPage!==undefined){
    if(!hread||!Number.isInteger(options.readBlobPage)||options.readBlobPage<1||options.readBlobPage>1000)return {error:'Số trang blob không hợp lệ.'};
    const img=[...document.querySelectorAll(`img.reading-image[data-page="${options.readBlobPage}"]`)].filter(node=>(node.currentSrc||node.src||'').startsWith('blob:'+location.origin+'/')).sort((a,b)=>b.naturalWidth*b.naturalHeight-a.naturalWidth*a.naturalHeight)[0],url=img?.currentSrc||img?.src||'';
    if(!img||!url.startsWith('blob:'+location.origin+'/'))return {error:'Ảnh blob của trang này chưa sẵn sàng hoặc đã đổi. Giữ tab nguồn mở và thử lại.'};
    try{
      let blob,reencoded=false;
      try{const response=await fetch(url,{signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error('Không đọc được ảnh blob.');blob=await response.blob();}
      catch(error){
        if(!img.complete||!img.naturalWidth||img.naturalWidth*img.naturalHeight>24_000_000)throw error;
        const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;canvas.getContext('2d').drawImage(img,0,0);
        blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));canvas.width=1;
        if(!blob)throw new Error('Ảnh blob đã hết hạn và không tạo được PNG từ ảnh hiển thị.');reencoded=true;
      }
      if(blob.size>30*1024**2)throw new Error('Ảnh vượt 30 MB.');
      const dataURL=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Không đọc được dữ liệu ảnh.'));reader.readAsDataURL(blob);});
      return {dataURL,page:options.readBlobPage,width:img.naturalWidth||img.width,height:img.naturalHeight||img.height,reencoded};
    }catch(error){return {error:error.message||'Ảnh blob không còn khả dụng.'};}
  }
  let selector='';
  if(hread){
    if(new URL(location.href).searchParams.get('style')==='paged'&&!document.querySelector('img.reading-image[data-page]'))return {error:'Trang đang ở chế độ từng ảnh chưa được nhận diện. Chuyển sang List / đọc cuộn trước khi lấy cả chương.'};
    const custom=typeof options.selector==='string'?options.selector.trim():'';
    if(custom.length>300||/^(?:img|body\s+img|html\s+img)$/i.test(custom))return {error:'Hãy dùng CSS chỉ rõ vùng ảnh truyện, ví dụ .reading-content img; không quét toàn bộ img của trang.'};
    const candidates=custom?[custom]:['img.reading-image[data-page]','.reading-content img.wp-manga-chapter-img','.reading-content .page-break img','#readerarea img','#chapter-content img','.reading-content img','#manga-reader img','#image-container img'];
    try{selector=candidates.find(value=>[...document.querySelectorAll(value)].some(n=>n.tagName==='IMG'))||custom;}catch{return {error:'CSS vùng ảnh không hợp lệ. Kiểm tra bộ chọn rồi quét lại.'};}
  }
  const nodes=()=>[...document.querySelectorAll(hread?(selector||'.reading-content img.wp-manga-chapter-img'):naver?'#comic_view_area img[id^="content_image_"], .wt_viewer img[id^="content_image_"], #sectionContWide img[id^="content_image_"]':'.rpage-page[data-page]')].filter(node=>!hread||(node.tagName==='IMG'&&!node.closest('header,footer,nav,.ads,.advertisement,.adsbygoogle,[data-ad-slot]')));
  const number=node=>hread?nodes().indexOf(node)+1:naver?Number(node.id.replace('content_image_',''))+1:Number(node.dataset.page);
  const imageOf=node=>naver||hread?node:node.querySelector('img.rpage-page__img');
  const sourceOf=img=>hread&&img?.classList.contains('reading-image')&&(img.currentSrc||img.src||'').startsWith('blob:')?(img.currentSrc||img.src):img?.getAttribute('data-lazy-src')||img?.getAttribute('data-cfsrc')||img?.getAttribute('data-original')||img?.getAttribute('data-src')||img?.getAttribute('data-url')||img?.currentSrc||img?.getAttribute('src')||'';
  if(options.scrollToPage){
    const current=nodes(),node=hread?current[options.scrollToPage-1]:current.find(n=>number(n)===options.scrollToPage);
    if(!node)return {error:`Không tìm thấy trang ${options.scrollToPage}. Hãy mở đúng tập và dùng chế độ cuộn dọc.`};
    node.scrollIntoView({behavior:'instant',block:'center'});
    for(let attempt=0;attempt<40;attempt++){
      await new Promise(resolve=>setTimeout(resolve,125));
      if(keyOfLocation()!==key)return {error:'Tab nguồn đã đổi chương trong lúc tải.'};
      const image=imageOf(node);let expected='';try{expected=new URL(sourceOf(image),location.href).href;}catch{}
      if(image?.complete&&image.naturalWidth>0&&(!hread||image.currentSrc===expected))break;
    }
  }
  const rows=nodes();
  let pages=rows.map((node,index)=>{
    const img=imageOf(node);
    const raw=sourceOf(img);
    let url='';try{const parsed=new URL(raw,location.href);if(raw&&(parsed.protocol==='https:'||(hread&&img?.classList.contains('reading-image')&&raw.startsWith('blob:'+location.origin+'/'))))url=parsed.href;}catch{}
    return {page:hread?(img?.matches('img.reading-image[data-page]')?Number(img.dataset.page):index+1):number(node),url,width:img?.naturalWidth||Number(img?.getAttribute('width'))||0,height:img?.naturalHeight||Number(img?.getAttribute('height'))||0,loaded:!!img?.complete&&img.naturalWidth>0&&(!hread||img.currentSrc===url)};
  }).filter(row=>Number.isInteger(row.page)&&row.page>0).sort((a,b)=>a.page-b.page);
  if(hread&&rows.some(node=>node.matches('img.reading-image[data-page]'))){const unique=new Map();for(const page of pages){const old=unique.get(page.page);if(!old||page.loaded&&!old.loaded||page.loaded===old.loaded&&page.width*page.height>old.width*old.height)unique.set(page.page,page);}pages=[...unique.values()];}
  const blobReader=hread&&pages.some(p=>p.url.startsWith('blob:'));let pagination=null;
  if(blobReader){
    const pathPage=Number(location.pathname.match(/\/p\/(\d+)\/?$/)?.[1]),current=pages.find(p=>p.page===pathPage)?.page||pages[0]?.page;
    const totals=new Set([...document.body.innerText.matchAll(/(?:^|\D)(\d{1,4})\s*\/\s*(\d{1,4})(?!\d)/g)].filter(m=>Number(m[1])===current&&Number(m[2])>=current&&Number(m[2])<=1000).map(m=>Number(m[2])));
    if(totals.size===1)pagination={current,total:[...totals][0],base:location.origin+location.pathname.replace(/\/p\/\d+\/?$/,'/').replace(/\/?$/,'/')};
  }
  return {title:document.title,url:location.href,sourceKey:key,provider:hread?'hread':naver?'naver':'comix',selector,pages,blobReader,pagination,scrollY:window.scrollY,vertical:naver||hread||!!document.querySelector('.rpage.rpage--ttb'),expectedPages:naver||hread?pages.length:document.querySelectorAll('.rpage-progress__seg').length||pages.length};
}

export function restoreScroll(y,sourceKey) {
  const u=new URL(location.href),naver=['comic.naver.com','m.comic.naver.com'].includes(u.hostname);
  const hread=['hentairead.com','www.hentairead.com'].includes(u.hostname),query=hread?new URLSearchParams([...u.searchParams].filter(([k])=>['chapter','chapter_id','page','paged','id','p'].includes(k))).toString():'';
  const key=u.origin+(hread?u.pathname.replace(/\/p\/\d+\/?$/,'/').replace(/\/?$/,'/'):u.pathname)+(naver?'?titleId='+u.searchParams.get('titleId')+'&no='+u.searchParams.get('no'):query?'?'+query:'');
  if(key===sourceKey)window.scrollTo({top:y,behavior:'instant'});
}

export function safeFilename(value) {
  const name=String(value).normalize('NFKC').replace(/[\u0000-\u001f<>:"/\\|?*]/g,'-').replace(/[. ]+$/g,'').replace(/\s+/g,' ').trim().slice(0,90)||'chuong-truyen-raw';
  return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)?'chapter-'+name:name;
}

export function validatePages(rows,{allowPartial=false,blobOrigin=null}={}) {
  if(!Array.isArray(rows)||!rows.length)throw new Error('Chưa thấy ảnh chương. Mở chương trên website được hỗ trợ, chuyển sang cuộn dọc rồi quét lại. Với HentaiRead có thể cần chỉ định CSS vùng ảnh. Trang chủ/bìa hoặc trang kiểm tra truy cập chưa có ảnh chương.');
  if(rows.length>1000)throw new Error('Chương vượt 1.000 ảnh. Bản này hỗ trợ tối đa 1.000 ảnh, chia ZIP theo từng phần.');
  const seen=new Set();
  for(const row of rows){
    if(!Number.isInteger(row.page)||row.page<1||seen.has(row.page))throw new Error('Số trang không hợp lệ hoặc trùng lặp.');seen.add(row.page);
    if(row.url){const url=new URL(row.url),blob=blobOrigin&&url.protocol==='blob:'&&row.url.startsWith('blob:'+blobOrigin+'/');if((url.protocol!=='https:'&&!blob)||url.username||url.password)throw new Error('URL ảnh không hợp lệ.');}
  }
  const sorted=[...rows].sort((a,b)=>a.page-b.page);
  if(!allowPartial&&(sorted[0].page!==1||sorted.some((r,i)=>r.page!==i+1)))throw new Error('Các trang đang hiển thị không liên tục từ trang 1. Hãy chuyển Comix sang chế độ cuộn dọc rồi quét lại.');
  return sorted;
}

export function blobReaderRows(snapshot,previous=[]) {
  const pages=validatePages(snapshot.pages,{allowPartial:true,blobOrigin:new URL(snapshot.url).origin}),old=new Map(previous.map(p=>[p.page,p]));
  if(snapshot.pagination){
    const {total,base}=snapshot.pagination;if(!Number.isInteger(total)||total<Math.max(...pages.map(p=>p.page))||total>1000||new URL(base).origin!==new URL(snapshot.url).origin)throw new Error('Thông tin phân trang không hợp lệ.');
    return Array.from({length:total},(_,i)=>{const page=i+1,found=pages.find(p=>p.page===page);return {page,url:new URL(`p/${page}/`,base).href,kind:'reader-page',width:found?.width||old.get(page)?.width||0,height:found?.height||old.get(page)?.height||0,preview:old.get(page)?.preview||'',reencoded:!!old.get(page)?.reencoded};});
  }
  return pages.filter(p=>p.url.startsWith('blob:')).map(p=>({...p,url:snapshot.url.split('#')[0]+'#image-'+p.page,kind:'blob-current',preview:old.get(p.page)?.preview||'',reencoded:!!old.get(p.page)?.reencoded}));
}

export function imageExtension(bytes) {
  const b=new Uint8Array(bytes);
  if(b.length>=8&&b[0]===137&&b[1]===80&&b[2]===78&&b[3]===71&&b[4]===13&&b[5]===10&&b[6]===26&&b[7]===10)return 'png';
  if(b.length>=3&&b[0]===255&&b[1]===216&&b[2]===255)return 'jpg';
  if(b.length>=12&&String.fromCharCode(...b.slice(0,4))==='RIFF'&&String.fromCharCode(...b.slice(8,12))==='WEBP')return 'webp';
  throw new Error('Máy chủ không trả ảnh PNG/JPG/WEBP hợp lệ (có thể là trang chặn truy cập).');
}

export async function readImage(response,signal) {
  if(!response.ok)throw new Error(`HTTP ${response.status}. Máy chủ từ chối hoặc ảnh không còn khả dụng.`);
  const limit=30*1024**2;
  if(Number(response.headers.get('Content-Length'))>limit)throw new Error('Ảnh vượt 30 MB.');
  if(!response.body)throw new Error('Không nhận được nội dung ảnh.');
  const reader=response.body.getReader(),parts=[];let total=0;
  try{
    while(true){if(signal.aborted)throw new DOMException('Đã dừng','AbortError');const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>limit)throw new Error('Ảnh vượt 30 MB.');parts.push(value);}
  }catch(error){await reader.cancel().catch(()=>{});throw error;}
  const bytes=new Uint8Array(total);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}
  return {bytes,extension:imageExtension(bytes)};
}
