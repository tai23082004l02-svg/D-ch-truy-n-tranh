import os,tempfile,json,zipfile
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright
with tempfile.TemporaryDirectory() as tmp,sync_playwright() as p:
    tmp=Path(tmp);image=tmp/'page.png';Image.new('RGB',(600,600),'white').save(image)
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':1000},accept_downloads=True);errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
    page.goto(os.environ.get('TEST_BASE_URL','http://127.0.0.1:5173/'))
    page.locator('#image-input').set_input_files(str(image));page.wait_for_function("!document.querySelector('#editor').hidden")
    def xy(x,y):
        r=page.locator('#editor').bounding_box();return (r['x']+x*r['width']/600,r['y']+y*r['height']/600)
    def drag(a,b):
        page.mouse.move(*xy(*a));page.mouse.down();page.mouse.move(*xy(*b),steps=5);page.mouse.up()
    def box():
        with page.expect_download() as dl:page.locator('#save-button').click()
        dest=tmp/'project.zip';dl.value.save_as(dest)
        with zipfile.ZipFile(dest) as z:return json.loads(z.read('project.json'))['pages'][0]['boxes'][0]
    drag((100,100),(300,250));page.locator('#source-text').fill('Original');page.locator('#translated-text').fill('Bản dịch')
    drag((300,250),(400,320));b=box();assert abs(b['w']-300)<2 and abs(b['h']-220)<2,b
    assert b['source']=='Original' and b['translated']=='Bản dịch'
    page.locator('#undo-button').click();b=box();assert abs(b['w']-200)<2 and abs(b['h']-150)<2,b
    drag((200,180),(240,210));b=box();assert abs(b['x']-140)<2 and abs(b['y']-130)<2,b
    assert abs(b['w']-200)<2
    page.locator('#editor').focus();page.keyboard.press('Delete');assert page.locator('.bubble-item').count()==0
    page.keyboard.press('Control+z');assert page.locator('.bubble-item').count()==1
    page.locator('.bubble-item').click();page.locator('#translated-text').focus();page.keyboard.press('Delete');assert page.locator('.bubble-item').count()==1
    assert not errors,errors
    browser.close()
print('PASS: corner resize, move, preserved translation, Delete/typing protection and undo')
