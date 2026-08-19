"""Перекраска макетов в фирменный стиль.

Геометрия не меняется — только токены: цвета, шрифт заголовков, знак и заглушки обложек.
Порядок замен важен: сначала самые узкие правила, потом общие.
"""
import re
import sys

# --- 1. Контекстные правила (до общей замены синего) ---
CONTEXT = [
    # Полосы прогресса и заливки-«чипсы» получают закладку, а не чернила.
    ('border-radius: 999px; background: #2563eb', 'border-radius: 999px; background: #C8552F'),
    ('background: #2563eb; position: relative', 'background: #C8552F; position: relative'),  # переключатели
    ('color: #2563eb', 'color: #C8552F'),
    ('stroke="#2563eb"', 'stroke="#C8552F"'),
    ('fill="#2563eb"', 'fill="#C8552F"'),
    ('border: 1px solid #2563eb', 'border: 1px solid #C8552F'),
    ('border: 2px solid #2563eb', 'border: 2px solid #C8552F'),
    ('box-shadow: inset 0 -2px 0 #2563eb', 'box-shadow: inset 0 -2px 0 #C8552F'),
    ('stroke="#52c41a"', 'stroke="#3C7A5A"'),
]

# --- 2. Общая карта токенов ---
COLORS = [
    # каркас
    ('#f6f7f9', '#FBF8F3'), ('#eaecf0', '#E7E0D4'), ('#d9d9d9', '#D9CFC0'),
    ('#f2f3f5', '#F0EAE0'), ('#f0f0f0', '#F0EAE0'), ('#e0e2e6', '#DED7CB'),
    ('#f5f5f5', '#F1EDE6'), ('#e8e8e8', '#E4DED4'),
    # основной
    ('#2563eb', '#1B2A4A'), ('#1d4ed8', '#A8421F'), ('#eff4ff', '#F7EAE4'),
    ('#bfd4fb', '#E8C9BC'), ('rgba(37,99,235,', 'rgba(27,42,74,'),
    # ряд для графиков — от закладки
    ('#dbe7fd', '#F2DFD6'), ('#a8c4f8', '#E0B49F'), ('#5b8ef0', '#D07A52'),
    # статусы
    ('#52c41a', '#3C7A5A'), ('#389e0d', '#2F6147'), ('#f6ffed', '#EAF0EA'), ('#d9f7be', '#D8E6D4'),
    ('#faad14', '#B8862B'), ('#d48806', '#8A6D1F'), ('#d46b08', '#96651C'), ('#8c4a00', '#7A5416'),
    ('#fff7e6', '#FBF1DF'), ('#ffe7ba', '#F2E2C4'), ('#fffbe6', '#FAF6E4'), ('#fff1b8', '#F1E9C6'),
    ('#ff4d4f', '#9E2B2B'), ('#cf1322', '#8A2323'), ('#fff2f0', '#F9EDEA'), ('#ffccc7', '#E7CFCB'),
    ('#fff7f6', '#FCF4F2'), ('#ffe1de', '#F0DCD7'), ('#fff1f0', '#F9EDEA'),
    ('rgba(250,84,28,0.85)', 'rgba(200,85,47,0.85)'),
    # цвета видов произведения
    ('#e6f4ff', '#EDEFF4'), ('#bae0ff', '#DDE1EA'), ('#0958d9', '#1B2A4A'), ('#1677ff', '#2E4472'),
    ('#e6fffb', '#E6F0EF'), ('#b5f5ec', '#CFE4E1'), ('#08979c', '#2E7D74'), ('#13c2c2', '#3A968C'),
    ('#fff0f6', '#F5E8EE'), ('#ffd6e7', '#EBD3DE'), ('#c41d7f', '#A6446B'), ('#eb2f96', '#B85480'),
    ('#f9f0ff', '#F0EBF5'), ('#efdbff', '#E1D7EC'), ('#531dab', '#6B4EA6'), ('#722ed1', '#7E62B8'),
    ('#fff2e8', '#F7EBE3'), ('#ffd8bf', '#EDD6C6'), ('#d4380d', '#B4552A'), ('#fa541c', '#C4653A'),
    ('#fa8c16', '#B8862B'), ('#f0f5ff', '#EBEFF7'), ('#d6e4ff', '#D8DFEE'),
    ('#1d39c4', '#3C5BA6'), ('#2f54eb', '#4A6AB5'), ('#f97316', '#C4653A'),
    ('#ec4899', '#A6446B'), ('#f59e0b', '#B8862B'), ('#22c55e', '#3C7A5A'),
    # тёмная тема внутри макетов
    ('#0f1115', '#101728'), ('#171a21', '#141C2E'), ('#1d212a', '#1E2940'),
    # текст — из чёрного в чернильный
    ('rgba(0,0,0,0.88)', '#17202E'), ('rgba(0,0,0,0.80)', 'rgba(23,32,46,0.78)'),
    ('rgba(0,0,0,0.65)', 'rgba(23,32,46,0.62)'), ('rgba(0,0,0,0.45)', 'rgba(23,32,46,0.42)'),
    ('rgba(0,0,0,0.25)', 'rgba(23,32,46,0.28)'), ('rgba(0,0,0,0.20)', 'rgba(23,32,46,0.22)'),
    ('rgba(0,0,0,0.15)', 'rgba(23,32,46,0.16)'), ('rgba(0,0,0,0.12)', 'rgba(23,32,46,0.13)'),
    ('rgba(0,0,0,0.10)', 'rgba(23,32,46,0.11)'), ('rgba(0,0,0,0.08)', 'rgba(23,32,46,0.09)'),
    ('rgba(0,0,0,0.07)', 'rgba(23,32,46,0.08)'), ('rgba(0,0,0,0.06)', 'rgba(23,32,46,0.07)'),
    ('rgba(0,0,0,0.05)', 'rgba(23,32,46,0.06)'), ('rgba(0,0,0,0.04)', 'rgba(23,32,46,0.05)'),
    ('rgba(0,0,0,0.03)', 'rgba(23,32,46,0.04)'), ('rgba(0,0,0,0.02)', 'rgba(23,32,46,0.03)'),
    ('rgba(0,0,0,0.01)', 'rgba(23,32,46,0.02)'),
    ('rgba(16,24,40,', 'rgba(27,42,74,'),
    ('rgba(255,255,255,0.94)', 'rgba(251,248,243,0.94)'),
    ('rgba(255,255,255,0.92)', 'rgba(251,248,243,0.92)'),
    ('rgba(255,255,255,0.75)', 'rgba(251,248,243,0.6)'),
    ('#ffffff', '#FFFFFF'),
]

MARK = ('<svg width="{s}" height="{s}" viewBox="0 0 64 64" aria-label="BookRead">'
        '<rect x="10" y="8" width="44" height="48" rx="9" fill="#1B2A4A"></rect>'
        '<rect x="18" y="8" width="3" height="48" fill="#FBF8F3" opacity="0.22"></rect>'
        '<path d="M34 8h11v40l-5.5-6.5L34 48z" fill="#C8552F"></path></svg>')

FONT_LINK = ('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?'
             'family=Literata:opsz,wght@7..72,400;7..72,600;7..72,700&'
             'family=Inter:wght@400;500;600;700&display=swap">')

LIT_RULE = "    .lit { font-family: 'Literata', Georgia, 'Times New Roman', serif; letter-spacing: -0.2px; }\n"


def restyle(src: str) -> str:
    out = src

    # Шрифты: Literata приезжает вместе с Inter, интерфейс остаётся на Inter.
    out = re.sub(r'<link rel="stylesheet" href="https://fonts\.googleapis\.com[^>]*>', FONT_LINK, out)
    out = out.replace("    a { color: #2563eb;", "    a { color: #C8552F;")
    out = out.replace('    svg { display: block; }\n', '    svg { display: block; }\n' + LIT_RULE)

    for a, b in CONTEXT:
        out = out.replace(a, b)
    for a, b in COLORS:
        out = out.replace(a, b)

    # Заглушка обложки: градиент уступает бумажной плашке (первый тон пары).
    out = re.sub(r"linear-gradient\(150deg,\s*([#\w]+)\s*0%,\s*[#\w]+\s*100%\)", r"\1", out)
    # То же для градиентов, которые собираются в JS конкатенацией.
    out = re.sub(r"linear-gradient\(150deg, ' \+ ([\w\[\]0-9.]+) \+ ' 0%, ' \+ [\w\[\]0-9.]+ \+ ' 100%\)",
                 r"' + \1 + '", out)

    # Знак в шапке — новый.
    def swap_mark(m):
        return MARK.format(s=m.group(1))
    out = re.sub(
        r'<div style="width: (\d+)px; height: \d+px; border-radius: \d+px; background: #1B2A4A;'
        r' display: flex; align-items: center; justify-content: center; color: #FFFFFF;">\s*'
        r'<svg[^>]*>.*?</svg>\s*</div>',
        swap_mark, out, flags=re.S)

    # Крупные полужирные подписи набираются Literata.
    def add_lit(m):
        tag, attrs, style = m.group(1), m.group(2), m.group(3)
        if 'class=' in attrs:
            return m.group(0)
        size = re.search(r'font-size: (\d+)px', style)
        weight = re.search(r'font-weight: (\d+)', style)
        if size and weight and int(size.group(1)) >= 16 and int(weight.group(1)) >= 600:
            return '<%s class="lit"%sstyle="%s"' % (tag, attrs, style)
        return m.group(0)
    out = re.sub(r'<(div|span|h1|h2|h3)((?:\s+(?!style=)[\w-]+="[^"]*")*\s+)style="([^"]*)"', add_lit, out)

    return out


if __name__ == '__main__':
    for path in sys.argv[1:]:
        stem = path[:-len('.dc.html')]
        dst = stem + 'Brand.dc.html'
        open(dst, 'w', encoding='utf-8').write(restyle(open(path, encoding='utf-8').read()))
        print(dst)
