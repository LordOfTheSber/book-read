import React, { useEffect } from 'react';
import { Button, Drawer, Form, Grid } from 'antd';
import { useAppDispatch, useAppSelector } from '@/shared/lib/hooks';
import { resetFilters, setFilters } from '@/features/book/set-book-filters';
import { FiltersForm, filtersToFormValues, formValuesToFilters, type FiltersFormValues } from './FiltersForm';

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Фильтры панелью справа: то же, что в рельсе рабочего стола, но по кнопке.
 *
 * Поля живут в `FiltersForm` и общие для обоих мест — иначе набор фильтров пришлось бы
 * держать в двух экземплярах и следить, чтобы они не разошлись.
 */
export const FiltersPanelWidget: React.FC<Props> = ({ open, onClose }) => {
  const dispatch = useAppDispatch();
  const filters = useAppSelector((state) => state.bookFilters);
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [form] = Form.useForm<FiltersFormValues>();

  // Drawer открывается с актуальным состоянием фильтров, а не с тем, что было.
  useEffect(() => {
    if (open) {
      form.setFieldsValue(filtersToFormValues(filters));
    }
  }, [open, filters, form]);

  const handleApply = async () => {
    // См. BookFormDrawer: отказ валидации нужно перехватить, иначе он всплывает необработанным.
    const values = await form.validateFields().catch(() => undefined);
    if (!values) {
      return;
    }
    dispatch(setFilters(formValuesToFilters(values)));
    onClose();
  };

  const handleReset = () => {
    form.resetFields();
    dispatch(resetFilters());
    onClose();
  };

  return (
    <Drawer
      title="Фильтры"
      placement="right"
      open={open}
      onClose={onClose}
      width={isMobile ? '100%' : 400}
      footer={
        <div style={{ display: 'flex', gap: 12, padding: '12px 24px' }}>
          <Button onClick={handleReset} block>
            Сбросить
          </Button>
          <Button type="primary" onClick={handleApply} block>
            Применить
          </Button>
        </div>
      }
    >
      <FiltersForm form={form} />
    </Drawer>
  );
};
