"""Проверка макетов: формат Design Components, контраст и единообразие шкалы."""
import json, re, sys, glob, collections

# ---------- контраст ----------
def srgb(c):
    c = c / 255
    return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4

def lum(rgb):
    r, g, b = rgb
    return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b)

def hex2rgb(h):
    h = h.lstrip('#')
    if len(h) == 3:
        h = ''.join(ch * 2 for ch in h)
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))

def over(fg, alpha, bg):
    return tuple(round(fg[i] * alpha + bg[i] * (1 - alpha)) for i in range(3))

def ratio(a, b):
    la, lb = lum(a), lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)

def parse(color, bg):
    m = re.match(r'rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)', color)
    if m:
        return over((int(m.group(1)), int(m.group(2)), int(m.group(3))), float(m.group(4)), bg)
    return hex2rgb(color)

PAIRS = [
    ('прежний · вторичный текст на белом', 'rgba(0,0,0,0.65)', '#ffffff', 13),
    ('прежний · третичный текст на белом', 'rgba(0,0,0,0.55)', '#ffffff', 12),
    ('прежний · третичный на сером фоне', 'rgba(0,0,0,0.55)', '#f6f7f9', 12),
    ('прежний · значки-действия', 'rgba(0,0,0,0.42)', '#ffffff', 18),
    ('прежний · ссылка на белом', '#2563eb', '#ffffff', 13),
    ('прежний · белый на синей кнопке', '#ffffff', '#2563eb', 14),
    ('прежний · зелёный статус', '#378311', '#f6ffed', 12),
    ('прежний · оранжевый статус', '#B05907', '#fff7e6', 12),
    ('прежний · красный статус', '#cf1322', '#fff2f0', 12),
    ('прежний · синий тег', '#1368DE', '#e6f4ff', 12),
    ('прежний · бирюзовый тег', '#0C7E7E', '#e6fffb', 12),
    ('прежний · золотой тег', '#9F6604', '#fffbe6', 12),
    ('бренд · вторичный текст', 'rgba(23,32,46,0.78)', '#FFFFFF', 13),
    ('бренд · третичный текст', 'rgba(23,32,46,0.62)', '#FFFFFF', 12),
    ('бренд · третичный на бумаге', 'rgba(23,32,46,0.62)', '#FBF8F3', 12),
    ('бренд · значки-действия', 'rgba(23,32,46,0.50)', '#FFFFFF', 18),
    ('бренд · закладка-текст на белом', '#B04B29', '#FFFFFF', 13),
    ('бренд · закладка-текст на плашке', '#B04B29', '#F7EAE4', 13),
    ('бренд · бумага на чернилах', '#FBF8F3', '#1B2A4A', 14),
    ('бренд · мох на светлом', '#3A7657', '#EAF0EA', 12),
    ('бренд · охра на светлом', '#94641C', '#FBF1DF', 12),
    ('бренд · сургуч на светлом', '#8A2323', '#F9EDEA', 12),
    ('бренд · чернила-тег', '#2E4472', '#EDEFF4', 12),
    ('бренд · бирюза-тег', '#2C776E', '#E6F0EF', 12),
    ('бренд · пурпур-тег', '#A44B72', '#F5E8EE', 12),
]

def contrast_report():
    rows = []
    for label, fg, bg, size in PAIRS:
        bgrgb = hex2rgb(bg)
        r = ratio(parse(fg, bgrgb), bgrgb)
        need = 3.0 if size >= 18 else 4.5
        rows.append((label, fg, bg, size, round(r, 2), need, r >= need))
    return rows

# ---------- формат ----------
def check_file(path):
    src = open(path, encoding='utf-8').read()
    problems = []

    if '<script src="./support.js"></script>' not in src:
        problems.append('нет строки support.js')

    # вложенные sc-for
    depth = 0
    for tok in re.findall(r'</?sc-for', src):
        depth += 1 if tok == '<sc-for' else -1
        if depth > 1:
            problems.append('вложенный sc-for')
            break

    for m in re.finditer(r'<sc-for(?![^>]*hint-placeholder-count)', src):
        problems.append('sc-for без hint-placeholder-count')
        break
    for m in re.finditer(r'<sc-if(?![^>]*hint-placeholder-val)', src):
        problems.append('sc-if без hint-placeholder-val')
        break

    # data-props парсится
    m = re.search(r"data-props='([^']*)'", src)
    if not m:
        problems.append('нет data-props')
    else:
        try:
            json.loads(m.group(1).replace('&amp;', '&').replace('&#39;', "'"))
        except Exception as e:
            problems.append('data-props не парсится: %s' % e)

    # дырки против renderVals
    body = src.split('<script data-dc-script')[0]
    aliases = set(re.findall(r'as="(\w+)"', body)) | {'$index', 'true', 'false'}
    holes = set(h.split('.')[0].strip() for h in re.findall(r'\{\{([^}]+)\}\}', body))
    logic = src.split('<script data-dc-script')[-1]
    rets = re.findall(r'return \{([^}]*)\};', logic)
    provided = set()
    for r in rets:  # берём все return, включая вложенные в map
        provided |= set(x.strip().split(':')[0].strip() for x in r.split(',') if x.strip())
    missing = holes - aliases - provided
    if missing:
        problems.append('дырки без значения: %s' % ', '.join(sorted(missing)))

    # баланс div
    if src.count('<div') != src.count('</div>'):
        problems.append('несовпадение <div> (%d) и </div> (%d)' % (src.count('<div'), src.count('</div>')))
    if src.count('<span') != src.count('</span>'):
        problems.append('несовпадение <span> (%d) и </span> (%d)' % (src.count('<span'), src.count('</span>')))

    return problems

def geometry_report():
    canvas = json.load(open('canvas.json', encoding='utf-8'))
    out = []
    for a in canvas['artboards']:
        src = open(a['file'], encoding='utf-8').read()
        m = re.search(r'width: (\d+)px; (?:background: [^;]+; )?min-height: (\d+)px', src)
        m2 = re.search(r'"\$preview":\{"width":(\d+),"height":(\d+)\}', src)
        w = int(m.group(1)) if m else None
        h = int(m.group(2)) if m else None
        pw = int(m2.group(1)) if m2 else None
        ph = int(m2.group(2)) if m2 else None
        if w and w != a['w']:
            out.append('%s: ширина корня %s ≠ рамки %s' % (a['file'], w, a['w']))
        if h and h != a['h']:
            out.append('%s: min-height %s ≠ рамки %s' % (a['file'], h, a['h']))
        if pw and (pw != a['w'] or ph != a['h']):
            out.append('%s: $preview %sx%s ≠ рамки %sx%s' % (a['file'], pw, ph, a['w'], a['h']))
    return out

def scale_report(files):
    radii, sizes, heights = collections.Counter(), collections.Counter(), collections.Counter()
    for f in files:
        src = open(f, encoding='utf-8').read()
        radii.update(re.findall(r'border-radius: (\d+)px', src))
        sizes.update(re.findall(r'font-size: (\d+)px', src))
        heights.update(re.findall(r'(?<!min-)height: (\d+)px', src))
    return radii, sizes, heights

if __name__ == '__main__':
    files = sorted(glob.glob('*.dc.html'))
    print('=== ФОРМАТ (%d макетов) ===' % len(files))
    bad = 0
    for f in files:
        p = check_file(f)
        if p:
            bad += 1
            print('  %-30s %s' % (f, '; '.join(p)))
    print('  чисто: %d из %d' % (len(files) - bad, len(files)))

    print()
    print('=== ГЕОМЕТРИЯ ===')
    g = geometry_report()
    print('\n'.join('  ' + x for x in g) if g else '  расхождений нет')

    print()
    print('=== КОНТРАСТ (WCAG AA) ===')
    for label, fg, bg, size, r, need, ok in contrast_report():
        print('  %-42s %5.2f  нужно %.1f  %s' % (label, r, need, 'ок' if ok else 'НЕ ПРОХОДИТ'))

    print()
    radii, sizes, heights = scale_report(files)
    print('=== ШКАЛА ===')
    print('  радиусы: ', ', '.join('%s×%d' % (k, v) for k, v in sorted(radii.items(), key=lambda x: -x[1])[:14]))
    print('  кегли:   ', ', '.join('%s×%d' % (k, v) for k, v in sorted(sizes.items(), key=lambda x: -x[1])[:14]))
    print('  высоты:  ', ', '.join('%s×%d' % (k, v) for k, v in sorted(heights.items(), key=lambda x: -x[1])[:14]))
