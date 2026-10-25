"""Regression on the repository's manga artwork, with known English dialogue.

The artwork is real; the English lettering is a fixture, not the user's original
English scan. This test does not establish accuracy on every manga font/page.
"""
import json
import os
from pathlib import Path
import subprocess
import tempfile

from PIL import Image, ImageDraw, ImageFont, ImageOps
from playwright.sync_api import sync_playwright

BASE = os.environ.get('TEST_BASE_URL', 'http://127.0.0.1:5173/')
ROOT = Path(__file__).resolve().parents[1]

with tempfile.TemporaryDirectory() as temporary:
    tmp = Path(temporary)
    image = Image.open(ROOT / 'translations/shokugeki-no-souma/trang-001.vi.png').convert('RGBA')
    (tmp / 'input.rgba').write_bytes(image.tobytes())
    js = """
      import {readFileSync,writeFileSync} from 'node:fs';
      import {findSpeechRegions} from './src/ocr-regions.js';
      const path=process.argv[1];
      const regions=findSpeechRegions({width:1029,height:1528,data:readFileSync(path+'/input.rgba')});
      for(const [i,r]of regions.entries())writeFileSync(path+'/'+i+'.pgm',Buffer.concat([Buffer.from(`P5\\n${r.w} ${r.h}\\n255\\n`),Buffer.from(r.mask)]));
      console.log(JSON.stringify(regions.map(({x,y,w,h})=>({x,y,w,h}))));
    """
    regions = json.loads(subprocess.check_output(['node','--input-type=module','-e',js,str(tmp)], cwd=ROOT))
    targets = [
        ((887,446), ['WHAT DO','YOU THINK,','GRANDFATHER?',"I'M PRETTY",'CONFIDENT','ABOUT THIS','ONE!'], 23),
        ((851,842), ['THIS','SHOULD','BE GOOD','ENOUGH','TO BE MY','SPECIALTY,','RIGHT?'], 27),
        ((622,1335), ['IT WOULD','APPEAR THIS','STILL NEEDS','WORK. A PITY.'], 20),
        ((793,1395), ['HMMM','MMM...'], 15),
    ]
    draw = ImageDraw.Draw(image)
    for (cx,cy), lines, size in targets:
        index, region = min(enumerate(regions), key=lambda pair: abs(pair[1]['x']+pair[1]['w']/2-cx)+abs(pair[1]['y']+pair[1]['h']/2-cy))
        mask = Image.open(tmp / f'{index}.pgm').point(lambda value:255 if value<255 else 0)
        image.paste('white',(region['x'],region['y'],region['x']+region['w'],region['y']+region['h']),mask)
        font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-BoldOblique.ttf',size)
        draw.multiline_text((cx,cy),'\n'.join(lines),font=font,fill='black',spacing=4,anchor='mm',align='center')
    fixture = tmp/'manga-en.png'
    image.convert('RGB').save(fixture)
    # JPEG/resizing adds real-world compression around line art and glyphs.
    image.convert('RGB').resize((860,1277)).save(tmp/'manga-en-small.jpg',quality=85)
    with sync_playwright() as p:
        proxy_url = os.environ.get('HTTPS_PROXY') or os.environ.get('HTTP_PROXY')
        proxy = {'server':proxy_url,'bypass':'localhost,127.0.0.1'} if proxy_url else None
        browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'],proxy=proxy)
        page=browser.new_page(viewport={'width':1440,'height':1100},accept_downloads=True)
        page.on('dialog',lambda dialog:dialog.accept())
        errors=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.goto(BASE)
        page.locator('#image-input').set_input_files([str(fixture),str(tmp/'manga-en-small.jpg')])
        page.wait_for_function("document.querySelectorAll('.page-card').length === 2")
        page.locator('#ocr-button').click()
        page.wait_for_function("!document.body.classList.contains('busy')",timeout=120000)
        print('OCR status:',page.locator('#status').inner_text(),flush=True)
        for card in page.locator('.page-card').all():
            card.click()
            page.wait_for_function("!document.querySelector('#editor').hidden")
            texts=page.locator('.bubble-item').all_text_contents()
            print(texts,flush=True)
            joined=' '.join(texts).upper()
            for expected in ['GRANDFATHER','CONFIDENT','SPECIALTY','PITY']:
                assert expected in joined, f'{expected} missing: {joined}'
            assert 3 <= len(texts) <= 7, f'Too many art/noise detections: {texts}'
        # Re-run without deleting boxes; current-page action must work on existing results.
        page.locator('#ocr-page-button').click()
        page.wait_for_function("!document.body.classList.contains('busy')",timeout=120000)
        assert 'GRANDFATHER' in ' '.join(page.locator('.bubble-item').all_text_contents()).upper()
        # Crop OCR reads a selected speech region, leaving the other boxes intact.
        item=page.locator('.bubble-item').filter(has_text='GRANDFATHER').first
        item.click();count=page.locator('.bubble-item').count()
        page.locator('#source-text').fill('WRONG SOURCE')
        page.locator('#ocr-region-button').click()
        page.wait_for_function("!document.body.classList.contains('busy')",timeout=30000)
        assert 'GRANDFATHER' in page.locator('#source-text').input_value().upper()
        assert page.locator('.bubble-item').count()==count
        with page.expect_download() as dl:page.locator('#save-button').click()
        dl.value.save_as(tmp/'project.zip')
        import zipfile
        with zipfile.ZipFile(tmp/'project.zip') as archive:
            project=json.loads(archive.read('project.json'))
            for p in project['pages']:
                for box in p['boxes']:
                    assert box['w'] < 350 and box['h'] < 350, f'Art-spanning region: {box}'
        page.screenshot(path='/tmp/xuong-manga-regression.png',full_page=True)
        assert not errors,errors
        browser.close()
        print('PASS: manga artwork, separated English bubbles, resized JPEG, re-OCR existing page, selected-region OCR, no art-spanning boxes.')
