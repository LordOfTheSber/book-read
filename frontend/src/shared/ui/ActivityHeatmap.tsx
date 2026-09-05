import React, { useMemo } from 'react';
import { Tooltip, Typography, theme } from 'antd';
import { toLocalIso } from '@/shared/lib/date';
import { pluralize } from '@/shared/lib/plural';

export interface HeatmapDay {
  date: string;
  minutes: number;
  sessions: number;
}

interface Props {
  days: HeatmapDay[];
  /** Сколько дней показывать. По умолчанию 53 полных недели — столько отдаёт сервер. */
  window?: number;
}

const WEEK_DAYS = 7;

const MONTH_LABELS = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

/** Четыре ступени насыщенности поверх пустой клетки: больше глаз всё равно не различает. */
const STEPS = [0.25, 0.5, 0.75, 1];

/**
 * Календарь активности. Сервер отдаёт только дни с чтением — пустых в году больше, чем полных, —
 * поэтому сетка строится здесь, от границ окна, а присланные дни в неё раскладываются.
 * <p>
 * Недели идут колонками и начинаются с понедельника: воскресенье первым днём — американская
 * традиция, а календарь на странице русский.
 */
export const ActivityHeatmap: React.FC<Props> = ({ days, window = 371 }) => {
  const { token } = theme.useToken();

  const { weeks, maxMinutes } = useMemo(() => {
    const byDate = new Map(days.map((day) => [day.date, day]));
    const today = new Date();

    // Сетка выравнивается по неделям: она заканчивается воскресеньем текущей недели и содержит
    // целое число колонок. Иначе последний столбец обрывается посередине, и «сегодня» оказывается
    // не там, где его ищут взглядом.
    const daysToSunday = WEEK_DAYS - 1 - ((today.getDay() + 6) % WEEK_DAYS);
    const weekCount = Math.ceil(window / WEEK_DAYS);
    const start = new Date(today);
    start.setDate(today.getDate() + daysToSunday - (weekCount * WEEK_DAYS - 1));

    const cells = Array.from({ length: weekCount * WEEK_DAYS }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const iso = toLocalIso(date);
      const day = byDate.get(iso);
      return {
        iso,
        date,
        minutes: day?.minutes ?? 0,
        sessions: day?.sessions ?? 0,
        future: date > today
      };
    });

    const grouped: (typeof cells)[] = [];
    for (let index = 0; index < cells.length; index += WEEK_DAYS) {
      grouped.push(cells.slice(index, index + WEEK_DAYS));
    }

    /*
     * Подпись месяца ставится ровно один раз — над той неделей, с которой месяц начинается.
     * Признак «в неделе есть число от 1 до 7» для этого не годится: первая неделя месяца часто
     * разрезана границей столбца, и тогда подпись печаталась дважды подряд («Окт Окт»).
     */
    let previousMonth = -1;
    const labelled = grouped.map((cells) => {
      const month = cells[0].date.getMonth();
      const label = month === previousMonth ? null : MONTH_LABELS[month];
      previousMonth = month;
      return { cells, label };
    });

    return { weeks: labelled, maxMinutes: Math.max(...days.map((day) => day.minutes), 0) };
  }, [days, window]);

  const intensity = (minutes: number) => {
    if (minutes <= 0 || maxMinutes <= 0) return 0;
    const share = minutes / maxMinutes;
    return STEPS.findIndex((step) => share <= step) + 1 || STEPS.length;
  };

  return (
    /* Только вбок: `overflow-x: auto` без пары приводит браузер к `auto` и по вертикали,
       и лишний пиксель превратил бы календарь в скроллер (так и случилось с графиком). */
    <div style={{ overflowX: 'auto', overflowY: 'hidden' }}>
      <div style={{ display: 'flex', gap: 3, minWidth: 'min-content' }}>
        {weeks.map((week) => {
          return (
            <div key={week.cells[0].iso} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Typography.Text
                type="secondary"
                style={{ fontSize: 10, height: 14, whiteSpace: 'nowrap', lineHeight: '14px' }}
              >
                {week.label}
              </Typography.Text>
              {week.cells.map((cell) => {
                const level = intensity(cell.minutes);
                return (
                  <Tooltip
                    key={cell.iso}
                    title={
                      cell.future
                        ? undefined
                        : cell.sessions > 0
                          ? `${cell.iso}: ${pluralize(cell.minutes, ['минута', 'минуты', 'минут'])}, ${pluralize(
                              cell.sessions,
                              ['заход', 'захода', 'заходов']
                            )}`
                          : `${cell.iso}: без чтения`
                    }
                  >
                    <div
                      data-testid={`heatmap-day-${cell.iso}`}
                      data-level={level}
                      style={{
                        width: 11,
                        height: 11,
                        borderRadius: 2,
                        opacity: cell.future ? 0.3 : 1,
                        background:
                          level === 0
                            ? token.colorFillSecondary
                            : `color-mix(in srgb, ${token.colorPrimary} ${STEPS[level - 1] * 100}%, ${token.colorFillSecondary})`
                      }}
                    />
                  </Tooltip>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};
