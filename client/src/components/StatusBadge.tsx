import type { OrderStatus } from '../lib/types';

const STYLES: Record<OrderStatus, string> = {
  PENDING: 'bg-slate-100 text-slate-700',
  AWAITING_PAYMENT: 'bg-amber-100 text-amber-800',
  PAID: 'bg-blue-100 text-blue-800',
  FULFILLED: 'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-slate-100 text-slate-600',
  FAILED: 'bg-red-100 text-red-800',
  REFUNDED: 'bg-purple-100 text-purple-800',
};

const LABELS: Record<OrderStatus, string> = {
  PENDING: 'Pending',
  AWAITING_PAYMENT: 'Awaiting payment',
  PAID: 'Paid',
  FULFILLED: 'Delivered',
  CANCELLED: 'Cancelled',
  FAILED: 'Failed',
  REFUNDED: 'Refunded',
};

export const StatusBadge = ({ status }: { status: OrderStatus }): JSX.Element => (
  <span className={`badge ${STYLES[status]}`}>{LABELS[status]}</span>
);
