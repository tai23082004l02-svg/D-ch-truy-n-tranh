"""Exercise actual editor mutations, keyboard routing and deleted-resource restoration."""
import os,tempfile
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright
with tempfile.TemporaryDirectory() as tmp,sync_playwright() as p:
    image=Path(tmp)/'page.png';Image.new('RGB',(600,600),'white').save(image)
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':1000});errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
    page.goto(os.environ.get('TEST_BASE_URL','http://127.0.0.1:5173/'))
    page.locator('#image-input').set_input_files(str(image))
    page.wait_for_function("!document.querySelector('#editor').hidden")
    r=page.locator('#editor').bounding_box()
    page.mouse.move(r['x']+r['width']*.2,r['y']+r['height']*.2);page.mouse.down();page.mouse.move(r['x']+r['width']*.6,r['y']+r['height']*.5);page.mouse.up()
    assert page.locator('.bubble-item').count()==1
    page.locator('#translated-text').fill('Xin chào')
    page.locator('#translated-text').press('Control+z')
    assert page.locator('#translated-text').input_value()==''
    page.locator('#translated-text').fill('Bản dịch được giữ')
    page.locator('#delete-bubble').click();assert page.locator('.bubble-item').count()==0
    page.locator('#undo-button').click();assert page.locator('.bubble-item').count()==1
    page.locator('.bubble-item').click();assert page.locator('#translated-text').input_value()=='Bản dịch được giữ'
    page.locator('#box-mode').select_option('art')
    page.locator('#art-edit').click()
    r=page.locator('#art-mask-canvas').bounding_box()
    page.mouse.move(r['x']+r['width']*.3,r['y']+r['height']*.3);page.mouse.down();page.mouse.move(r['x']+r['width']*.5,r['y']+r['height']*.5);page.mouse.up()
    assert not page.locator('#art-mask-count').inner_text().startswith('Mặt nạ: 0.0%')
    page.locator('#art-mask-undo').click();assert '0.0%' in page.locator('#art-mask-count').inner_text()
    page.mouse.move(r['x']+r['width']*.3,r['y']+r['height']*.3);page.mouse.down();page.mouse.move(r['x']+r['width']*.5,r['y']+r['height']*.5);page.mouse.up()
    page.locator('#art-clear-mask').click();assert '0.0%' in page.locator('#art-mask-count').inner_text()
    page.locator('#art-clear-mask').press('Control+z');assert not page.locator('#art-mask-count').inner_text().startswith('Mặt nạ: 0.0%')
    page.locator('#art-close').click()
    page.locator('#delete-page').click();assert page.locator('.page-card').count()==0
    page.locator('#undo-button').click();page.wait_for_function("!document.querySelector('#editor').hidden")
    assert page.locator('.page-card').count()==1;assert page.locator('.bubble-item').count()==1
    page.locator('#clear-button').click();assert page.locator('.page-card').count()==0
    page.locator('#undo-button').click();page.wait_for_function("!document.querySelector('#editor').hidden")
    assert page.locator('.bubble-item').count()==1
    assert not errors,errors
    browser.close()
print('PASS: typing Ctrl+Z, delete bubble/page/chapter undo, image URL restoration, no browser errors')
