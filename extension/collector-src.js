import JSZip from 'jszip';
import {inspectReader,restoreScroll,safeFilename,validatePages,readImage} from './source.js';

const $=id=>document.getElementById(id);
const sourceTab=Number(new URL(location.href).searchParams.get('tab'));
const state={snapshot:null,rows:[],selected:new Set(),cache:new Map(),busy:false,controller:null};
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
  if(new URL(tab.url||'about:blank').hostname!=='comix.to')throw new Error('Tab nguồn phải là comix.to. Mở một chương ở Comix rồi bấm biểu tượng tiện ích.');
  const results=await chrome.scripting.executeScript({target:{tabId:sourceTab},func,args});
  if(results[0]?.result?.error)throw new Error(results[0].result.error);
  if(!results[0]?.result)throw new Error('Không đọc được tab nguồn. Mở lại tiện ích trên tab chương truyện.');
  return results[0].result;
}
function acceptSnapshot(snapshot,keepSelection=false){
  const rows=validatePages(snapshot.pages);
  if(!snapshot.vertical)throw new Error('Hãy chuyển Comix sang chế độ đọc cuộn dọc (Top to bottom), rồi quét lại.');
  if(snapshot.expectedPages!==rows.length)throw new Error(`Trang báo ${snapshot.expectedPages} ảnh nhưng chỉ có ${rows.length} vùng ảnh. Chuyển sang cuộn dọc hoặc đợi chương tải xong rồi thử lại.`);
  const same=state.snapshot?.sourceKey===snapshot.sourceKey;
  if(!same)state.cache.clear();
  state.snapshot=snapshot;state.rows=rows;
  if(!keepSelection||!same)state.selected=new Set(rows.filter(row=>row.url).map(row=>row.page));
  else for(const row of rows)if(row.url)state.selected.add(row.page);
  $('chapter-title').textContent=snapshot.title;$('source-url').textContent=snapshot.url;
  if(!same)$('zip-name').value=safeFilename(snapshot.title)+'-raw';render();
}
async function scan(){
  const snapshot=await execute(inspectReader);acceptSnapshot(snapshot);
  const missing=state.rows.filter(row=>!row.url).length;
  message(`Đã thấy ${state.rows.length} trang.${missing?` Còn ${missing} ảnh lazy-load chưa có URL; dùng Cuộn tải toàn bộ chương.`:' Kiểm tra thứ tự và chọn Tải ảnh đã chọn thành ZIP.'}`);
}
async function run(action){
  if(state.busy)return;state.busy=true;state.controller=new AbortController();update();
  try{await action(state.controller.signal);}catch(error){message(state.controller.signal.aborted?'Đã dừng. Có thể quét hoặc thử tải lại.':error.message||'Thao tác thất bại. Hãy mở lại tiện ích trên tab nguồn.',!state.controller.signal.aborted);}
  finally{state.busy=false;state.controller=null;update();}
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
      acceptSnapshot(snapshot,true);
    }
    const missing=state.rows.filter(row=>!row.url||!row.loaded).length;
    message(missing?`Đã cuộn qua chương. Còn ${missing} ảnh chưa tải xong trên trang nguồn; kiểm tra Comix rồi quét lại.`:`Đã thu thập ${state.rows.length} URL ảnh. Kiểm tra danh sách trước khi xuất.`);
  }finally{
    await chrome.scripting.executeScript({target:{tabId:sourceTab},func:restoreScroll,args:[original.scrollY,original.sourceKey]}).catch(()=>{});
    if(own?.id)await chrome.tabs.update(own.id,{active:true}).catch(()=>{});
  }
});
$('select-all').onclick=()=>{state.selected=new Set(state.rows.filter(row=>row.url).map(row=>row.page));render();};
$('select-none').onclick=()=>{state.selected.clear();render();};

async function saveBlob(blob,name){
  const url=URL.createObjectURL(blob);
  try{
    const id=await chrome.downloads.download({url,filename:name,saveAs:true});downloads.set(id,url);
    const [item]=await chrome.downloads.search({id});
    if(item&&item.state!=='in_progress'){URL.revokeObjectURL(url);downloads.delete(id);}
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
    const wanted=new Set(rows.map(row=>row.url));for(const key of state.cache.keys())if(!wanted.has(key))state.cache.delete(key);
    if(rows.length!==state.rows.length&&!confirm(`Chỉ xuất ${rows.length}/${state.rows.length} ảnh đã chọn. Bạn muốn tải một phần chương?`))return;
    // Ensure the reader still refers to this chapter; never mix different chapters.
    await execute(inspectReader,[{sourceKey:state.snapshot.sourceKey}]);
    const failures=[];let total=0;
    $('progress-bar').hidden=false;
    for(const [i,row]of rows.entries()){
      aborted(signal);$('progress').textContent=`Đang tải ảnh ${i+1}/${rows.length}…`;$('progress-bar').value=i/rows.length*100;
      try{
        if(!state.cache.has(row.url)){
          const response=await fetch(row.url,{credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.any([signal,AbortSignal.timeout(30000)])});
          const image=await readImage(response,signal);aborted(signal);
          if([...state.cache.values()].reduce((n,item)=>n+item.bytes.length,0)+image.bytes.length>250*1024**2)throw new Error('Tổng ảnh vượt 250 MB. Hãy chọn ít trang hơn.');
          state.cache.set(row.url,image);
        }
        total+=state.cache.get(row.url).bytes.length;
        if(total>250*1024**2)throw new Error('ZIP vượt 250 MB.');
      }catch(error){if(signal.aborted)throw error;failures.push(`Trang ${row.page}: ${error.message||'Lỗi mạng/CORS. Kiểm tra ảnh có mở được trên trang nguồn không.'}`);}
    }
    aborted(signal);
    if(failures.length){$('progress').textContent=failures.join('\n');throw new Error(`${failures.length} ảnh tải lỗi. Chưa xuất ZIP để tránh thiếu trang. Ảnh tải thành công được giữ trong tab; có thể thử lại hoặc bỏ chọn những trang lỗi để xuất một phần có chủ ý.`);}
    $('progress').textContent='Đang đóng gói ảnh gốc…';const zip=new JSZip();
    for(const row of rows){const image=state.cache.get(row.url);zip.file(`${String(row.page).padStart(3,'0')}.${image.extension}`,image.bytes);}
    const blob=await zip.generateAsync({type:'blob',compression:'STORE'},metadata=>{$('progress-bar').value=metadata.percent;});aborted(signal);
    await saveBlob(blob,safeFilename($('zip-name').value)+'.zip');$('progress').textContent=`Đã tạo ZIP ${rows.length} ảnh (${(total/1024**2).toFixed(1)} MB), giữ nguyên dữ liệu ảnh từ máy chủ.`;message('Tải ZIP xong, mở Xưởng dịch → Nhập ảnh / ZIP → chọn tệp vừa lưu.');
  });
};
run(scan);
