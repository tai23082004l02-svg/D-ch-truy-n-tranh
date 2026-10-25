import JSZip from 'jszip';
import {inspectReader,restoreScroll,safeFilename,validatePages,readImage,imageExtension,blobReaderRows} from './source.js';

const $=id=>document.getElementById(id);
const sourceTab=Number(new URL(location.href).searchParams.get('tab'));
const state={snapshot:null,rows:[],selected:new Set(),cache:new Map(),busy:false,controller:null,jobKey:null,completed:new Set(),parts:0,ruleId:null,pagerTab:null};
const downloads=new Map();
const message=(text,error=false)=>{$('status').textContent=text;$('status').classList.toggle('bad',error);};
const selectedRows=()=>state.rows.filter(row=>state.selected.has(row.page)&&row.url);
const localRow=row=>row.kind==='reader-page'||row.kind==='blob-current';
function update(){
  const count=selectedRows().length,hosts=[...new Set(selectedRows().filter(row=>!localRow(row)).map(row=>new URL(row.url).hostname))];
  $('download').disabled=state.busy||!count;$('export-links').disabled=state.busy||!count;
  $('scan').disabled=state.busy;$('load-pages').disabled=state.busy||!state.snapshot||state.snapshot.blobReader;
  $('load-pages').hidden=!!state.snapshot?.blobReader;$('blob-reader-note').hidden=!state.snapshot?.blobReader;
  $('load-pages').textContent=state.snapshot?.blobReader?'Ảnh blob: lấy lần lượt khi bấm Tải ZIP':'Cuộn tải toàn bộ chương';
  $('select-all').disabled=state.busy||!state.rows.length;$('select-none').disabled=state.busy||!state.rows.length;
  $('zip-name').disabled=state.busy;$('stop').hidden=!state.busy;
  $('source-selector').disabled=state.busy;$('reader-referrer').disabled=state.busy;
  $('image-count').textContent=state.snapshot?.blobReader?`${state.rows.length} trang · ${state.rows.filter(row=>row.preview).length} ảnh đã đọc · đã chọn ${count}`:`${state.rows.filter(row=>row.url).length}/${state.rows.length} ảnh có URL · đã chọn ${count}`;
  $('hosts').textContent=hosts.length?`Chỉ xin quyền tải từ: ${hosts.join(', ')}.`:state.snapshot?.blobReader?'Đọc ảnh blob bên trong tab nguồn; không cần xin quyền máy chủ ảnh khác.':'Chọn ảnh để xem các máy chủ sẽ được tải.';
  for(const input of $('image-list').querySelectorAll('input'))input.disabled=state.busy||!state.rows.find(row=>row.page===Number(input.value))?.url;
}
function render(){
  $('image-list').replaceChildren();
  for(const row of state.rows){
    const label=document.createElement('label');label.className='image-card';
    const input=document.createElement('input');input.type='checkbox';input.value=row.page;input.checked=state.selected.has(row.page);input.disabled=!row.url;
    input.onchange=()=>{input.checked?state.selected.add(row.page):state.selected.delete(row.page);update();};
    const title=document.createElement('strong');title.textContent=` Trang ${String(row.page).padStart(3,'0')}`;label.append(input,title);
    if(row.preview||row.url&&!localRow(row)){const image=document.createElement('img');image.src=row.preview||row.url;image.referrerPolicy='no-referrer';image.loading='lazy';image.alt=`Xem trước trang ${row.page}`;label.append(image);}
    const caption=document.createElement('small');caption.textContent=localRow(row)?`${row.width||'?'} × ${row.height||'?'} · ${row.reencoded?'PNG từ ảnh hiển thị':state.completed.has(row.page)?'đã lưu ZIP':row.preview?'đã đọc ảnh blob':'sẽ đọc trong tab nguồn khi tải'}`:row.url?`${row.width||'?'} × ${row.height||'?'} · ${new URL(row.url).hostname}`:'Chưa tải ảnh — dùng Cuộn tải toàn bộ chương';label.append(caption);$('image-list').append(label);
  }
  update();
}
async function execute(func,args=[]){
  if(!Number.isInteger(sourceTab)||sourceTab<1)throw new Error('Hãy mở tiện ích bằng biểu tượng trên tab truyện Comix.');
  const tab=await chrome.tabs.get(sourceTab);
  if(!['comix.to','comic.naver.com','m.comic.naver.com','hentairead.com','www.hentairead.com'].includes(new URL(tab.url||'about:blank').hostname))throw new Error('Mở chương trên Comix, Naver Webtoon hoặc HentaiRead rồi bấm biểu tượng tiện ích.');
  const injection=chrome.scripting.executeScript({target:{tabId:sourceTab},func,args}),signal=state.controller?.signal;
  const results=await new Promise((resolve,reject)=>{
    const stop=()=>finish(new DOMException('Đã dừng','AbortError'));
    const finish=(error,value)=>{clearTimeout(timer);signal?.removeEventListener('abort',stop);error?reject(error):resolve(value);};
    const timer=setTimeout(()=>finish(new Error('Tab nguồn chưa phản hồi. Nếu đang Paused in debugger, tiếp tục hoặc đóng DevTools rồi thử lại.')),30000);
    signal?.addEventListener('abort',stop,{once:true});if(signal?.aborted){stop();return;}
    injection.then(value=>finish(null,value),finish);
  });
  if(results[0]?.result?.error)throw new Error(results[0].result.error);
  if(!results[0]?.result)throw new Error('Không đọc được tab nguồn. Mở lại tiện ích trên tab chương truyện.');
  return results[0].result;
}
function acceptSnapshot(snapshot,keepSelection=false,paint=true){
  const same=state.snapshot?.sourceKey===snapshot.sourceKey;
  const rows=snapshot.blobReader?blobReaderRows(snapshot,same?state.rows:[]):validatePages(snapshot.pages);
  if(!snapshot.vertical)throw new Error('Hãy chuyển Comix sang chế độ đọc cuộn dọc (Top to bottom), rồi quét lại.');
  if(!snapshot.blobReader&&snapshot.expectedPages!==rows.length)throw new Error(`Trang báo ${snapshot.expectedPages} ảnh nhưng chỉ có ${rows.length} vùng ảnh. Chuyển sang cuộn dọc hoặc đợi chương tải xong rồi thử lại.`);
  if(!same){state.cache.clear();state.jobKey=null;state.completed.clear();state.parts=0;}
  state.snapshot=snapshot;state.rows=rows;
  if(!keepSelection||!same)state.selected=new Set(rows.filter(row=>row.url).map(row=>row.page));
  else for(const row of rows)if(row.url)state.selected.add(row.page);
  $('chapter-title').textContent=snapshot.title;$('source-url').textContent=snapshot.url;
  if(!same)$('zip-name').value=safeFilename(snapshot.title)+'-raw';if(paint)render();
}
async function scan(signal){
  const snapshot=await execute(inspectReader,[{selector:$('source-selector').value}]);acceptSnapshot(snapshot);
  if(snapshot.blobReader){
    const current=snapshot.pagination?.current||snapshot.pages.find(p=>p.url.startsWith('blob:'))?.page,row=state.rows.find(p=>p.page===current);
    if(row&&!state.cache.has(row.url)){try{state.cache.set(row.url,await captureBlobRow(row,signal));}catch(error){if(signal.aborted)throw error;message(`Đã nhận ảnh blob nhưng chưa tạo được xem trước: ${error.message}. Có thể thử tải lại.`,true);return;}}
    message(snapshot.pagination?`Đã nhận trình đọc ảnh blob: trang ${snapshot.pagination.current}/${snapshot.pagination.total}. Bấm Tải ảnh đã chọn thành ZIP để tự mở lần lượt các trang của cùng chương. Giữ tab nguồn mở và không tự đổi trang trong lúc tải.`:'Đã nhận ảnh blob của trang đang mở; chưa xác định chắc tổng chương nên chỉ lấy các ảnh hiện có.');return;
  }
  const missing=state.rows.filter(row=>!row.url).length;
  message(`Đã thấy ${state.rows.length} trang.${missing?` Còn ${missing} ảnh lazy-load chưa có URL; dùng Cuộn tải toàn bộ chương.`:' Kiểm tra thứ tự và chọn Tải ảnh đã chọn thành ZIP.'}${snapshot.provider==='hread'?` Bộ nhận diện thử nghiệm dùng CSS: ${snapshot.selector}. Số ảnh là phần hiện có trong trang, chưa xác nhận tổng chương; hãy dùng chế độ đọc liệt kê tất cả ảnh.`:''}`);
}
async function run(action){
  if(state.busy)return;state.busy=true;state.controller=new AbortController();update();
  try{await action(state.controller.signal);}catch(error){message(state.controller.signal.aborted?'Đã dừng. Có thể quét hoặc thử tải lại.':error.message||'Thao tác thất bại. Hãy mở lại tiện ích trên tab nguồn.',!state.controller.signal.aborted);}
  finally{if(state.ruleId!==null){await chrome.declarativeNetRequest.updateSessionRules({removeRuleIds:[state.ruleId]}).catch(()=>{});state.ruleId=null;}if(state.pagerTab){await chrome.tabs.update(state.pagerTab,{active:true}).catch(()=>{});state.pagerTab=null;}state.busy=false;state.controller=null;render();}
}
function aborted(signal){if(signal.aborted)throw new DOMException('Đã dừng','AbortError');}

async function captureBlobRow(row,signal){
  let snapshot=await execute(inspectReader,[{sourceKey:state.snapshot.sourceKey,selector:state.snapshot.selector}]);
  const available=value=>value.pages?.find(p=>p.page===row.page&&p.url.startsWith('blob:'));
  if(!available(snapshot)){
    if(row.kind!=='reader-page')throw new Error('Trang blob cần lấy không còn mở. Quét lại đúng trang nguồn trước khi tải.');
    const target=new URL(row.url),base=new URL(state.snapshot.pagination.base);
    if(target.origin!==base.origin||!target.pathname.startsWith(base.pathname))throw new Error('URL trang nằm ngoài chương đã chọn.');
    const own=await chrome.tabs.getCurrent();state.pagerTab=own?.id||null;
    await chrome.tabs.update(sourceTab,{url:target.href,active:true});
    const deadline=Date.now()+25000;
    while(Date.now()<deadline){
      aborted(signal);
      try{
        snapshot=await execute(inspectReader,[{sourceKey:state.snapshot.sourceKey,selector:state.snapshot.selector}]);
        if(snapshot.pagination?.total&&snapshot.pagination.total!==state.snapshot.pagination.total)throw new Error('Tổng số trang đã thay đổi. Quét lại chương trước khi tải tiếp.');
        if(available(snapshot))break;
      }catch(error){if(signal.aborted||error.message.includes('đổi chương')||error.message.includes('đã thay đổi'))throw error;}
      await new Promise(resolve=>setTimeout(resolve,250));
    }
    if(!available(snapshot))throw new Error('Ảnh trang này chưa sẵn sàng. Kiểm tra tab nguồn có đang tải hoặc hiện kiểm tra truy cập không, rồi thử lại.');
  }
  aborted(signal);const result=await execute(inspectReader,[{sourceKey:state.snapshot.sourceKey,readBlobPage:row.page}]);aborted(signal);
  if(typeof result.dataURL!=='string'||!/^data:[^,]*;base64,/.test(result.dataURL))throw new Error('Không nhận được dữ liệu ảnh blob.');
  const binary=atob(result.dataURL.slice(result.dataURL.indexOf(',')+1));if(binary.length>30*1024**2)throw new Error('Ảnh vượt 30 MB.');
  const bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  const extension=imageExtension(bytes),bitmap=await createImageBitmap(new Blob([bytes]));
  try{const canvas=document.createElement('canvas'),scale=Math.min(1,160/bitmap.width,200/bitmap.height);canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);row.preview=canvas.toDataURL('image/jpeg',.65);row.width=bitmap.width;row.height=bitmap.height;canvas.width=1;}finally{bitmap.close();}
  row.reencoded=!!result.reencoded;return {bytes,extension};
}
$('scan').onclick=()=>run(scan);
$('back').onclick=()=>chrome.tabs.update(sourceTab,{active:true}).catch(error=>message(error.message,true));
$('stop').onclick=()=>state.controller?.abort();
$('load-pages').onclick=()=>run(async signal=>{
  const original=state.snapshot;if(!original)return;
  const own=await chrome.tabs.getCurrent();
  await chrome.tabs.update(sourceTab,{active:true});
  try{
    for(let i=0;i<state.rows.length;i++){
      const row=state.rows[i];
      aborted(signal);message(`Đang tải lazy-load: trang ${i+1}/${state.rows.length}…`);
      const snapshot=await execute(inspectReader,[{sourceKey:original.sourceKey,scrollToPage:row.page,selector:original.selector}]);
      acceptSnapshot(snapshot,true,false);if((i+1)%25===0)render();
    }
    const missing=state.rows.filter(row=>!row.url||!row.loaded).length;
    message((missing?`Đã cuộn qua chương. Còn ${missing} ảnh chưa tải xong trên trang nguồn; kiểm tra trang đọc rồi quét lại.`:`Đã thu thập ${state.rows.length} URL ảnh. Kiểm tra danh sách trước khi xuất.`)+(state.snapshot.provider==='hread'?' HentaiRead: chỉ xác nhận các ảnh hiện có trong DOM; chưa biết tổng chương, hãy kiểm tra chế độ đọc tất cả ảnh.':''));
  }finally{
    render();
    await chrome.scripting.executeScript({target:{tabId:sourceTab},func:restoreScroll,args:[original.scrollY,original.sourceKey]}).catch(()=>{});
    if(own?.id)await chrome.tabs.update(own.id,{active:true}).catch(()=>{});
  }
});
$('select-all').onclick=()=>{state.selected=new Set(state.rows.filter(row=>row.url).map(row=>row.page));render();};
$('select-none').onclick=()=>{state.selected.clear();render();};

async function saveBlob(blob,name,signal=null){
  const url=URL.createObjectURL(blob);
  try{
    const id=await chrome.downloads.download({url,filename:name,saveAs:true});downloads.set(id,url);
    const [item]=await chrome.downloads.search({id});
    if(item&&item.state!=='in_progress'){URL.revokeObjectURL(url);downloads.delete(id);}
    if(signal){
      let latest=item;
      while(latest?.state==='in_progress'){aborted(signal);await new Promise(resolve=>setTimeout(resolve,200));[latest]=await chrome.downloads.search({id});}
      if(!latest||latest.state!=='complete')throw new Error('Tệp tải xuống chưa hoàn tất hoặc đã bị hủy. Hãy thử lại phần này.');
    }
  }catch(error){URL.revokeObjectURL(url);throw error;}
}
chrome.downloads.onChanged.addListener(delta=>{if(delta.state&&delta.state.current!=='in_progress'&&downloads.has(delta.id)){URL.revokeObjectURL(downloads.get(delta.id));downloads.delete(delta.id);}});
$('export-links').onclick=()=>run(async()=>{
  const json={source:state.snapshot.url,title:state.snapshot.title,pages:selectedRows().map(({page,url,kind})=>({page,url,kind:kind||'image'}))};
  await saveBlob(new Blob([JSON.stringify(json,null,2)],{type:'application/json'}),safeFilename($('zip-name').value)+'-urls.json');message(state.snapshot.blobReader?'Đã xuất URL các trang đọc, không phải link ảnh blob dùng lại được. Bấm tải ZIP để lấy dữ liệu ảnh.':'Đã xuất danh sách URL. URL ảnh có thể hết hạn; đây chưa phải ZIP ảnh.');
});
$('download').onclick=()=>{
  if(state.busy)return;
  const rows=selectedRows();if(!rows.length)return;
  const remote=rows.filter(row=>!localRow(row)),origins=[...new Set(remote.map(row=>new URL(row.url).origin+'/*'))];
  // Request only the selected image hosts, directly from the user's click.
  const permission=origins.length?chrome.permissions.request({origins}):Promise.resolve(true);
  run(async signal=>{
    if(!await permission)throw new Error('Chưa được cấp quyền cho máy chủ ảnh. Không có ảnh nào được tải. Bạn có thể bấm tải lại hoặc xuất danh sách URL.');
    if(state.snapshot.provider==='naver'&&rows.some(row=>new URL(row.url).hostname==='image-comic.pstatic.net')){
      const own=await chrome.tabs.getCurrent();state.ruleId=10000+own.id;
      await chrome.declarativeNetRequest.updateSessionRules({removeRuleIds:[state.ruleId],addRules:[{id:state.ruleId,priority:1,action:{type:'modifyHeaders',requestHeaders:[{header:'Referer',operation:'set',value:'https://comic.naver.com/'}]},condition:{requestDomains:['image-comic.pstatic.net'],initiatorDomains:[chrome.runtime.id],resourceTypes:['xmlhttprequest'],requestMethods:['get']}}]});
    }else if(state.snapshot.provider==='hread'&&remote.length&&$('reader-referrer').checked){
      const own=await chrome.tabs.getCurrent();state.ruleId=10000+own.id;
      await chrome.declarativeNetRequest.updateSessionRules({removeRuleIds:[state.ruleId],addRules:[{id:state.ruleId,priority:1,action:{type:'modifyHeaders',requestHeaders:[{header:'Referer',operation:'set',value:new URL(state.snapshot.url).origin+'/'}]},condition:{requestDomains:[...new Set(remote.map(row=>new URL(row.url).hostname))],initiatorDomains:[chrome.runtime.id],resourceTypes:['xmlhttprequest'],requestMethods:['get']}}]});
    }
    const wanted=new Set(rows.map(row=>row.url));for(const key of state.cache.keys())if(!wanted.has(key))state.cache.delete(key);
    if(rows.length!==state.rows.length&&!confirm(`Chỉ xuất ${rows.length}/${state.rows.length} ảnh đã chọn. Bạn muốn tải một phần chương?`))return;
    // Ensure the reader still refers to this chapter; never mix different chapters.
    await execute(inspectReader,[{sourceKey:state.snapshot.sourceKey,selector:state.snapshot.selector}]);
    const base=safeFilename($('zip-name').value);
    const jobKey=JSON.stringify([state.snapshot.sourceKey,base,rows.map(row=>[row.page,row.url])]);
    if(state.jobKey!==jobKey){state.jobKey=jobKey;state.completed.clear();state.parts=0;}
    const pending=rows.filter(row=>!state.completed.has(row.page));
    if(!pending.length){message('Các ảnh đã chọn đã được lưu trong lần tải trước. Đổi tên ZIP nếu muốn tải lại từ đầu.');return;}
    if(pending.some(row=>row.kind==='reader-page')&&!confirm(`Tiện ích sẽ mở lần lượt ${pending.length} trang còn lại của cùng chương trong tab nguồn để đọc ảnh blob. Giữ tab mở, không tự đổi chương; có thể bấm Dừng. Tiếp tục?`))return;
    $('progress-bar').hidden=false;
    let batch=[],batchBytes=0,total=0;
    const flush=async()=>{
      if(!batch.length)return;
      aborted(signal);$('progress').textContent=`Đang đóng gói phần ${state.parts+1}: ${batch.length} ảnh…`;
      const zip=new JSZip();
      for(const row of batch){const image=state.cache.get(row.url);zip.file(`${String(row.page).padStart(3,'0')}.${image.extension}`,image.bytes);}
      const blob=await zip.generateAsync({type:'blob',compression:'STORE'});aborted(signal);
      const split=rows.length>100||state.parts>0||batch.length<pending.length;
      const filename=base+(split?`-part-${String(state.parts+1).padStart(3,'0')}`:'')+'.zip';
      await saveBlob(blob,filename,signal);
      for(const row of batch){state.completed.add(row.page);state.cache.delete(row.url);}
      state.parts++;batch=[];batchBytes=0;
      message(`Đã lưu ${state.parts} phần ZIP, ${state.completed.size}/${rows.length} ảnh. Đang tiếp tục…`);
    };
    for(const [i,row]of pending.entries()){
      aborted(signal);$('progress').textContent=`Đang tải ảnh ${state.completed.size+batch.length+1}/${rows.length}…`;$('progress-bar').value=(rows.length-pending.length+i)/rows.length*100;
      try{
        if(!state.cache.has(row.url)){
          let image;
          if(localRow(row))image=await captureBlobRow(row,signal);
          else{const response=await fetch(row.url,{credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.any([signal,AbortSignal.timeout(30000)])});image=await readImage(response,signal);}
          aborted(signal);state.cache.set(row.url,image);if(localRow(row)&&i%10===0)render();
        }
        const currentImage=state.cache.get(row.url),size=currentImage.bytes.length;
        if(batch.length&&batchBytes+size>100*1024**2)await flush();
        state.cache.set(row.url,currentImage);
        batch.push(row);batchBytes+=size;total+=size;
        if(batch.length===100)await flush();
      }catch(error){
        if(signal.aborted)throw error;
        $('progress').textContent=`Trang ${row.page}: ${error.message||'Lỗi mạng/CORS.'}`;
        throw new Error(`1 ảnh tải lỗi hoặc phần ZIP chưa lưu xong. Đã lưu ${state.parts} phần (${state.completed.size} ảnh); phần đang làm chưa được xuất. Bấm tải lại để tiếp tục, không tải lại các phần đã lưu.`);
      }
    }
    await flush();$('progress-bar').value=100;
    const recreated=rows.filter(row=>row.reencoded).length;
    $('progress').textContent=`Đã lưu ${state.parts} phần ZIP, đủ ${state.completed.size}/${rows.length} ảnh. Mỗi phần tối đa 100 ảnh hoặc 100 MB. ${recreated?`${recreated} ảnh blob hết hạn được xuất lại thành PNG theo ảnh đang hiển thị; không giữ định dạng nén gốc.`:'Giữ nguyên dữ liệu ảnh đọc được.'}`;
    message('Tải hoàn tất. Nhập từng phần ZIP vào Xưởng dịch để xử lý; có thể cộng thêm các phần trong giới hạn 250 MB của một dự án.');
  });
};
run(scan);
