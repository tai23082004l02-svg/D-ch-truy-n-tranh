// This function is serialized by chrome.scripting. Keep it self-contained:
// inspect the normal reader DOM only; no framework internals or chapter APIs.
export async function inspectReader(options={}) {
  const key=location.origin+location.pathname;
  if(options.sourceKey&&key!==options.sourceKey)return {error:'Tab nguồn đã đổi chương. Quét lại trước khi tiếp tục.'};
  if(options.scrollToPage){
    const node=[...document.querySelectorAll('.rpage-page[data-page]')].find(n=>Number(n.dataset.page)===options.scrollToPage);
    if(!node)return {error:`Không tìm thấy trang ${options.scrollToPage}. Hãy dùng chế độ cuộn dọc.`};
    node.scrollIntoView({behavior:'instant',block:'center'});
    for(let attempt=0;attempt<40;attempt++){
      await new Promise(resolve=>setTimeout(resolve,125));
      if(location.origin+location.pathname!==key)return {error:'Tab nguồn đã đổi chương trong lúc tải.'};
      const image=node.querySelector('img.rpage-page__img');
      if(image?.complete&&image.naturalWidth>0)break;
    }
  }
  const rows=[...document.querySelectorAll('.rpage-page[data-page]')];
  const pages=rows.map(node=>{
    const img=node.querySelector('img.rpage-page__img');
    const raw=img?.currentSrc||img?.getAttribute('src')||img?.getAttribute('data-src')||'';
    let url='';try{const parsed=new URL(raw,location.href);if(raw&&parsed.protocol==='https:')url=parsed.href;}catch{}
    return {page:Number(node.dataset.page),url,width:img?.naturalWidth||Number(img?.getAttribute('width'))||0,height:img?.naturalHeight||Number(img?.getAttribute('height'))||0,loaded:!!img?.complete&&img.naturalWidth>0};
  }).filter(row=>Number.isInteger(row.page)&&row.page>0).sort((a,b)=>a.page-b.page);
  return {title:document.title,url:location.href,sourceKey:key,pages,scrollY:window.scrollY,vertical:!!document.querySelector('.rpage.rpage--ttb'),expectedPages:document.querySelectorAll('.rpage-progress__seg').length||pages.length};
}

export function restoreScroll(y,sourceKey) {
  if(location.origin+location.pathname===sourceKey)window.scrollTo({top:y,behavior:'instant'});
}

export function safeFilename(value) {
  const name=String(value).normalize('NFKC').replace(/[\u0000-\u001f<>:"/\\|?*]/g,'-').replace(/[. ]+$/g,'').replace(/\s+/g,' ').trim().slice(0,90)||'chuong-truyen-raw';
  return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)?'chapter-'+name:name;
}

export function validatePages(rows) {
  if(!Array.isArray(rows)||!rows.length)throw new Error('Chưa thấy ảnh chương. Mở một chương đọc truyện, chuyển sang cuộn dọc rồi bấm biểu tượng tiện ích lại. Trang giới thiệu/bìa truyện chưa có ảnh chương.');
  if(rows.length>100)throw new Error('Chương có hơn 100 trang; bản này hỗ trợ tối đa 100 ảnh để phù hợp xưởng dịch.');
  const seen=new Set();
  for(const row of rows){
    if(!Number.isInteger(row.page)||row.page<1||seen.has(row.page))throw new Error('Số trang không hợp lệ hoặc trùng lặp.');seen.add(row.page);
    if(row.url){const url=new URL(row.url);if(url.protocol!=='https:'||url.username||url.password)throw new Error('URL ảnh không hợp lệ.');}
  }
  const sorted=[...rows].sort((a,b)=>a.page-b.page);
  if(sorted[0].page!==1||sorted.some((r,i)=>r.page!==i+1))throw new Error('Các trang đang hiển thị không liên tục từ trang 1. Hãy chuyển Comix sang chế độ cuộn dọc rồi quét lại.');
  return sorted;
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
