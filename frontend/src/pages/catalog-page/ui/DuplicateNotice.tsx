import React from 'react';
import { App, Button, Typography, theme } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import { DuplicatePair, NamedEntry } from '@/shared/lib/duplicates';
import { pluralize } from '@/shared/lib/plural';

interface Props {
  pair: DuplicatePair<NamedEntry>;
  onMerge: () => void;
  onDismiss: () => void;
}

const reasonText: Record<DuplicatePair<NamedEntry>['reason'], string> = {
  same: 'записаны одинаково с точностью до регистра и пробелов',
  alt: 'одно из имён стоит в поле «имя в оригинале» у другого',
  typo: 'различаются одной буквой'
};

/**
 * Подсказка про дубли в справочнике.
 *
 * Автор заводится сам, когда имя вписывают в карточку руками: одна книга ушла к «Лю Цысинь»,
 * другая — к «лю цысинь », и в справочнике две строки об одном человеке. Заметить это, листая
 * двести имён, нельзя, поэтому спрашивает страница — но решает всё равно человек.
 */
export const DuplicateNotice: React.FC<Props> = ({ pair, onMerge, onDismiss }) => {
  const { token } = theme.useToken();
  const { modal } = App.useApp();

  const confirm = () => {
    modal.confirm({
      title: 'Объединить в одного автора?',
      content: (
        <span>
          {`Произведения автора «${pair.source.name}» перейдут к «${pair.target.name}», после чего `}
          <Typography.Text strong>{`«${pair.source.name}»`}</Typography.Text>
          {' будет удалён. Отменить это нельзя.'}
        </span>
      ),
      okText: 'Объединить',
      cancelText: 'Отмена',
      onOk: onMerge
    });
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
        padding: `12px ${token.padding}px`,
        borderRadius: token.borderRadiusLG,
        background: token.colorWarningBg,
        marginBottom: token.marginSM
      }}
    >
      <WarningOutlined style={{ color: token.colorWarning, fontSize: 17, flexShrink: 0 }} />
      <Typography.Text style={{ flex: '1 1 280px', fontSize: 13 }}>
        {`Похоже на дубли: «${pair.target.name}» и «${pair.source.name}» — `}
        {`${pluralize(pair.target.itemCount, ['книга', 'книги', 'книг'])} и ${pair.source.itemCount}, `}
        {`${reasonText[pair.reason]}.`}
      </Typography.Text>
      <span style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <Button size="small" onClick={onDismiss}>
          Оставить как есть
        </Button>
        <Button size="small" type="primary" onClick={confirm}>
          Объединить
        </Button>
      </span>
    </div>
  );
};
