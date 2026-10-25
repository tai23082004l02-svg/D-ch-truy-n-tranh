"""Verify cleanup keeps a balloon contour that crosses the selected text rectangle."""
import io,json,os,tempfile,zipfile
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont,ImageChops
from playwright.sync_api import sync_playwright
with tempfile.TemporaryDirectory() as tmp,sync_playwright() as p:
    tmp=Path(tmp);original=Image.new('RGB',(600,600),'white');d=ImageDraw.Draw(original)
    d.ellipse((200,70,470,520),outline='black',width=4)
    font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',25)
    d.multiline_text((230,150),'HELLO\nPLEASE\nWAIT',font=font,fill='black',spacing=10)
    original.save(tmp/'balloon.png')
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':1000},accept_downloads=True);errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
    page.goto(os.environ.get('TEST_BASE_URL','http://127.0.0.1:5173/'))
    page.locator('#image-input').set_input_files(str(tmp/'balloon.png'));page.wait_for_function("!document.querySelector('#editor').hidden")
    r=page.locator('#editor').bounding_box()
    def xy(x,y):return r['x']+x*r['width']/600,r['y']+y*r['height']/600
    page.mouse.move(*xy(180,120));page.mouse.down();page.mouse.move(*xy(400,370));page.mouse.up()
    page.locator('#box-mode').select_option('clean');page.locator('#art-edit').click()
    assert page.locator('#art-dialog-title').inner_text()=='Xóa chữ, giữ viền ô thoại'
    page.locator('#art-preview-button').click();page.locator('#art-apply').click();page.wait_for_function("!document.querySelector('#art-dialog').open")
    # Before translation: cleaned patch visible and round-trips with its mask.
    with page.expect_download() as dl:page.locator('#save-button').click()
    dl.value.save_as(tmp/'project.zip')
    with zipfile.ZipFile(tmp/'project.zip') as z:
        data=json.loads(z.read('project.json'));box=data['pages'][0]['boxes'][0];assert box['mode']=='clean'
        patch=box['artPatch'];clean=Image.open(io.BytesIO(z.read(patch['path']))).convert('RGB');mask=Image.open(io.BytesIO(z.read(patch['maskPath']))).convert('L')
    x,y=patch['x'],patch['y'];crop=original.crop((x,y,x+clean.width,y+clean.height))
    changes=ImageChops.difference(crop,clean).convert('L')
    assert changes.getbbox() is not None
    assert sum(changes.getdata())>10000
    for yy in range(clean.height):
        for xx in range(clean.width):
            if not mask.getpixel((xx,yy)):assert crop.getpixel((xx,yy))==clean.getpixel((xx,yy))
    # Left balloon contour runs through this crop; it must remain unchanged.
    assert ImageChops.difference(crop.crop((0,0,45,250)),clean.crop((0,0,45,250))).getbbox() is None
    page.locator('#translated-text').fill('Xin chờ một chút')
    with page.expect_download() as dl:page.locator('#export-button').click()
    dl.value.save_as(tmp/'translated.zip')
    with zipfile.ZipFile(tmp/'translated.zip') as z:output=Image.open(io.BytesIO(z.read(next(n for n in z.namelist() if n.endswith('.png'))))).convert('RGB')
    for yy in range(120,370):
        for xx in range(180,225):
            if original.getpixel((xx,yy))==(0,0,0):assert output.getpixel((xx,yy))==(0,0,0)
    page.locator('#clear-button').click();page.locator('#project-input').set_input_files(str(tmp/'project.zip'))
    page.wait_for_function("document.querySelector('#status').textContent.includes('Đã mở dự án')")
    page.locator('.bubble-item').click();assert page.locator('#box-mode').input_value()=='clean';assert page.locator('#art-undo').is_enabled()
    assert not errors,errors
    browser.close()
print('PASS: white-balloon ink-only cleanup, preserved crossing contour, export and project round-trip')
