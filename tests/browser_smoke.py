"""Real browser checks, including local Tesseract OCR; no live translation key required."""
import io
import json
import os
from pathlib import Path
import tempfile
import zipfile

from PIL import Image, ImageDraw, ImageFont, ImageChops
from playwright.sync_api import sync_playwright

BASE = os.environ.get('TEST_BASE_URL', 'http://127.0.0.1:5173/')

with tempfile.TemporaryDirectory() as tmp, sync_playwright() as p:
    tmp = Path(tmp)
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 36)
    image = Image.new('RGB', (900, 1000), 'white')
    draw = ImageDraw.Draw(image)
    draw.ellipse((80, 60, 820, 410), outline='black', width=4)
    draw.multiline_text((180, 180), 'HELLO GRANDFATHER\nTHIS IS MY BEST DISH', font=font, fill='black', spacing=20)
    draw.rectangle((80, 470, 820, 940), outline='black', width=4)
    draw.text((210, 650), 'PLEASE TRY IT', font=font, fill='black')
    for name in ['10.png', '2.png']:
        image.save(tmp / name)
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1440, 'height': 1080}, accept_downloads=True)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('dialog', lambda dialog: dialog.accept())
    page.goto(BASE)
    page.screenshot(path=str(tmp / 'empty-desktop.png'), full_page=True)
    page.locator('#image-input').set_input_files([str(tmp / '10.png'), str(tmp / '2.png')])
    page.wait_for_function("document.querySelector('#status').textContent.includes('Đã nhập 2 trang')")
    assert '2.png' in page.locator('.page-card').first.inner_text()
    # Stopping OCR must unlock the editor even while the worker is still starting.
    page.locator('#ocr-button').click()
    page.locator('#cancel-button').click()
    page.wait_for_function("!document.body.classList.contains('busy')", timeout=5000)
    assert 'Đã dừng' in page.locator('#status').inner_text()
    page.locator('#ocr-button').click()
    page.wait_for_function("document.querySelector('#status').textContent.includes('OCR xong') || document.querySelector('#status').classList.contains('error')", timeout=120000)
    assert 'OCR xong' in page.locator('#status').inner_text(), page.locator('#status').inner_text()
    assert page.locator('.bubble-item').count() > 0
    page.locator('.bubble-item').first.click()
    assert 'HELLO' in page.locator('#source-text').input_value().upper(), page.locator('#source-text').input_value()

    # Mock only Gemini: actual image decoding, OCR worker, WASM, ZIP and canvas run normally.
    calls = []
    def translate(route):
        body = route.request.post_data_json
        assert route.request.headers['x-goog-api-key'] == 'not-a-real-key'
        assert 'inlineData' not in json.dumps(body)
        rows = json.loads(body['contents'][0]['parts'][0]['text'])
        calls.append(rows)
        text = json.dumps({'translations': [{'id': r['id'], 'translated': 'Xin chào ông!'} for r in rows]})
        route.fulfill(json={'candidates': [{'finishReason': 'STOP', 'content': {'parts': [{'text': text}]}}]})
    page.route('https://generativelanguage.googleapis.com/**', translate)
    page.locator('#api-settings').evaluate('(el) => el.open = true')
    page.locator('#api-key').fill('not-a-real-key')
    page.locator('#translate-button').click()
    page.wait_for_function("document.querySelector('#status').textContent.includes('Đã dịch')")
    assert calls
    assert page.locator('#translated-text').input_value() == 'Xin chào ông!'

    # Unknown IDs must fail atomically, leaving previous translation intact.
    (tmp / 'bad.json').write_text(json.dumps({'translations':[{'id':'foreign','translated':'Sai chương'}]}))
    page.locator('#translation-input').set_input_files(str(tmp / 'bad.json'))
    page.wait_for_function("document.querySelector('#status').textContent.includes('ID không thuộc')")
    assert page.locator('#translated-text').input_value() == 'Xin chào ông!'

    # Reject overflowing translations rather than silently exporting cropped dialogue.
    # Use a deliberately small hand-drawn box: a recognizer may group a whole panel.
    rectangle = page.locator('#editor').bounding_box()
    x = rectangle['x'] + rectangle['width'] * .02
    y = rectangle['y'] + rectangle['height'] * .02
    page.mouse.move(x, y)
    page.mouse.down()
    page.mouse.move(x + rectangle['width'] * .05, y + rectangle['height'] * .05)
    page.mouse.up()
    page.locator('#translated-text').fill('Một lời thoại quá dài. ' * 100)
    page.locator('#export-button').click()
    page.wait_for_function("document.querySelector('#status').textContent.includes('bị tràn chữ')")
    page.locator('#delete-bubble').click()
    page.locator('.bubble-item').first.click()
    page.locator('#translated-text').fill('Cháu chào ông!')
    with page.expect_download() as download:
        page.locator('#save-button').click()
    project_path = tmp / 'project.zip'
    download.value.save_as(project_path)
    with zipfile.ZipFile(project_path) as project:
        meta = json.loads(project.read('project.json'))
        assert len(meta['pages']) == 2
        assert 'not-a-real-key' not in project.read('project.json').decode()
        assert meta['pages'][0]['boxes'][0]['translated'] == 'Cháu chào ông!'
    page.locator('#clear-button').click()
    assert page.locator('.page-card').count() == 0
    page.locator('#project-input').set_input_files(str(project_path))
    page.wait_for_function("document.querySelector('#status').textContent.includes('Đã mở dự án')")
    assert page.locator('.page-card').count() == 2
    page.locator('.bubble-item').first.click()
    assert page.locator('#translated-text').input_value() == 'Cháu chào ông!'
    with page.expect_download() as download:
        page.locator('#export-button').click()
    output_path = tmp / 'output.zip'
    download.value.save_as(output_path)
    with zipfile.ZipFile(output_path) as output:
        assert output.namelist() == ['001-vi.png', '002-vi.png']
        exported = Image.open(io.BytesIO(output.read('001-vi.png'))).convert('RGB')
        assert exported.size == image.size
        assert ImageChops.difference(image, exported).getbbox() is not None
        assert not any(g > r + 20 and g > b + 10 for r, g, b in exported.getdata()), 'Editor selection marks leaked into exported PNG'
        outside = ImageChops.difference(image, exported)
        d = ImageDraw.Draw(outside)
        for box in meta['pages'][0]['boxes']:
            d.rectangle((int(box['x'])-1,int(box['y'])-1,int(box['x']+box['w'])+1,int(box['y']+box['h'])+1),fill='black')
        assert outside.getbbox() is None, 'Artwork outside dialogue boxes was modified'

    # A rejected provider response must keep translations blank and expose an actionable message.
    page.locator('#translated-text').fill('')
    page.unroute('https://generativelanguage.googleapis.com/**')
    page.route('https://generativelanguage.googleapis.com/**', lambda route: route.fulfill(status=429, json={'error': {'message': 'quota'}}))
    page.locator('#translate-button').click()
    page.wait_for_function("document.querySelector('#status').textContent.includes('hạn mức')")
    assert page.locator('#translated-text').input_value() == ''
    page.locator('#translated-text').fill('Cháu chào ông!')
    page.screenshot(path='/tmp/xuong-dich-desktop.png', full_page=True)
    page.set_viewport_size({'width':390,'height':844})
    page.screenshot(path='/tmp/xuong-dich-mobile.png', full_page=True)
    assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), 'Mobile viewport overflows'
    assert not errors, errors
    browser.close()
    print('PASS: image import/sort, real OCR, translation request, invalid JSON, overflow guard, project round-trip, PNG ZIP/pixels, API quota handling, mobile layout, no page errors.')
