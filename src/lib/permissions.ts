import { UserRole } from '../types';

export function canEditBoQRow(role: UserRole, isOwner: boolean): boolean {
  if (role === 'admin') return true;
  if (role === 'estimator') return true;
  if (role === 'procurement_officer' && isOwner) return true;
  return false;
}

export function canAcceptAIRun(role: UserRole, isOwner: boolean): boolean {
  if (role === 'admin') return true;
  if (role === 'estimator') return true;
  if (role === 'procurement_officer' && isOwner) return true;
  return false;
}

export function canManageEstimate(role: UserRole, isOwner: boolean): boolean {
  if (role === 'admin') return true;
  if (role === 'procurement_officer' && isOwner) return true;
  return false;
}

export function canApproveEstimate(role: UserRole): boolean {
  return role === 'admin' || role === 'procurement_officer';
}

export function canAccessAdmin(role: UserRole): boolean {
  return role === 'admin';
}

export function canCreateEstimate(role: UserRole): boolean {
  return role === 'admin' || role === 'procurement_officer' || role === 'estimator';
}
