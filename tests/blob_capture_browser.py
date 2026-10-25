"""Real same-origin Blob URLs and page navigation, using non-explicit fixtures."""
import base64
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
with tempfile.TemporaryDirectory() as temporary,sync_playwright() as p:
    tmp=Path(temporary);extension=tmp/'extension';shutil.copytree(ROOT/'extension',extension)
    manifest=json.loads((extension/'manifest.json').read_text());manifest['host_permissions']=['https://hentairead.com/*'];(extension/'manifest.json').write_text(json.dumps(manifest))
    images={}
    for i,color in enumerate(['red','green','blue','yellow'],1):
        buf=io.BytesIO();Image.new('RGB',(240,320),color).save(buf,format='PNG');images[i]=buf.getvalue()
    def html(number,unknown=False,revoked=False):
        encoded=base64.b64encode(images[number]).decode()
        counter='' if unknown else f'<footer>{number} / 4</footer>'
        return f'''<html><head><title>Blob reader fixture</title></head><body>
        <img class="reading-image group-[&amp;.fit-height]/reading-images:h-full" data-page="{number}" alt="Page {number}" width="240" height="320">{counter}
        <script>const bytes=Uint8Array.from(atob('{encoded}'),c=>c.charCodeAt(0));const img=document.querySelector('img');if({str(revoked).lower()})img.onload=()=>URL.revokeObjectURL(img.src);img.src=URL.createObjectURL(new Blob([bytes],{{type:'image/png'}}));</script>
        </body></html>'''
    visited=[];blocked={'enabled':False}
    def site(route):
        url=route.request.url;number=int(url.rstrip('/').rsplit('/',1)[-1]) if '/p/' in url else 1
        if route.request.resource_type=='document':visited.append(url)
        if '/other/' in url:body='<html>Other chapter</html>'
        elif blocked['enabled'] and number==2:body='<html><title>Checking access</title>No image yet</html>'
        else:body=html(number,'/unknown/' in url or '/revoked/' in url,'/revoked/' in url)
        route.fulfill(body=body,content_type='text/html')
    proxy_url=os.environ.get('HTTPS_PROXY') or os.environ.get('HTTP_PROXY');proxy={'server':proxy_url,'bypass':'localhost,127.0.0.1'} if proxy_url else None
    context=p.chromium.launch_persistent_context(str(tmp/'profile'),executable_path=os.environ.get('CAPTURE_CHROMIUM','/usr/bin/chromium'),headless=True,ignore_default_args=['--disable-extensions'],args=['--no-sandbox',f'--disable-extensions-except={extension}',f'--load-extension={extension}'],proxy=proxy,accept_downloads=True,downloads_path=str(tmp/'downloads'))
    context.route('https://hentairead.com/**',site)
    worker=context.service_workers[0] if context.service_workers else context.wait_for_event('serviceworker');eid=worker.url.split('/')[2]
    reader=context.new_page();reader.goto('https://hentairead.com/hentai/fixture/english/p/3/')
    reader.wait_for_function("() => document.querySelector('img').src.startsWith('blob:')")
    source_id=worker.evaluate("async()=>{const tabs=await chrome.tabs.query({url:'https://hentairead.com/*'});return tabs[0].id;}")
    collector=context.new_page();errors=[];collector.on('pageerror',lambda e:errors.append(str(e)));collector.on('dialog',lambda dialog:dialog.accept())
    collector.goto(f'chrome-extension://{eid}/collector.html?tab={source_id}')
    collector.wait_for_function("() => document.querySelector('#status').textContent.includes('trang 3/4')")
    assert collector.locator('.image-card').count()==4
    assert collector.locator('#load-pages').is_disabled()
    collector.evaluate("() => {window.permissionCalls=0;const native=chrome.permissions.request;chrome.permissions.request=function(options){window.permissionCalls++;return native.call(chrome.permissions,options);};}")
    with collector.expect_download(timeout=45000) as dl:collector.locator('#download').click()
    output=tmp/'chapter.zip';dl.value.save_as(output)
    collector.wait_for_function("() => document.querySelector('#status').textContent.includes('Tải hoàn tất')")
    with zipfile.ZipFile(output) as z:
        assert z.namelist()==['001.png','002.png','003.png','004.png']
        for i in range(1,5):assert z.read(f'{i:03}.png')==images[i]
    assert collector.evaluate('window.permissionCalls')==0
    assert collector.locator('.image-card img').count()==4
    assert all('/hentai/fixture/english/' in url for url in visited)
    # Unknown total must stay current-page-only, never invent a full chapter.
    reader.goto('https://hentairead.com/hentai/unknown/english/p/3/');collector.bring_to_front();collector.locator('#scan').click()
    collector.wait_for_function("() => document.querySelector('#status').textContent.includes('chưa xác định')")
    assert collector.locator('.image-card').count()==1
    with collector.expect_download(timeout=20000) as dl:collector.locator('#download').click()
    dl.value.save_as(tmp/'single.zip')
    with zipfile.ZipFile(tmp/'single.zip') as z:assert z.namelist()==['003.png'] and z.read('003.png')==images[3]
    collector.wait_for_function("() => document.querySelector('#stop').hidden")
    # Revoked object URLs still have a visible decoded image; fallback is labeled PNG.
    reader.goto('https://hentairead.com/hentai/revoked/english/p/3/');collector.bring_to_front();collector.locator('#scan').click()
    collector.wait_for_function("() => document.querySelector('#status').textContent.includes('chưa xác định')")
    with collector.expect_download(timeout=20000) as dl:collector.locator('#download').click()
    dl.value.save_as(tmp/'revoked.zip')
    collector.wait_for_function("() => document.querySelector('#stop').hidden")
    with zipfile.ZipFile(tmp/'revoked.zip') as z:
        image=Image.open(io.BytesIO(z.read('003.png'))).convert('RGB');assert image.size==(240,320) and image.getpixel((100,100))==(0,0,255)
    assert 'xuất lại thành PNG' in collector.locator('#progress').inner_text()
    # Stop while a source page has no image (e.g. access check), then resume.
    reader.goto('https://hentairead.com/hentai/resume/english/p/3/');collector.bring_to_front();collector.locator('#scan').click()
    collector.wait_for_function("() => document.querySelector('#status').textContent.includes('trang 3/4')")
    blocked['enabled']=True;collector.locator('#download').click()
    reader.wait_for_url('**/hentai/resume/english/p/2/',timeout=20000)
    collector.bring_to_front();collector.locator('#stop').click()
    collector.wait_for_function("() => document.querySelector('#stop').hidden",timeout=5000)
    assert 'Đã dừng' in collector.locator('#status').inner_text()
    blocked['enabled']=False
    with collector.expect_download(timeout=45000) as dl:collector.locator('#download').click()
    dl.value.save_as(tmp/'resumed.zip')
    with zipfile.ZipFile(tmp/'resumed.zip') as z:assert z.namelist()==['001.png','002.png','003.png','004.png']
    collector.wait_for_function("() => document.querySelector('#stop').hidden")
    reader.goto('https://hentairead.com/hentai/other/english/p/1/');collector.bring_to_front();collector.locator('#download').click()
    collector.wait_for_function("() => document.querySelector('#status').textContent.includes('đổi chương')")
    assert not errors,errors
    context.close();print('PASS: real in-tab blob reads, exact bytes, current-page 3 → complete 1–4, unknown-total and revoked-blob PNG fallback, no CDN permission prompt, stop/resume, same-chapter navigation guard.')
