"""Verify actual canvas output, speech spanning source tiles, backup and restore."""
import io
import json
import os
from pathlib import Path
import tempfile
import zipfile

from PIL import Image,ImageDraw,ImageFont,ImageChops
from playwright.sync_api import sync_playwright

BASE=os.environ.get('TEST_BASE_URL','http://127.0.0.1:5173/')
with tempfile.TemporaryDirectory() as temporary,sync_playwright() as p:
    tmp=Path(temporary)
    strip=Image.new('RGB',(240,8000),'white');d=ImageDraw.Draw(strip)
    for y0,y1 in [(0,2600),(2800,5200),(5400,7800)]:d.rectangle((10,y0,230,y1-1),fill='#a8c4d5',outline='black',width=2)
    d.ellipse((25,1400,215,1850),fill='white',outline='black',width=3)
    font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf',30)
    d.multiline_text((120,1580),'HELLO\nGRANDPA',font=font,fill='black',anchor='mm',align='center',spacing=12)
    inputs=[]
    for i in range(5):
        path=tmp/f'{i+1:03}.png';strip.crop((0,i*1600,240,(i+1)*1600)).save(path);inputs.append(str(path))
    proxy_url=os.environ.get('HTTPS_PROXY') or os.environ.get('HTTP_PROXY')
    proxy={'server':proxy_url,'bypass':'localhost,127.0.0.1'} if proxy_url else None
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'],proxy=proxy)
    page=browser.new_page(viewport={'width':1440,'height':1080},accept_downloads=True)
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda dialog:dialog.accept())
    page.goto(BASE);page.locator('#image-input').set_input_files(inputs)
    page.wait_for_function("document.querySelector('#status').textContent.includes('Đã nhập 5 trang')")
    page.locator('#webtoon-button').click();page.locator('#webtoon-start').click()
    page.wait_for_function("!document.body.classList.contains('busy')",timeout=30000)
    assert 'Đã ghép 5 ảnh' in page.locator('#status').inner_text(),page.locator('#status').inner_text()
    assert page.locator('#webtoon-revert').is_enabled()
    with page.expect_download() as dl:page.locator('#webtoon-export').click()
    dl.value.save_as(tmp/'reflow.zip')
    with zipfile.ZipFile(tmp/'reflow.zip') as z:
        layout=json.loads(z.read('webtoon-layout.json'));assert len(layout['segments'])==2
        joined=Image.new('RGB',strip.size)
        for index,seg in enumerate(layout['segments']):
            assert not seg['forced'] and not seg['overlapBefore']
            assert not 1400<seg['end']<1850,'Cut through the balloon'
            output=Image.open(io.BytesIO(z.read(f'webtoon-{index+1:04}.png'))).convert('RGB')
            assert output.size==(240,seg['end']-seg['start'])
            joined.paste(output,(0,seg['start']))
        assert ImageChops.difference(joined,strip).getbbox() is None,'Missing, altered or reordered pixels'
    with page.expect_download() as dl:page.locator('#save-button').click()
    dl.value.save_as(tmp/'project.zip')
    page.locator('#clear-button').click();page.locator('#project-input').set_input_files(str(tmp/'project.zip'))
    page.wait_for_function("document.querySelector('#status').textContent.includes('Đã mở dự án 2 trang')")
    assert page.locator('#webtoon-revert').is_enabled()
    page.locator('#webtoon-revert').click()
    assert page.locator('.page-card').count()==5
    # Reversible errors: mixed widths must not replace source images.
    wrong=tmp/'006.png';Image.new('RGB',(241,100),'white').save(wrong)
    page.locator('#image-input').set_input_files(str(wrong));page.wait_for_function("document.querySelectorAll('.page-card').length===6")
    page.locator('#webtoon-button').click();page.locator('#webtoon-start').click()
    page.wait_for_function("!document.body.classList.contains('busy')")
    assert 'cùng chiều rộng' in page.locator('#status').inner_text()
    assert page.locator('.page-card').count()==6 and page.locator('#webtoon-revert').is_disabled()
    # Force the bounded fallback: no white/black gutter anywhere in this texture.
    page.locator('#clear-button').click()
    texture=Image.new('RGB',(64,15000));td=ImageDraw.Draw(texture)
    for x in range(64):td.line((x,0,x,14999),fill='white' if x%2 else 'black')
    for i in range(5):texture.crop((0,i*3000,64,(i+1)*3000)).save(tmp/f'fallback-{i}.png')
    page.locator('#image-input').set_input_files([str(tmp/f'fallback-{i}.png') for i in range(5)])
    page.wait_for_function("document.querySelector('#status').textContent.includes('Đã nhập 5 trang')")
    page.locator('#webtoon-button').click();page.locator('#webtoon-start').click()
    page.wait_for_function("!document.body.classList.contains('busy')",timeout=30000)
    assert '1 điểm chưa có khoảng trống' in page.locator('#status').inner_text()
    with page.expect_download() as dl:page.locator('#webtoon-export').click()
    dl.value.save_as(tmp/'fallback.zip')
    with zipfile.ZipFile(tmp/'fallback.zip') as z:
        layout=json.loads(z.read('webtoon-layout.json'))
        assert layout['segments'][0]['forced'] and layout['segments'][1]['overlapBefore']==256
        for i,seg in enumerate(layout['segments']):
            name=[n for n in z.namelist() if n.startswith(f'webtoon-{i+1:04}')][0]
            actual=Image.open(io.BytesIO(z.read(name))).convert('RGB')
            assert ImageChops.difference(actual,texture.crop((0,seg['start'],64,seg['end']))).getbbox() is None
    assert not errors,errors
    browser.close();print('PASS: speech spanning original tiles, lossless pixel coverage, backup/project round-trip, mixed-width rollback, bounded overlap fallback.')
