"""Real Chromium extension APIs + fixture reader/CDN; never calls the live chapter API.

The temporary test manifest pre-grants fixture hosts to stand in for the user's
activeTab click and optional-host consent. Production permissions stay unchanged.
"""
import io
import json
import os
from pathlib import Path
import shutil
import tempfile
import zipfile

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
READER='https://comix.to/title/test-reader/chapter-1'
FIXTURE='''<!doctype html><html><head><title>Fixture Chapter 1</title></head><body>
<img src="https://cdn.example.test/avatar.png" width="30" height="30" alt="avatar">
<div class="rpage rpage--ttb"><div class="rpage-progress">
<button class="rpage-progress__seg">1</button><button class="rpage-progress__seg">2</button><button class="rpage-progress__seg">3</button></div>
<div class="rpage-page" data-page="1" style="height:1200px"><img class="rpage-page__img" src="https://cdn.example.test/1.png" width="240" height="320"></div>
<div class="rpage-page" data-page="2" style="height:1200px" data-url="https://cdn.example.test/2.png"></div>
<div class="rpage-page" data-page="3" style="height:1200px" data-url="https://cdn.example.test/3.png"></div></div>
<script>
const observer=new IntersectionObserver(entries=>{for(const {target,isIntersecting} of entries)if(isIntersecting&&target.dataset.url&&!target.querySelector('img')){const img=document.createElement('img');img.className='rpage-page__img';img.width=240;img.height=320;img.src=target.dataset.url;target.append(img);}},{rootMargin:'0px'});
for(const node of document.querySelectorAll('[data-url]'))observer.observe(node);
</script></body></html>'''

with tempfile.TemporaryDirectory() as temporary,sync_playwright() as p:
    tmp=Path(temporary);extension=tmp/'extension';shutil.copytree(ROOT/'extension',extension)
    manifest=json.loads((extension/'manifest.json').read_text())
    manifest['permissions'].append('declarativeNetRequestFeedback')
    manifest['host_permissions']=['https://comix.to/*','https://cdn.example.test/*','https://comic.naver.com/*','https://image-comic.pstatic.net/*']
    (extension/'manifest.json').write_text(json.dumps(manifest))
    images={}
    for i,color in enumerate(['red','green','blue'],1):
        data=io.BytesIO();Image.new('RGB',(240,320),color).save(data,format='PNG');images[f'{i}.png']=data.getvalue()
    counts={};fail_second={'enabled':True};fail_bulk={'enabled':True}
    def cdn(route):
        name=route.request.url.rsplit('/',1)[-1]
        if route.request.resource_type in ('fetch','xhr'):
            counts[name]=counts.get(name,0)+1
            if name=='2.png' and fail_second['enabled']:
                route.fulfill(status=403,body='Forbidden',headers={'Access-Control-Allow-Origin':'*'});return
            if name=='bulk-111.png' and fail_bulk['enabled']:
                route.fulfill(status=403,body='Forbidden',headers={'Access-Control-Allow-Origin':'*'});return
        route.fulfill(body=images.get(name,images['1.png']),content_type='image/png',headers={'Access-Control-Allow-Origin':'*'})
    proxy_url=os.environ.get('HTTPS_PROXY') or os.environ.get('HTTP_PROXY')
    proxy={'server':proxy_url,'bypass':'localhost,127.0.0.1'} if proxy_url else None
    context=p.chromium.launch_persistent_context(str(tmp/'profile'),executable_path=os.environ.get('CAPTURE_CHROMIUM','/usr/bin/chromium'),headless=True,ignore_default_args=['--disable-extensions'],args=['--no-sandbox',f'--disable-extensions-except={extension}',f'--load-extension={extension}'],proxy=proxy,accept_downloads=True,downloads_path=str(tmp/'downloads'),viewport={'width':1300,'height':950})
    context.route('https://cdn.example.test/**',cdn)
    naver_headers=[];naver_matches=[]
    def naver_cdn(route):
        if route.request.resource_type in ('fetch','xhr'):
            naver_headers.append(route.request.headers)
            if not naver_matches:naver_matches.append(collector.evaluate("url => chrome.declarativeNetRequest.testMatchOutcome({url,type:'xmlhttprequest',initiator:chrome.runtime.getURL('/')})",route.request.url))
        route.fulfill(body=images['1.png'],content_type='image/png',headers={'Access-Control-Allow-Origin':'*'})
    context.route('https://image-comic.pstatic.net/**',naver_cdn)
    context.route('https://comix.to/**',lambda route:route.fulfill(body=FIXTURE if route.request.url==READER else '<html><title>Title page</title><body>No reader</body></html>',content_type='text/html'))
    worker=context.service_workers[0] if context.service_workers else context.wait_for_event('serviceworker')
    extension_id=worker.url.split('/')[2]
    reader=context.new_page();reader.goto('https://comix.to/title/test-title')
    source_id=worker.evaluate("async()=>{const tabs=await chrome.tabs.query({url:'https://comix.to/*'});return tabs[0].id;}")
    collector=context.new_page();errors=[];collector.on('pageerror',lambda error:errors.append(str(error)))
    collector.goto(f'chrome-extension://{extension_id}/collector.html?tab={source_id}')
    collector.evaluate("() => {window.requestedFilenames=[];const original=chrome.downloads.download;chrome.downloads.download=function(options){window.requestedFilenames.push(options.filename);return original.call(chrome.downloads,options);};}")
    collector.wait_for_function("() => document.querySelector('#status').textContent.includes('Chưa thấy ảnh chương')")
    reader.goto(READER)
    collector.bring_to_front();collector.locator('#scan').click()
    collector.wait_for_function("() => document.querySelectorAll('.image-card').length === 3")
    assert '1/3' in collector.locator('#image-count').inner_text()
    collector.locator('#load-pages').click()
    collector.wait_for_function("() => document.querySelector('#status').textContent.includes('Đã thu thập 3 URL')",timeout=30000)
    assert '3/3' in collector.locator('#image-count').inner_text()
    assert collector.locator('.image-card').count()==3 # avatar is excluded
    collector.locator('#download').click()
    collector.wait_for_function("() => document.querySelector('#status').textContent.includes('1 ảnh tải lỗi')",timeout=30000)
    assert 'Trang 2: HTTP 403' in collector.locator('#progress').inner_text()
    assert counts.get('1.png')==1 and not counts.get('3.png')
    assert not list((tmp/'downloads').glob('*.zip')), 'Partial archive exported without explicit review'
    fail_second['enabled']=False
    with collector.expect_download(timeout=30000) as download:
        collector.locator('#download').click()
    archive=tmp/'chapter.zip';download.value.save_as(archive)
    with zipfile.ZipFile(archive) as z:
        assert z.namelist()==['001.png','002.png','003.png']
        for i in range(1,4):assert z.read(f'{i:03}.png')==images[f'{i}.png']
    assert counts.get('1.png')==1 and counts.get('2.png')==2 and counts.get('3.png')==1, counts
    # Do not reuse a scanned chapter after the user navigates the source tab.
    reader.goto('https://comix.to/title/different-chapter')
    collector.bring_to_front();collector.locator('#download').click()
    collector.wait_for_function("() => document.querySelector('#status').classList.contains('bad')",timeout=10000)
    assert 'đổi chương' in collector.locator('#status').inner_text()
    # A real download of >100 images must produce bounded parts, in order.
    bulk='''<html><head><title>Bulk chapter</title></head><body><div class="rpage rpage--ttb">'''+''.join(f'<div class="rpage-page" data-page="{i}"><img class="rpage-page__img" src="https://cdn.example.test/bulk-{i}.png" width="240" height="320"></div>' for i in range(1,131))+'</div></body></html>'
    context.route('https://comix.to/title/bulk-chapter',lambda route:route.fulfill(body=bulk,content_type='text/html'))
    reader.goto('https://comix.to/title/bulk-chapter');collector.bring_to_front()
    collector.locator('#scan').click();collector.wait_for_function("() => document.querySelectorAll('.image-card').length===130")
    bulk_downloads=[];collector.on('download',lambda download:bulk_downloads.append(download))
    collector.locator('#download').click()
    collector.wait_for_function("() => document.querySelector('#status').textContent.includes('1 ảnh tải lỗi')",timeout=60000)
    assert len(bulk_downloads)==1
    fail_bulk['enabled']=False
    collector.locator('#download').click()
    collector.wait_for_function("() => document.querySelector('#status').textContent.includes('Tải hoàn tất')",timeout=60000)
    assert len(bulk_downloads)==2
    assert counts['bulk-1.png']==1 and counts['bulk-110.png']==1 and counts['bulk-111.png']==2
    for index,download in enumerate(bulk_downloads):
        path=tmp/f'bulk-{index}.zip';download.save_as(path)
        assert f'part-{index+1:03}' in collector.evaluate('window.requestedFilenames')[-2+index]
        with zipfile.ZipFile(path) as z:
            expected=list(range(1,101)) if index==0 else list(range(101,131))
            assert z.namelist()==[f'{i:03}.png' for i in expected]
            assert all(z.read(name)==images['1.png'] for name in z.namelist())
    # Naver's chapter identity is in titleId/no query parameters, not the pathname.
    naver_html='<html><head><title>Naver episode</title></head><body><img src="https://image-comic.pstatic.net/thumbnail.jpg"><div id="comic_view_area"><div class="wt_viewer">'+''.join(f'<img id="content_image_{i}" src="https://image-comic.pstatic.net/webtoon/777767/1/{i}.jpg" alt="comic content">' for i in range(106))+'</div></div></body></html>'
    context.route('https://comic.naver.com/**',lambda route:route.fulfill(body=naver_html if 'no=1' in route.request.url else '<html>No episode</html>',content_type='text/html'))
    reader.goto('https://comic.naver.com/webtoon/detail?titleId=777767&no=1');collector.bring_to_front()
    collector.locator('#scan').click();collector.wait_for_function("() => document.querySelectorAll('.image-card').length===106")
    naver_downloads=[];collector.on('download',lambda download:naver_downloads.append(download))
    collector.locator('#download').click()
    collector.wait_for_function("() => document.querySelector('#status').textContent.includes('Tải hoàn tất')",timeout=60000)
    assert len(naver_downloads)==2 and len(naver_headers)==106
    # DevTools fulfills fixture requests before DNR's network header stage;
    # verify the installed native rule matches the real extension initiator.
    assert naver_matches[0]['matchedRules'],naver_matches
    for index,download in enumerate(naver_downloads):
        path=tmp/f'naver-{index}.zip';download.save_as(path)
        with zipfile.ZipFile(path) as z:assert len(z.namelist())==(100 if index==0 else 6)
    rules=collector.evaluate('() => chrome.declarativeNetRequest.getSessionRules()')
    assert not rules,'Temporary image Referer rule was not removed'
    reader.goto('https://comic.naver.com/webtoon/detail?titleId=777767&no=2');collector.bring_to_front()
    collector.locator('#download').click()
    collector.wait_for_function("() => document.querySelector('#status').textContent.includes('đổi chương')",timeout=10000)
    assert not errors,errors
    collector.screenshot(path='/tmp/comix-capture-extension.png',full_page=True)
    context.close()
    print('PASS: real extension APIs, Comix and Naver selectors, lazy scrolling, 130/106-image chapters split correctly, Naver Referer scope/cleanup, cached retry, exact bytes/order, query-based chapter-change guard.')
