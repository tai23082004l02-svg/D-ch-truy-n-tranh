export const LIMITS = { pages: 100, fileBytes: 30 * 1024 ** 2, totalBytes: 250 * 1024 ** 2, pixels: 24_000_000, boxes: 1000 };

export function naturalCompare(a, b) { return a.localeCompare(b, 'vi', { numeric: true, sensitivity: 'base' }); }

export function validateBox(raw, width, height) {
  if (!raw || !['x', 'y', 'w', 'h'].every(k => Number.isFinite(raw[k]))) throw new Error('Tọa độ ô thoại không hợp lệ.');
  if (raw.w < 4 || raw.h < 4 || raw.x < 0 || raw.y < 0 || raw.x + raw.w > width + 1 || raw.y + raw.h > height + 1) throw new Error('Ô thoại nằm ngoài ảnh hoặc quá nhỏ.');
  const text = key => typeof raw[key] === 'string' ? raw[key].slice(0, 10000) : '';
  return { id: typeof raw.id === 'string' && /^[\w-]{1,80}$/.test(raw.id) ? raw.id : crypto.randomUUID(), x: raw.x, y: raw.y, w: Math.min(raw.w, width - raw.x), h: Math.min(raw.h, height - raw.y), source: text('source'), translated: text('translated'), fontSize: Math.max(8, Math.min(160, Number(raw.fontSize) || 32)), background: /^#[0-9a-f]{6}$/i.test(raw.background) ? raw.background : '#ffffff', bold: raw.bold !== false };
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
  const pad = Math.max(3, Math.min(10, box.w * .04, box.h * .04));
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
  if (!box.translated.trim()) return null;
  ctx.save();
  ctx.beginPath(); ctx.rect(box.x, box.y, box.w, box.h); ctx.clip();
  ctx.fillStyle = box.background; ctx.fillRect(box.x, box.y, box.w, box.h);
  const layout = fitText(ctx, box);
  ctx.fillStyle = '#151515'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const lineHeight = layout.size * 1.25;
  const top = box.y + (box.h - lineHeight * layout.lines.length) / 2 + lineHeight / 2;
  layout.lines.forEach((line, i) => ctx.fillText(line, box.x + box.w / 2, top + i * lineHeight));
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

export function ocrBoxes(data, width, height, makeId = () => crypto.randomUUID()) {
  // Tesseract can put distant speech bubbles in a single paragraph. Split by
  // actual line geometry so the white mask does not wipe the artwork between them.
  const groups = [];
  for (const paragraph of data.paragraphs || []) {
    const lines = (paragraph.lines?.length ? paragraph.lines : [paragraph]).filter(line => line.text?.trim() && line.confidence >= 30 && line.bbox.x1-line.bbox.x0>=4 && line.bbox.y1-line.bbox.y0>=4).sort((a,b)=>a.bbox.y0-b.bbox.y0 || a.bbox.x0-b.bbox.x0);
    const local = [];
    for (const line of lines) {
      const b = line.bbox, lineHeight = b.y1-b.y0;
      const target = [...local].reverse().find(group => {
        const previous = group.last, gap = b.y0-previous.y1;
        const overlap = Math.min(b.x1,previous.x1)-Math.max(b.x0,previous.x0);
        return gap >= -Math.min(lineHeight,previous.y1-previous.y0)*.4 && gap <= Math.max(lineHeight,previous.y1-previous.y0)*1.2 && overlap > Math.min(b.x1-b.x0,previous.x1-previous.x0)*.15;
      });
      if (target) { target.text += '\n'+line.text.trim(); target.bbox = {x0:Math.min(target.bbox.x0,b.x0),y0:Math.min(target.bbox.y0,b.y0),x1:Math.max(target.bbox.x1,b.x1),y1:Math.max(target.bbox.y1,b.y1)}; target.last=b; }
      else local.push({text:line.text.trim(),bbox:{...b},last:b,lineHeight});
    }
    groups.push(...local);
  }
  return groups.slice(0,LIMITS.boxes).map(group => {
    const b=group.bbox, x=Math.max(0,b.x0-6), y=Math.max(0,b.y0-6);
    return validateBox({id:makeId(),x,y,w:Math.min(width,b.x1+6)-x,h:Math.min(height,b.y1+6)-y,source:group.text,translated:'',fontSize:Math.max(16,Math.min(48,group.lineHeight)),background:'#ffffff',bold:true},width,height);
  });
}
