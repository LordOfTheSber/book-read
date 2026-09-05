import type { UserRole } from '@/shared/types/library';

interface RoleMeta {
  label: string;
  /** Пресет Ant Design: подстраивается под светлую/тёмную тему. */
  color: string;
}

export const roleMeta: Record<UserRole, RoleMeta> = {
  SUPER_ADMIN: { label: 'Супер админ', color: 'purple' },
  ADMIN: { label: 'Админ', color: 'blue' },
  EDITOR: { label: 'Редактор', color: 'cyan' },
  USER: { label: 'Пользователь', color: 'default' }
};

export const roleOptions = (Object.keys(roleMeta) as UserRole[]).map((role) => ({
  label: roleMeta[role].label,
  value: role
}));

export const getRoleLabel = (role?: UserRole) => (role && roleMeta[role]?.label) || role || '—';
