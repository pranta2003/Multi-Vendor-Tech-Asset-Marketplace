import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { orderApi } from '../lib/services';
import { formatMoney } from '../lib/money';
import { PageLoader } from '../components/Spinner';
import { Alert } from '../components/Alert';
import { StatusBadge } from '../components/StatusBadge';
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

  if (loading) return <PageLoader label="Generating receipt" />;
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
  const purchaseDate = new Date(order.paidAt ?? order.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      {/* Top Action Bar (hidden on print) */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          to={`/orders/${order.orderNumber}`}
          className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
        >
          ← Back to order details
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="btn-primary flex items-center gap-2 py-2 text-sm shadow-sm"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
              />
            </svg>
            Print / Save as PDF
          </button>
        </div>
      </div>

      {/* Printable Receipt Card */}
      <div className="card overflow-hidden bg-white p-6 shadow-md sm:p-10 dark:bg-slate-900 dark:border-slate-800 print:border-none print:shadow-none print:p-0">
        {/* Header with Marketplace Branding and Invoice Details */}
        <div className="border-b border-surface-border pb-6 dark:border-slate-800">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 font-bold text-white shadow-sm">
                  AH
                </span>
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">AssetHub</h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Multi-Vendor Tech Asset Marketplace</p>
                </div>
              </div>
              <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                <p>Support: support@assethub.market</p>
                <p>Web: multi-vendor-tech-asset-marketplace-ashen.vercel.app</p>
              </div>
            </div>
            <div className="text-right">
              <span className="inline-block rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-bold tracking-wide text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border dark:border-emerald-800/80">
                TAX INVOICE / RECEIPT
              </span>
              <p className="mt-2 font-mono text-sm font-bold text-slate-900 dark:text-slate-100">{invoiceNumber}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Date: {purchaseDate}</p>
            </div>
          </div>
        </div>

        {/* Customer & Transaction Meta Grid */}
        <div className="grid grid-cols-1 gap-6 border-b border-surface-border py-6 sm:grid-cols-2 dark:border-slate-800">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Billed To
            </h2>
            <p className="mt-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100">{order.billingName}</p>
            <p className="text-xs text-slate-600 dark:text-slate-400">{order.billingEmail}</p>
            {order.billingPhone && (
              <p className="text-xs text-slate-600 dark:text-slate-400">Phone: {order.billingPhone}</p>
            )}
            {order.billingCountry && (
              <p className="text-xs text-slate-600 dark:text-slate-400">Country: {order.billingCountry}</p>
            )}
          </div>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Payment Details
            </h2>
            <div className="mt-1.5 space-y-1 text-xs">
              <p className="text-slate-700 dark:text-slate-300">
                <span className="text-slate-500 dark:text-slate-400">Order Number: </span>
                <span className="font-mono font-medium">{order.orderNumber}</span>
              </p>
              <p className="text-slate-700 dark:text-slate-300">
                <span className="text-slate-500 dark:text-slate-400">Gateway Provider: </span>
                <span className="font-semibold">{payment?.provider ?? 'Online Gateway'}</span>
              </p>
              {(payment?.providerTxnId || payment?.providerRef) && (
                <p className="text-slate-700 dark:text-slate-300">
                  <span className="text-slate-500 dark:text-slate-400">Transaction ID: </span>
                  <span className="font-mono font-medium">{payment.providerTxnId ?? payment.providerRef}</span>
                </p>
              )}
              {payment?.methodLabel && (
                <p className="text-slate-700 dark:text-slate-300">
                  <span className="text-slate-500 dark:text-slate-400">Payment Method: </span>
                  <span>{payment.methodLabel}</span>
                </p>
              )}
              <div className="flex items-center gap-2 pt-1">
                <span className="text-slate-500 dark:text-slate-400">Order Status:</span>
                <StatusBadge status={order.status} />
              </div>
            </div>
          </div>
        </div>

        {/* Itemized Line Items Table */}
        <div className="py-6">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Purchased Tech Assets
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-surface-border text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="pb-3 font-semibold">Item & Vendor</th>
                  <th className="pb-3 text-center font-semibold">Qty</th>
                  <th className="pb-3 text-right font-semibold">Price</th>
                  <th className="pb-3 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border dark:divide-slate-800">
                {order.items.map((item) => (
                  <tr key={item.productId} className="text-slate-800 dark:text-slate-200">
                    <td className="py-3.5 pr-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={item.productThumbnail}
                          alt={item.productTitle}
                          className="h-10 w-10 rounded-lg bg-slate-100 object-cover dark:bg-slate-800"
                        />
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-slate-100">{item.productTitle}</p>
                          {item.product?.vendor?.storeName && (
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              By {item.product.vendor.storeName}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 text-center text-xs text-slate-600 dark:text-slate-400">{item.quantity}</td>
                    <td className="py-3.5 text-right font-mono text-xs text-slate-600 dark:text-slate-400">
                      {formatMoney(item.unitAmount, order.currency)}
                    </td>
                    <td className="py-3.5 text-right font-mono font-semibold text-slate-900 dark:text-white">
                      {formatMoney(item.lineTotal, order.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totals Section */}
        <div className="border-t border-surface-border pt-4 dark:border-slate-800">
          <div className="ml-auto w-full max-w-xs space-y-2 text-sm">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Subtotal</span>
              <span className="font-mono">{formatMoney(order.subtotalAmount, order.currency)}</span>
            </div>
            {order.discountAmount > 0 && (
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                <span>Discount</span>
                <span className="font-mono">-{formatMoney(order.discountAmount, order.currency)}</span>
              </div>
            )}
            {order.taxAmount > 0 && (
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Tax</span>
                <span className="font-mono">{formatMoney(order.taxAmount, order.currency)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-surface-border pt-2 text-base font-bold text-slate-900 dark:border-slate-800 dark:text-white">
              <span>Total Paid</span>
              <span className="font-mono text-brand-600 dark:text-brand-400">
                {formatMoney(order.totalAmount, order.currency)}
              </span>
            </div>
          </div>
        </div>

        {/* Digital Licences / Download Grants (if fulfilled) */}
        {order.grants && order.grants.length > 0 && (
          <div className="mt-8 rounded-xl border border-brand-200/70 bg-brand-50/50 p-4 dark:border-brand-900/60 dark:bg-brand-950/30">
            <h3 className="text-xs font-bold uppercase tracking-wider text-brand-800 dark:text-brand-300">
              Delivered Digital Licences
            </h3>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
              Your licence keys are activated and accessible in your digital library anytime.
            </p>
            <div className="mt-3 divide-y divide-brand-100 dark:divide-slate-800">
              {order.grants.map((g) => (
                <div key={g.licenseKey} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Asset Licence</span>
                  <code className="rounded bg-white px-2 py-0.5 font-mono font-bold text-slate-900 shadow-xs dark:bg-slate-900 dark:text-brand-300 dark:border dark:border-brand-900">
                    {g.licenseKey}
                  </code>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Legal & Terms Footer */}
        <div className="mt-8 border-t border-surface-border pt-6 text-center text-xs text-slate-400 dark:border-slate-800 dark:text-slate-500">
          <p>This is a computer-generated tax invoice and proof of purchase. No physical signature is required.</p>
          <p className="mt-1">
            All digital tech assets are licensed for commercial use as defined in the AssetHub standard license terms.
          </p>
        </div>
      </div>
    </div>
  );
};

