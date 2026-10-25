export const LIMITS = { pages: 1000, fileBytes: 30 * 1024 ** 2, totalBytes: 250 * 1024 ** 2, pixels: 24_000_000, boxes: 1000 };

export function naturalCompare(a, b) { return a.localeCompare(b, 'vi', { numeric: true, sensitivity: 'base' }); }

export function validateBox(raw, width, height) {
  if (!raw || !['x', 'y', 'w', 'h'].every(k => Number.isFinite(raw[k]))) throw new Error('Tọa độ ô thoại không hợp lệ.');
  if (raw.w < 4 || raw.h < 4 || raw.x < 0 || raw.y < 0 || raw.x + raw.w > width + 1 || raw.y + raw.h > height + 1) throw new Error('Ô thoại nằm ngoài ảnh hoặc quá nhỏ.');
  const text = key => typeof raw[key] === 'string' ? raw[key].slice(0, 10000) : '';
  const mode=['art','clean'].includes(raw.mode)?raw.mode:'bubble',color=(value,fallback)=>/^#[0-9a-f]{6}$/i.test(value)?value:fallback;
  return { id: typeof raw.id === 'string' && /^[\w-]{1,80}$/.test(raw.id) ? raw.id : crypto.randomUUID(), x: raw.x, y: raw.y, w: Math.min(raw.w, width - raw.x), h: Math.min(raw.h, height - raw.y), source: text('source'), translated: text('translated'), fontSize: Math.max(8, Math.min(160, Number(raw.fontSize) || 32)), background: color(raw.background,'#ffffff'), bold: raw.bold !== false,mode,ocrInk:raw.ocrInk==='light'?'light':'dark',textColor:color(raw.textColor,mode==='art'?'#ffffff':'#151515'),strokeColor:color(raw.strokeColor,'#111111'),strokeWidth:Math.max(0,Math.min(10,raw.strokeWidth!==undefined&&Number.isFinite(Number(raw.strokeWidth))?Number(raw.strokeWidth):(mode==='art'?3:0))) };
}

export function wrapText(ctx, text, width) {
  const lines = [];
  for (const paragraph of text.replace(/\r/g, '').split('\n')) {
    let line = '';
    for (const word of paragraph.trim().split(/\s+/).filter(Boolean)) {
      if (ctx.measureText(word).width > width) {
        if (line) { lines.push(line); line = ''; }
        let part = '';
        for (const char of Array.from(word)) {
          if (part && ctx.measureText(part + char).width > width) { lines.push(part); part = ''; }
          part += char;
        }
        line = part;
      } else if (line && ctx.measureText(`${line} ${word}`).width > width) {
        lines.push(line); line = word;
      } else line = line ? `${line} ${word}` : word;
    }
    lines.push(line);
  }
  return lines;
}

export function fitText(ctx, box) {
  const pad = Math.max(3, Math.min(10, box.w * .04, box.h * .04),box.mode==='art'?(box.strokeWidth||0)/2+2:0);
  const width = Math.max(1, box.w - pad * 2), height = Math.max(1, box.h - pad * 2);
  let result;
  for (let size = Math.floor(box.fontSize); size >= 8; size--) {
    ctx.font = `${box.bold ? 700 : 400} ${size}px Arial, sans-serif`;
    const lines = wrapText(ctx, box.translated, width);
    const fits = lines.length * size * 1.25 <= height && lines.every(line => ctx.measureText(line).width <= width);
    result = { size, lines, pad, fits };
    if (fits) return result;
  }
  return result;
}

export function paintBox(ctx, box) {
  if(box.mode!=='bubble'&&box.artPatch?.canvas){const p=box.artPatch;ctx.drawImage(p.canvas,p.x,p.y,p.w,p.h);}
  if (!box.translated.trim()) return null;
  ctx.save();
  ctx.beginPath(); ctx.rect(box.x, box.y, box.w, box.h); ctx.clip();
  if(!['art','clean'].includes(box.mode)){ctx.fillStyle = box.background; ctx.fillRect(box.x, box.y, box.w, box.h);}
  const layout = fitText(ctx, box);
  ctx.fillStyle = box.textColor||'#151515'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.strokeStyle=box.strokeColor||'#111111';ctx.lineWidth=box.strokeWidth||0;ctx.lineJoin='round';
  const lineHeight = layout.size * 1.25;
  const top = box.y + (box.h - lineHeight * layout.lines.length) / 2 + lineHeight / 2;
  layout.lines.forEach((line, i) => {const x=box.x+box.w/2,y=top+i*lineHeight;if(box.mode==='art'&&box.strokeWidth>0)ctx.strokeText(line,x,y);ctx.fillText(line,x,y);});
  // Put protected contour pixels above the new text as well, so antialiased
  // Vietnamese glyphs cannot lighten a black balloon border they overlap.
  if(box.mode==='clean'&&box.artPatch?.canvas){
    const p=box.artPatch;
    if(!p.contourCanvas){
      const layer=document.createElement('canvas');layer.width=p.w;layer.height=p.h;
      const g=layer.getContext('2d');g.drawImage(p.canvas,0,0,p.w,p.h);const pixels=g.getImageData(0,0,p.w,p.h);
      for(let i=0;i<p.w*p.h;i++)if(p.mask?.[i]||Math.min(pixels.data[i*4],pixels.data[i*4+1],pixels.data[i*4+2])>=245)pixels.data[i*4+3]=0;
      g.putImageData(pixels,0,0);p.contourCanvas=layer;
    }
    ctx.drawImage(p.contourCanvas,p.x,p.y,p.w,p.h);
  }
  ctx.restore();
  return layout;
}

export function parseTranslations(input, expectedIds) {
  let data = input;
  if (typeof data === 'string') {
    data = data.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    try { data = JSON.parse(data); } catch { throw new Error('Kết quả không phải JSON hợp lệ.'); }
  }
  const rows = Array.isArray(data) ? data : data?.translations;
  if (!Array.isArray(rows)) throw new Error('JSON cần có mảng translations gồm id và translated.');
  const result = new Map();
  for (const row of rows) {
    if (!row || typeof row.id !== 'string' || typeof row.translated !== 'string' || !row.translated.trim() || row.translated.length > 10000) throw new Error('Mỗi bản dịch cần id và translated không rỗng (tối đa 10.000 ký tự).');
    if (!expectedIds.has(row.id)) throw new Error(`ID không thuộc chương này: ${row.id.slice(0, 80)}`);
    if (result.has(row.id)) throw new Error('JSON có ID trùng lặp.');
    result.set(row.id, row.translated.trim());
  }
  if (!result.size) throw new Error('Không có bản dịch để nhập.');
  return result;
}
