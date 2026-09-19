import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { orderApi } from '../lib/services';
import { formatMoney } from '../lib/money';
import { PageLoader } from '../components/Spinner';
import { Alert } from '../components/Alert';
import type { OrderSummary } from '../lib/types';

export const ReceiptPage = (): JSX.Element => {
  const { orderNumber = '' } = useParams();
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    orderApi
      .receipt(orderNumber)
      .then((o) => {
        if (!cancelled) setOrder(o);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orderNumber]);

  if (loading) return <PageLoader label="Generating official receipt..." />;
  if (error || !order) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <Alert tone="error" title="Receipt not available">
          {error ?? 'This receipt could not be retrieved. Please check your orders page.'}
        </Alert>
        <div className="mt-4 text-center">
          <Link to="/orders" className="btn-secondary">
            Return to orders
          </Link>
        </div>
      </div>
    );
  }

  const payment = order.payments?.[0];
  const invoiceNumber = `INV-${order.orderNumber}`;
  const isPaid = Boolean(
    order.paidAt ||
    order.status === 'PAID' ||
    order.status === 'FULFILLED'
  );
  const isPending = (order.status === 'PENDING' || order.status === 'AWAITING_PAYMENT') && !isPaid;
  const isFailed = order.status === 'FAILED';
  const isCancelled = order.status === 'CANCELLED';

  const purchaseDate = new Date(order.paidAt ?? order.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 sm:py-8 print:max-w-none print:p-0 print:m-0">
      {/* Top Action Bar (strictly hidden on print) */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          to={`/orders/${order.orderNumber}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-400"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Order Details
        </Link>
        <div className="flex items-center gap-2">
          {isPaid && (
            <Link to="/library" className="btn-secondary py-1.5 px-3 text-xs">
              Go to My Library
            </Link>
          )}
          <button
            type="button"
            onClick={() => window.print()}
            className="btn-primary flex items-center gap-1.5 py-1.5 px-4 text-xs font-semibold shadow-sm"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
              />
            </svg>
            Print / Save PDF
          </button>
        </div>
      </div>

      {/* Printable Receipt Card - Compact single-page business document */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-slate-800 dark:bg-slate-900 print:rounded-none print:border-none print:bg-white print:p-0 print:shadow-none print:text-slate-900">
        {/* Header with Marketplace Branding and Tax Invoice Identification */}
        <div className="flex items-start justify-between border-b border-slate-200 pb-4 dark:border-slate-800 print:border-slate-300 print:pb-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 font-extrabold text-white text-base shadow-sm print:bg-slate-900">
              AH
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white print:text-slate-900">
                  Asset<span className="text-brand-600 print:text-slate-900">Hub</span>
                </span>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:bg-slate-800 dark:text-slate-400 print:bg-slate-100 print:text-slate-700">
                  Marketplace
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 print:text-slate-500">
                Official Tax Invoice &amp; Purchase Receipt
              </p>
            </div>
          </div>

          {/* Status Badge & Invoice Header */}
          <div className="text-right">
            <div>
              {isPaid && (
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2.5 py-0.5 text-xs font-extrabold uppercase tracking-wider text-emerald-800 border border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800 print:bg-emerald-50 print:text-emerald-800 print:border-emerald-300">
                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  PAID
                </span>
              )}
              {isPending && (
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2.5 py-0.5 text-xs font-extrabold uppercase tracking-wider text-amber-800 border border-amber-300 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-800 print:bg-amber-50 print:text-amber-800 print:border-amber-300">
                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                  AWAITING PAYMENT
                </span>
              )}
              {isFailed && (
                <span className="inline-flex items-center gap-1 rounded-md bg-rose-100 px-2.5 py-0.5 text-xs font-extrabold uppercase tracking-wider text-rose-800 border border-rose-300 dark:bg-rose-950/80 dark:text-rose-300 dark:border-rose-800 print:bg-rose-50 print:text-rose-800 print:border-rose-300">
                  PAYMENT FAILED
                </span>
              )}
              {isCancelled && (
                <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-extrabold uppercase tracking-wider text-slate-700 border border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 print:bg-slate-100 print:text-slate-700 print:border-slate-300">
                  CANCELLED
                </span>
              )}
            </div>
            <p className="mt-1 font-mono text-xs font-bold text-slate-900 dark:text-slate-100 print:text-slate-900">
              {invoiceNumber}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 print:text-slate-600">
              {purchaseDate}
            </p>
          </div>
        </div>

        {/* 2-Column Meta Block: Customer Info + Payment Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-b border-slate-200 py-3 text-xs dark:border-slate-800 print:border-slate-300 print:py-2.5">
          <div>
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 print:text-slate-500">
              Customer Details (Billed To)
            </h2>
            <p className="mt-1 text-xs font-bold text-slate-900 dark:text-slate-100 print:text-slate-900">
              {order.billingName || 'Customer'}
            </p>
            <p className="text-slate-600 dark:text-slate-400 print:text-slate-700">
              {order.billingEmail}
            </p>
            {(order.billingPhone || order.billingCountry) && (
              <p className="text-slate-600 dark:text-slate-400 print:text-slate-700">
                {[order.billingPhone, order.billingCountry].filter(Boolean).join(' • ')}
              </p>
            )}
          </div>

          <div className="space-y-0.5 sm:text-right">
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 print:text-slate-500">
              Transaction Information
            </h2>
            <p className="text-slate-700 dark:text-slate-300 print:text-slate-800">
              <span className="text-slate-400 print:text-slate-500">Order Ref: </span>
              <span className="font-mono font-semibold text-slate-900 dark:text-slate-100 print:text-slate-900">{order.orderNumber}</span>
            </p>
            <p className="text-slate-700 dark:text-slate-300 print:text-slate-800">
              <span className="text-slate-400 print:text-slate-500">Gateway: </span>
              <span className="font-medium">{payment?.provider ?? 'Online Payment Gateway'}</span>
              {payment?.methodLabel && <span className="text-slate-500"> ({payment.methodLabel})</span>}
            </p>
            {(payment?.providerTxnId || payment?.providerRef) && (
              <p className="text-slate-700 dark:text-slate-300 print:text-slate-800">
                <span className="text-slate-400 print:text-slate-500">Transaction ID: </span>
                <span className="font-mono font-medium text-slate-900 dark:text-slate-100 print:text-slate-900">
                  {payment.providerTxnId ?? payment.providerRef}
                </span>
              </p>
            )}
          </div>
        </div>

        {/* Itemized Products Table */}
        <div className="py-3 print:py-2">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:border-slate-800 dark:text-slate-500 print:border-slate-300 print:text-slate-500">
                <th className="pb-2">Purchased Asset</th>
                <th className="pb-2 text-slate-400">Vendor</th>
                <th className="pb-2 text-center">Qty</th>
                <th className="pb-2 text-right">Unit Price</th>
                <th className="pb-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 print:divide-slate-200">
              {order.items.map((item) => (
                <tr key={item.productId} className="text-slate-800 dark:text-slate-200 print:text-slate-900">
                  <td className="py-2.5 pr-2 font-medium max-w-[280px]">
                    <div className="font-semibold text-slate-900 dark:text-slate-100 print:text-slate-900">
                      {item.productTitle}
                    </div>
                  </td>
                  <td className="py-2.5 text-slate-500 dark:text-slate-400 print:text-slate-600">
                    {item.product?.vendor?.storeName || 'Verified Creator'}
                  </td>
                  <td className="py-2.5 text-center text-slate-600 dark:text-slate-400 print:text-slate-700">
                    {item.quantity}
                  </td>
                  <td className="py-2.5 text-right font-mono text-slate-600 dark:text-slate-400 print:text-slate-700">
                    {formatMoney(item.unitAmount, order.currency)}
                  </td>
                  <td className="py-2.5 text-right font-mono font-bold text-slate-900 dark:text-slate-100 print:text-slate-900">
                    {formatMoney(item.lineTotal, order.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Breakdown */}
        <div className="border-t border-slate-200 pt-2.5 dark:border-slate-800 print:border-slate-300 print:pt-2">
          <div className="ml-auto w-full max-w-xs space-y-1 text-xs">
            <div className="flex justify-between text-slate-600 dark:text-slate-400 print:text-slate-600">
              <span>Subtotal</span>
              <span className="font-mono font-medium">{formatMoney(order.subtotalAmount, order.currency)}</span>
            </div>
            {order.discountAmount > 0 && (
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400 print:text-emerald-700">
                <span>Promotional Discount</span>
                <span className="font-mono">-{formatMoney(order.discountAmount, order.currency)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-500 dark:text-slate-400 print:text-slate-500">
              <span>VAT / Tax (0%)</span>
              <span className="font-mono">{formatMoney(order.taxAmount ?? 0, order.currency)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-1.5 text-sm font-bold text-slate-900 dark:border-slate-800 dark:text-white print:border-slate-400 print:text-slate-900">
              <span>Total {isPaid ? 'Paid' : 'Due'} ({order.currency})</span>
              <span className="font-mono text-brand-600 dark:text-brand-400 print:text-slate-900 font-extrabold text-base">
                {formatMoney(order.totalAmount, order.currency)}
              </span>
            </div>
          </div>
        </div>

        {/* Digital License Keys Grant Section */}
        {order.grants && order.grants.length > 0 && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs dark:border-slate-800 dark:bg-slate-800/40 print:border-slate-300 print:bg-slate-50 print:p-2.5">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 print:text-slate-700">
              Delivered Digital Product Licences
            </h3>
            <div className="mt-1.5 space-y-1">
              {order.grants.map((g) => (
                <div key={g.licenseKey} className="flex flex-wrap items-center justify-between gap-1 text-[11px]">
                  <span className="text-slate-600 dark:text-slate-400 print:text-slate-700">
                    Product Key ({g.downloadCount} downloads used):
                  </span>
                  <code className="rounded bg-white px-2 py-0.5 font-mono font-bold text-slate-900 border border-slate-200 dark:bg-slate-900 dark:text-brand-300 dark:border-slate-700 print:bg-white print:border-slate-300 print:text-slate-900">
                    {g.licenseKey}
                  </code>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Legal Disclaimer & Footer */}
        <div className="mt-4 border-t border-slate-200 pt-3 text-center text-[10px] text-slate-400 dark:border-slate-800 dark:text-slate-500 print:border-slate-300 print:pt-2 print:text-slate-500">
          <p className="font-medium text-slate-500 dark:text-slate-400 print:text-slate-600">
            Digital Delivery Notice: All tech assets include instant digital access and commercial developer license rights.
          </p>
          <p className="mt-0.5">
            Computer-generated receipt issued by AssetHub Marketplace. Valid without physical signature. Contact support@assethub.dev for inquiries.
          </p>
        </div>
      </div>
    </div>
  );
};
