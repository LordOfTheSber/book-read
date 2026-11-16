"""Сведение радиусов, кеглей и высот к шкале.

Высоты правятся выборочно: 34 и 36 оставлены двумя ступенями намеренно — их 559 штук,
и рост на 2 px внутри телефонных рамок фиксированной высоты может обрезать содержимое.
"""
import glob, re

RADII = {2: 4, 3: 4, 5: 6, 7: 8, 9: 10, 11: 12, 13: 12, 15: 16}
SIZES = {9: 11, 10: 11, 15: 14, 17: 16, 19: 18, 21: 20, 22: 20, 23: 24, 26: 24, 28: 30, 32: 30}
HEIGHTS = {30: 32, 38: 40, 42: 44, 46: 48, 50: 48}

def apply(src):
    src = re.sub(r'border-radius: (\d+)px', lambda m: 'border-radius: %dpx' % RADII.get(int(m.group(1)), int(m.group(1))), src)
    src = re.sub(r'font-size: (\d+)px', lambda m: 'font-size: %dpx' % SIZES.get(int(m.group(1)), int(m.group(1))), src)
    # высоты — только у элементов управления, не у обложек и рамок
    src = re.sub(r'(?<!min-)height: (\d+)px; (padding: 0|border-radius|display: (?:inline-)?flex)',
                 lambda m: 'height: %dpx; %s' % (HEIGHTS.get(int(m.group(1)), int(m.group(1))), m.group(2)), src)
    return src

if __name__ == '__main__':
    n = 0
    for p in sorted(glob.glob('*.dc.html')):
        s = open(p, encoding='utf-8').read()
        o = apply(s)
        if o != s:
            open(p, 'w', encoding='utf-8').write(o)
            n += 1
    print('обновлено файлов:', n)
