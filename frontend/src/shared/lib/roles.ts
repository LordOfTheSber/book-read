import { UserRole } from '@/shared/types/library';

export const isSuperAdmin = (role?: UserRole) => role === 'SUPER_ADMIN';

export const isAdminLike = (role?: UserRole) => role === 'ADMIN' || role === 'SUPER_ADMIN';

export const canEditContent = (role?: UserRole) => isAdminLike(role) || role === 'EDITOR';
