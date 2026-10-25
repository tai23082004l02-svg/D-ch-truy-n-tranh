import JSZip from 'jszip';
import {inspectReader,restoreScroll,safeFilename,validatePages,readImage} from './source.js';

const $=id=>document.getElementById(id);
const sourceTab=Number(new URL(location.href).searchParams.get('tab'));
const state={snapshot:null,rows:[],selected:new Set(),cache:new Map(),busy:false,controller:null,jobKey:null,completed:new Set(),parts:0,ruleId:null};
const downloads=new Map();
const message=(text,error=false)=>{$('status').textContent=text;$('status').classList.toggle('bad',error);};
const selectedRows=()=>state.rows.filter(row=>state.selected.has(row.page)&&row.url);
function update(){
  const count=selectedRows().length,hosts=[...new Set(selectedRows().map(row=>new URL(row.url).hostname))];
  $('download').disabled=state.busy||!count;$('export-links').disabled=state.busy||!count;
  $('scan').disabled=state.busy;$('load-pages').disabled=state.busy||!state.snapshot;
  $('select-all').disabled=state.busy||!state.rows.length;$('select-none').disabled=state.busy||!state.rows.length;
  $('zip-name').disabled=state.busy;$('stop').hidden=!state.busy;
  $('image-count').textContent=`${state.rows.filter(row=>row.url).length}/${state.rows.length} ảnh có URL · đã chọn ${count}`;
  $('hosts').textContent=hosts.length?`Chỉ xin quyền tải từ: ${hosts.join(', ')}.`:'Chọn ảnh để xem các máy chủ sẽ được tải.';
  for(const input of $('image-list').querySelectorAll('input'))input.disabled=state.busy||!state.rows.find(row=>row.page===Number(input.value))?.url;
}
function render(){
  $('image-list').replaceChildren();
  for(const row of state.rows){
    const label=document.createElement('label');label.className='image-card';
    const input=document.createElement('input');input.type='checkbox';input.value=row.page;input.checked=state.selected.has(row.page);input.disabled=!row.url;
    input.onchange=()=>{input.checked?state.selected.add(row.page):state.selected.delete(row.page);update();};
    const title=document.createElement('strong');title.textContent=` Trang ${String(row.page).padStart(3,'0')}`;label.append(input,title);
    if(row.url){const image=document.createElement('img');image.src=row.url;image.referrerPolicy='no-referrer';image.loading='lazy';image.alt=`Xem trước trang ${row.page}`;label.append(image);}
    const caption=document.createElement('small');caption.textContent=row.url?`${row.width||'?'} × ${row.height||'?'} · ${new URL(row.url).hostname}`:'Chưa tải ảnh — dùng Cuộn tải toàn bộ chương';label.append(caption);$('image-list').append(label);
  }
  update();
}
async function execute(func,args=[]){
  if(!Number.isInteger(sourceTab)||sourceTab<1)throw new Error('Hãy mở tiện ích bằng biểu tượng trên tab truyện Comix.');
  const tab=await chrome.tabs.get(sourceTab);
  if(!['comix.to','comic.naver.com','m.comic.naver.com'].includes(new URL(tab.url||'about:blank').hostname))throw new Error('Mở một chương Comix hoặc tập Naver Webtoon miễn phí, rồi bấm biểu tượng tiện ích.');
  const results=await chrome.scripting.executeScript({target:{tabId:sourceTab},func,args});
  if(results[0]?.result?.error)throw new Error(results[0].result.error);
  if(!results[0]?.result)throw new Error('Không đọc được tab nguồn. Mở lại tiện ích trên tab chương truyện.');
  return results[0].result;
}
function acceptSnapshot(snapshot,keepSelection=false,paint=true){
  const rows=validatePages(snapshot.pages);
  if(!snapshot.vertical)throw new Error('Hãy chuyển Comix sang chế độ đọc cuộn dọc (Top to bottom), rồi quét lại.');
  if(snapshot.expectedPages!==rows.length)throw new Error(`Trang báo ${snapshot.expectedPages} ảnh nhưng chỉ có ${rows.length} vùng ảnh. Chuyển sang cuộn dọc hoặc đợi chương tải xong rồi thử lại.`);
  const same=state.snapshot?.sourceKey===snapshot.sourceKey;
  if(!same){state.cache.clear();state.jobKey=null;state.completed.clear();state.parts=0;}
  state.snapshot=snapshot;state.rows=rows;
  if(!keepSelection||!same)state.selected=new Set(rows.filter(row=>row.url).map(row=>row.page));
  else for(const row of rows)if(row.url)state.selected.add(row.page);
  $('chapter-title').textContent=snapshot.title;$('source-url').textContent=snapshot.url;
  if(!same)$('zip-name').value=safeFilename(snapshot.title)+'-raw';if(paint)render();
}
async function scan(){
  const snapshot=await execute(inspectReader);acceptSnapshot(snapshot);
  const missing=state.rows.filter(row=>!row.url).length;
  message(`Đã thấy ${state.rows.length} trang.${missing?` Còn ${missing} ảnh lazy-load chưa có URL; dùng Cuộn tải toàn bộ chương.`:' Kiểm tra thứ tự và chọn Tải ảnh đã chọn thành ZIP.'}`);
}
async function run(action){
  if(state.busy)return;state.busy=true;state.controller=new AbortController();update();
  try{await action(state.controller.signal);}catch(error){message(state.controller.signal.aborted?'Đã dừng. Có thể quét hoặc thử tải lại.':error.message||'Thao tác thất bại. Hãy mở lại tiện ích trên tab nguồn.',!state.controller.signal.aborted);}
  finally{if(state.ruleId!==null){await chrome.declarativeNetRequest.updateSessionRules({removeRuleIds:[state.ruleId]}).catch(()=>{});state.ruleId=null;}state.busy=false;state.controller=null;update();}
}
function aborted(signal){if(signal.aborted)throw new DOMException('Đã dừng','AbortError');}
$('scan').onclick=()=>run(scan);
$('back').onclick=()=>chrome.tabs.update(sourceTab,{active:true}).catch(error=>message(error.message,true));
$('stop').onclick=()=>state.controller?.abort();
$('load-pages').onclick=()=>run(async signal=>{
  const original=state.snapshot;if(!original)return;
  const own=await chrome.tabs.getCurrent();
  await chrome.tabs.update(sourceTab,{active:true});
  try{
    for(const [i,row]of state.rows.entries()){
      aborted(signal);message(`Đang tải lazy-load: trang ${i+1}/${state.rows.length}…`);
      const snapshot=await execute(inspectReader,[{sourceKey:original.sourceKey,scrollToPage:row.page}]);
      acceptSnapshot(snapshot,true,false);if((i+1)%25===0)render();
    }
    const missing=state.rows.filter(row=>!row.url||!row.loaded).length;
    message(missing?`Đã cuộn qua chương. Còn ${missing} ảnh chưa tải xong trên trang nguồn; kiểm tra Comix rồi quét lại.`:`Đã thu thập ${state.rows.length} URL ảnh. Kiểm tra danh sách trước khi xuất.`);
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
  const json={source:state.snapshot.url,title:state.snapshot.title,pages:selectedRows().map(({page,url})=>({page,url}))};
  await saveBlob(new Blob([JSON.stringify(json,null,2)],{type:'application/json'}),safeFilename($('zip-name').value)+'-urls.json');message('Đã xuất danh sách URL. URL ảnh có thể hết hạn; đây chưa phải ZIP ảnh.');
});
$('download').onclick=()=>{
  if(state.busy)return;
  const rows=selectedRows();if(!rows.length)return;
  const origins=[...new Set(rows.map(row=>new URL(row.url).origin+'/*'))];
  // Request only the selected image hosts, directly from the user's click.
  const permission=chrome.permissions.request({origins});
  run(async signal=>{
    if(!await permission)throw new Error('Chưa được cấp quyền cho máy chủ ảnh. Không có ảnh nào được tải. Bạn có thể bấm tải lại hoặc xuất danh sách URL.');
    if(state.snapshot.provider==='naver'&&rows.some(row=>new URL(row.url).hostname==='image-comic.pstatic.net')){
      const own=await chrome.tabs.getCurrent();state.ruleId=10000+own.id;
      await chrome.declarativeNetRequest.updateSessionRules({removeRuleIds:[state.ruleId],addRules:[{id:state.ruleId,priority:1,action:{type:'modifyHeaders',requestHeaders:[{header:'Referer',operation:'set',value:'https://comic.naver.com/'}]},condition:{requestDomains:['image-comic.pstatic.net'],initiatorDomains:[chrome.runtime.id],resourceTypes:['xmlhttprequest'],requestMethods:['get']}}]});
    }
    const wanted=new Set(rows.map(row=>row.url));for(const key of state.cache.keys())if(!wanted.has(key))state.cache.delete(key);
    if(rows.length!==state.rows.length&&!confirm(`Chỉ xuất ${rows.length}/${state.rows.length} ảnh đã chọn. Bạn muốn tải một phần chương?`))return;
    // Ensure the reader still refers to this chapter; never mix different chapters.
    await execute(inspectReader,[{sourceKey:state.snapshot.sourceKey}]);
    const base=safeFilename($('zip-name').value);
    const jobKey=JSON.stringify([state.snapshot.sourceKey,base,rows.map(row=>[row.page,row.url])]);
    if(state.jobKey!==jobKey){state.jobKey=jobKey;state.completed.clear();state.parts=0;}
    const pending=rows.filter(row=>!state.completed.has(row.page));
    if(!pending.length){message('Các ảnh đã chọn đã được lưu trong lần tải trước. Đổi tên ZIP nếu muốn tải lại từ đầu.');return;}
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
          const response=await fetch(row.url,{credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.any([signal,AbortSignal.timeout(30000)])});
          const image=await readImage(response,signal);aborted(signal);state.cache.set(row.url,image);
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
    $('progress').textContent=`Đã lưu ${state.parts} phần ZIP, đủ ${state.completed.size}/${rows.length} ảnh. Mỗi phần tối đa 100 ảnh hoặc 100 MB; giữ nguyên dữ liệu ảnh.`;
    message('Tải hoàn tất. Nhập từng phần ZIP vào Xưởng dịch để xử lý; có thể cộng thêm các phần trong giới hạn 250 MB của một dự án.');
  });
};
run(scan);
