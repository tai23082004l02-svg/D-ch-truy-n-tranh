"""Optional integration check against locally downloaded source tiles (no network)."""
import io
import json
import os
from pathlib import Path
import tempfile
import zipfile
from PIL import Image,ImageChops
from playwright.sync_api import sync_playwright

source=Path(os.environ['WEBTOON_SOURCE_DIR'])
files=sorted(source.glob('*.jpg'))
assert len(files)>=8,'Need source tiles including the reported 7/8 boundary'
base=os.environ.get('TEST_BASE_URL','http://127.0.0.1:5173/')
with tempfile.TemporaryDirectory() as tmp,sync_playwright() as p:
    proxy_url=os.environ.get('HTTPS_PROXY') or os.environ.get('HTTP_PROXY')
    proxy={'server':proxy_url,'bypass':'localhost,127.0.0.1'} if proxy_url else None
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'],proxy=proxy)
    page=browser.new_page(viewport={'width':1440,'height':1080},accept_downloads=True)
    page.on('dialog',lambda dialog:dialog.accept())
    page.goto(base);page.locator('#image-input').set_input_files([str(f) for f in files])
    page.wait_for_function("document.querySelectorAll('.page-card').length===%d"%len(files),timeout=120000)
    print('Imported actual tiles:',len(files),flush=True)
    page.locator('#webtoon-button').click();page.locator('#webtoon-start').click()
    page.wait_for_function("!document.body.classList.contains('busy')",timeout=180000)
    status=page.locator('#status').inner_text();print(status,flush=True)
    assert status.startswith('Đã ghép'),status
    with page.expect_download(timeout=90000) as dl:page.locator('#webtoon-export').click()
    path=Path(tmp)/'reflow.zip';dl.value.save_as(path)
    with zipfile.ZipFile(path) as z:
        layout=json.loads(z.read('webtoon-layout.json'))
        seam=layout['sources'][6]['end'];width=layout['width'];margin=80
        index,segment=next((i,s) for i,s in enumerate(layout['segments']) if s['start']<=seam-margin and s['end']>=seam+margin)
        name=next(n for n in z.namelist() if n.startswith(f'webtoon-{index+1:04}'))
        output=Image.open(io.BytesIO(z.read(name))).convert('RGB')
        left=Image.open(files[6]).convert('RGB');right=Image.open(files[7]).convert('RGB')
        expected=Image.new('RGB',(width,margin*2));expected.paste(left.crop((0,left.height-margin,width,left.height)),(0,0));expected.paste(right.crop((0,0,width,margin)),(0,margin))
        actual=output.crop((0,seam-segment['start']-margin,width,seam-segment['start']+margin))
        assert max(high for low,high in ImageChops.difference(expected,actual).getextrema())<=3,'Boundary pixels were shifted, lost or rescaled'
        assert layout['segments'][0]['start']==0 and layout['segments'][-1]['end']==layout['totalHeight']
        assert all(s['end']-s['start']<=12000 for s in layout['segments'])
        print(f'PASS actual chapter: {len(files)} tiles → {len(layout["segments"])} segments; boundary 7/8 at y={seam} preserved inside segment {index+1}.',flush=True)
        page.locator('.page-card').nth(index).click();page.wait_for_function("!document.querySelector('#editor').hidden")
        page.screenshot(path='/tmp/webtoon-live-result.png',full_page=True)
    browser.close()
