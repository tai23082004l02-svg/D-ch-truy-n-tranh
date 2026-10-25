"""Real OpenCV WASM, art OCR, loss/repair metrics, export and project round-trip."""
import io
import json
import os
from pathlib import Path
import tempfile
import zipfile
from PIL import Image,ImageDraw,ImageFont,ImageChops,ImageStat
from playwright.sync_api import sync_playwright

BASE=os.environ.get('TEST_BASE_URL','http://127.0.0.1:5173/')
with tempfile.TemporaryDirectory() as temporary,sync_playwright() as p:
    tmp=Path(temporary);background=Image.new('RGB',(900,650))
    for y in range(650):
        for x in range(900):background.putpixel((x,y),(50+x//18,65+y//30,90+x//45))
    original=background.copy();draw=ImageDraw.Draw(original)
    font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf',64)
    draw.text((450,215),'HELLO WORLD',font=font,fill='black',stroke_width=4,stroke_fill='white',anchor='mm');original.save(tmp/'caption.png')
    proxy_url=os.environ.get('HTTPS_PROXY') or os.environ.get('HTTP_PROXY');proxy={'server':proxy_url,'bypass':'localhost,127.0.0.1'} if proxy_url else None
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'],proxy=proxy)
    page=browser.new_page(viewport={'width':1440,'height':1080},accept_downloads=True);errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)));page.on('dialog',lambda dialog:dialog.accept())
    page.goto(BASE);page.locator('#image-input').set_input_files(str(tmp/'caption.png'))
    page.wait_for_function("document.querySelector('#status').textContent.includes('Đã nhập 1 trang')")
    page.wait_for_function("!document.querySelector('#editor').hidden")
    rect=page.locator('#editor').bounding_box()
    point=lambda x,y:(rect['x']+x/900*rect['width'],rect['y']+y/650*rect['height'])
    page.mouse.move(*point(100,140));page.mouse.down();page.mouse.move(*point(800,290));page.mouse.up()
    page.locator('#box-mode').select_option('art');page.locator('#art-edit').click()
    page.locator('#art-suggest').click()
    # Brush and eraser must map correctly from the scaled editor to native pixels.
    marked=page.locator('#art-mask-canvas').evaluate("canvas=>{const d=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;for(let i=0;i<d.length;i+=4)if(d[i]>d[i+1]+45)return {x:(i/4)%canvas.width,y:Math.floor(i/4/canvas.width),w:canvas.width,h:canvas.height};}")
    assert marked
    mask_rect=page.locator('#art-mask-canvas').bounding_box()
    mx=mask_rect['x']+(marked['x']+.5)/marked['w']*mask_rect['width'];my=mask_rect['y']+(marked['y']+.5)/marked['h']*mask_rect['height']
    page.locator('#art-brush-mode').select_option('erase');page.mouse.click(mx,my)
    color=page.locator('#art-mask-canvas').evaluate("(c,p)=>Array.from(c.getContext('2d').getImageData(p.x,p.y,1,1).data)",marked)
    assert color[0]-color[1]<45,color
    page.locator('#art-brush-mode').select_option('paint');page.mouse.click(mx,my)
    color=page.locator('#art-mask-canvas').evaluate("(c,p)=>Array.from(c.getContext('2d').getImageData(p.x,p.y,1,1).data)",marked)
    assert color[0]-color[1]>45,color
    page.locator('#art-suggest').click()
    # Cancellation while the runtime is loading must leave the source untouched.
    page.evaluate("() => {document.querySelector('#art-preview-button').click();document.querySelector('#art-cancel-worker').click();}")
    page.wait_for_function("!document.body.classList.contains('busy')")
    assert page.locator('#art-apply').is_disabled()
    page.locator('#art-preview-button').click()
    page.wait_for_function("document.querySelector('#art-apply').disabled===false || document.querySelector('#art-status').classList.contains('error')",timeout=90000)
    assert page.locator('#art-apply').is_enabled(),page.locator('#art-status').inner_text()
    page.screenshot(path='/tmp/art-inpaint-preview.png',full_page=True)
    page.locator('#art-apply').click();page.locator('#art-dialog').wait_for(state='hidden')
    page.locator('#ocr-region-button').click();page.wait_for_function("!document.body.classList.contains('busy')",timeout=90000)
    assert 'HELLO' in page.locator('#source-text').input_value().upper(),page.locator('#status').inner_text()
    page.locator('#translated-text').fill('CHÀO THẾ GIỚI');page.locator('#text-color').fill('#000000');page.locator('#stroke-color').fill('#ffffff');page.locator('#font-size').fill('50')
    with page.expect_download() as dl:page.locator('#save-button').click()
    dl.value.save_as(tmp/'project.zip')
    with zipfile.ZipFile(tmp/'project.zip') as z:
        data=json.loads(z.read('project.json'));box=data['pages'][0]['boxes'][0];patch=box['artPatch'];assert box['mode']=='art' and box['strokeColor']=='#ffffff'
        assert 'canvas' not in patch and 'mask' not in patch
        repaired=Image.open(io.BytesIO(z.read(patch['path']))).convert('RGB');mask=Image.open(io.BytesIO(z.read(patch['maskPath']))).convert('L')
        bounds=(patch['x'],patch['y'],patch['x']+patch['w'],patch['y']+patch['h'])
        source=original.crop(bounds);truth=background.crop(bounds)
        outside=ImageChops.difference(repaired,source);outside.paste('black',(0,0),mask)
        assert outside.getbbox() is None,'Pixels outside the explicit mask changed'
        before=sum(ImageStat.Stat(ImageChops.difference(source,truth),mask).sum2)
        after=sum(ImageStat.Stat(ImageChops.difference(repaired,truth),mask).sum2)
        assert after<before*.2,(before,after)
        print(f'Repair squared-error ratio: {after/before:.4f}',flush=True)
    with page.expect_download() as dl:page.locator('#export-button').click()
    dl.value.save_as(tmp/'translated.zip')
    with zipfile.ZipFile(tmp/'translated.zip') as z:
        result=Image.open(io.BytesIO(z.read('001-vi.png'))).convert('RGB')
        assert result.getpixel((patch['x']+2,patch['y']+2))==original.getpixel((patch['x']+2,patch['y']+2))
        assert ImageChops.difference(result,original).getbbox() is not None
    page.locator('#clear-button').click();page.locator('#project-input').set_input_files(str(tmp/'project.zip'))
    page.wait_for_function("document.querySelector('#status').textContent.includes('Đã mở dự án 1 trang')")
    page.locator('.bubble-item').first.click()
    assert page.locator('#box-mode').input_value()=='art';assert page.locator('#art-undo').is_enabled()
    assert page.locator('#translated-text').input_value()=='CHÀO THẾ GIỚI'
    page.locator('#art-undo').click();assert page.locator('#art-undo').is_disabled()
    page.locator('#original-toggle').check()
    import base64
    raw=page.locator('#editor').evaluate("canvas=>canvas.toDataURL('image/png').split(',')[1]")
    restored=Image.open(io.BytesIO(base64.b64decode(raw))).convert('RGB')
    assert ImageChops.difference(restored,original).getbbox() is None,'Original was mutated'
    assert not errors,errors
    browser.close();print('PASS: local OpenCV inpainting, mask-only changes, improved gradient repair, outlined OCR, styled export, mask/patch project round-trip, original recovery.')
