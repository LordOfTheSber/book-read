import { theme } from 'antd';
import type { NavGroupKey } from '@/shared/config/navigation';

/**
 * Точка перед пунктом «Ещё» — метка группы, а не украшение: в списке из одиннадцати строк
 * она отделяет ежедневное от справочников быстрее, чем подпись сверху.
 */
export const useNavGroupColors = (): Record<NavGroupKey, string> => {
  const { token } = theme.useToken();

  return {
    weekly: token.colorPrimary,
    actions: token.colorSuccess,
    catalogues: token.colorTextQuaternary,
    admin: token.purple
  };
};
