import { UserRole } from '@/shared/types/library';

export const isSuperAdmin = (role?: UserRole) => role === 'SUPER_ADMIN';

export const isAdminLike = (role?: UserRole) => role === 'ADMIN' || role === 'SUPER_ADMIN';

export const canEditContent = (role?: UserRole) => isAdminLike(role) || role === 'EDITOR';

export const canEditBooks = (role?: UserRole) => isAdminLike(role) || role === 'EDITOR' || role === 'USER';

export const canDeleteBook = (role?: UserRole, currentUserId?: string, bookOwnerId?: string) => {
  if (isAdminLike(role)) return true;
  return currentUserId && bookOwnerId && currentUserId === bookOwnerId;
};
