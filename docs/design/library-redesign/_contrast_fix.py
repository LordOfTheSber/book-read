"""Подтяжка контраста до WCAG AA.

Цвет текста и цвет заливки разведены: у текста порог 4.5:1, у значков и полос — 3:1,
поэтому золотая звезда остаётся золотой, а подпись рядом с ней темнеет.
"""
import glob, re

# Текстовые цвета: заменяем только там, где цвет применён к тексту.
TEXT = {
    # прежний стиль
    '#52c41a': '#378311', '#389e0d': '#2F850B', '#d46b08': '#B05907', '#fa8c16': '#A75E0F',
    '#1677ff': '#1368DE', '#eb2f96': '#CA2881', '#13c2c2': '#0C7E7E', '#08979c': '#077F83',
    '#fa541c': '#C54216', '#d4380d': '#CE360D', '#faad14': '#986A0C', '#d48806': '#9F6604',
    '#ff4d4f': '#C93D3E',
    # бренд
}

# Прозрачности текста и значков — общая замена, порядок важен.
ALPHA = [
    ('rgba(0,0,0,0.45)', 'rgba(0,0,0,0.55)'),
    ('rgba(0,0,0,0.25)', 'rgba(0,0,0,0.42)'),
]

def fix(src):
    for old, new in ALPHA:
        src = src.replace(old, new)
    for old, new in TEXT.items():
        # текст в inline-стилях
        src = src.replace('color: ' + old, 'color: ' + new)
        # значения-цвета текста в данных: fg, sFg, kFg, cFg, hintColor, deltaColor…
        src = re.sub(r"((?:[A-Za-z]*[Ff]g|color|hintColor|deltaColor)\s*:\s*)'" + re.escape(old) + r"'",
                     lambda m: m.group(1) + "'" + new + "'", src)
    return src

if __name__ == '__main__':
    n = 0
    for path in sorted(glob.glob('*.dc.html')):
        src = open(path, encoding='utf-8').read()
        out = fix(src)
        if out != src:
            open(path, 'w', encoding='utf-8').write(out)
            n += 1
    print('обновлено файлов:', n)
