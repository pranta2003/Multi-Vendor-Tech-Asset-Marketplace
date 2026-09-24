import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { contactApi, orderApi } from '../lib/services';
import { Alert } from '../components/Alert';
import { Spinner } from '../components/Spinner';
import type { OrderSummary } from '../lib/types';

const INQUIRY_TYPES = [
  'General Question',
  'Order Issue',
  'Payment Issue',
  'Download / License Issue',
  'Account Issue',
  'Technical Problem',
  'Vendor Concern',
  'Complaint / Allegation',
  'Other',
] as const;

export const ContactPage = (): JSX.Element => {
  const [searchParams] = useSearchParams();
  const { user } = useAuthStore();

  const [name, setName] = useState(user?.fullName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [subject, setSubject] = useState(searchParams.get('subject') ?? '');
  const [inquiryType, setInquiryType] = useState<string>(
    searchParams.get('inquiryType') ?? 'General Question',
  );
  const [orderId, setOrderId] = useState(searchParams.get('orderId') ?? '');
  const [message, setMessage] = useState('');
  const [honeypot, setHoneypot] = useState('');

  // User orders for fast selection
  const [userOrders, setUserOrders] = useState<OrderSummary[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Form states
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submittedTicket, setSubmittedTicket] = useState<{
    ticketNumber: string;
    subject: string;
    inquiryType: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (user) {
      if (!name) setName(user.fullName ?? '');
      if (!email) setEmail(user.email ?? '');
      if (!phone && user.phone) setPhone(user.phone);

      // Load user's recent orders to make referencing an order seamless
      setLoadingOrders(true);
      orderApi
        .listMine({ limit: 10 })
        .then((res) => {
          setUserOrders(res.items ?? []);
        })
        .catch(() => {
          // Non-critical, ignore
        })
        .finally(() => setLoadingOrders(false));
    }
  }, [user]);

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!name.trim()) {
      errors.name = 'Full name is required';
    } else if (name.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters';
    }

    if (!email.trim()) {
      errors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Please provide a valid email address';
    }

    if (phone.trim() && !/^(\+?[0-9\s\-()]{7,24})$/.test(phone.trim())) {
      errors.phone = 'Please provide a valid phone number (or leave empty)';
    }

    if (!subject.trim()) {
      errors.subject = 'Subject is required';
    } else if (subject.trim().length < 4) {
      errors.subject = 'Subject must be at least 4 characters';
    }

    if (!inquiryType) {
      errors.inquiryType = 'Please select an inquiry type';
    }

    if (!message.trim()) {
      errors.message = 'Message is required';
    } else if (message.trim().length < 10) {
      errors.message = 'Please provide at least 10 characters explaining your inquiry';
    } else if (message.length > 3000) {
      errors.message = 'Message cannot exceed 3000 characters';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!validate()) return;

    // Honeypot check
    if (honeypot) {
      setErrorMessage('Submission rejected');
      return;
    }

    setSubmitting(true);
    try {
      const ticket = await contactApi.submit({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
        subject: subject.trim(),
        inquiryType,
        orderId: orderId.trim() || undefined,
        message: message.trim(),
        hp: honeypot || undefined,
      });

      setSubmittedTicket({
        ticketNumber: ticket.ticketNumber,
        subject: ticket.subject,
        inquiryType: ticket.inquiryType,
      });
      // Scroll to top of window to display confirmation
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setErrorMessage(
        err?.message || 'Failed to submit support request. Please try again in a few moments.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyTicket = async () => {
    if (!submittedTicket) return;
    try {
      await navigator.clipboard.writeText(submittedTicket.ticketNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleReset = () => {
    setSubmittedTicket(null);
    setMessage('');
    setSubject('');
    setOrderId('');
    setFieldErrors({});
    setErrorMessage(null);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8 sm:space-y-10">
      {/* Header Breadcrumbs / Title */}
      <div>
        <nav className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
          <Link to="/" className="transition hover:text-brand-600 dark:hover:text-brand-400">
            Home
          </Link>
          <span>/</span>
          <span className="text-slate-800 dark:text-slate-200">Support</span>
        </nav>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl dark:text-white">
          Customer Support & Inquiries
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Have a question about your order, digital asset licenses, payments, or account? Our support team is here to assist.
        </p>
      </div>

      {/* Main Grid: Left Information / Right Form */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10 items-start">
        {/* LEFT COLUMN: Support Information & Contact Details */}
        <div className="space-y-6 lg:col-span-5">
          {/* Support Scope Card */}
          <div className="card space-y-4 p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 shadow-xs dark:bg-brand-950/80 dark:text-brand-400 dark:border dark:border-brand-800/60">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </span>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">AssetHub Support</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Direct technical & customer assistance</p>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              Customers, creators, and visitors can contact AssetHub regarding any of the following inquiries:
            </p>

            <ul className="grid grid-cols-1 gap-2 text-xs text-slate-600 dark:text-slate-300 sm:grid-cols-2 lg:grid-cols-1">
              {[
                'Orders & transaction status',
                'Payments (Stripe & SSLCommerz)',
                'Purchased digital tech assets',
                'Download links & license keys',
                'Account settings & access',
                'Vendor-related questions',
                'Technical bugs & platform issues',
                'General marketplace questions',
                'Complaints & copyright allegations',
              ].map((item, idx) => (
                <li key={idx} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-500"></span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
              <div className="flex items-center gap-2 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Typical response time: under 24 hours</span>
              </div>
            </div>
          </div>

          {/* Official Support Contact Card */}
          <div className="card space-y-5 p-6">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">
                Support Contact
              </span>
              <h3 className="mt-1 text-base font-bold text-slate-900 dark:text-white">
                Contact Information
              </h3>
            </div>

            <div className="space-y-4 text-xs">
              {/* Phone */}
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </span>
                <div>
                  <p className="font-semibold text-slate-700 dark:text-slate-200">Phone</p>
                  <a
                    href="tel:01700000000"
                    className="font-mono text-slate-600 hover:text-brand-600 dark:text-slate-300 dark:hover:text-brand-400"
                  >
                    01700000000
                  </a>
                </div>
              </div>

              {/* Email */}
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </span>
                <div>
                  <p className="font-semibold text-slate-700 dark:text-slate-200">Email</p>
                  <a
                    href="mailto:prantakumerpandit@gmail.com"
                    className="break-all font-mono text-slate-600 hover:text-brand-600 dark:text-slate-300 dark:hover:text-brand-400"
                  >
                    prantakumerpandit@gmail.com
                  </a>
                </div>
              </div>

              {/* Location */}
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </span>
                <div>
                  <p className="font-semibold text-slate-700 dark:text-slate-200">Location</p>
                  <p className="leading-relaxed text-slate-600 dark:text-slate-300">
                    Block H, Road 2, Mirpur-2,<br />
                    Dhaka-1200, Bangladesh
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-[11px] text-slate-500 dark:border-slate-800/80 dark:bg-slate-800/40 dark:text-slate-400">
              <span className="font-bold text-slate-700 dark:text-slate-300">Note: </span>
              Inquiries submitted through the form below are automatically stamped with a tracking reference number and reviewed by our engineering support team.
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Functional Support Form or Confirmation State */}
        <div className="lg:col-span-7">
          {submittedTicket ? (
            /* Confirmation State */
            <div className="card space-y-6 p-6 sm:p-8 text-center animate-fade-in">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/50 dark:bg-emerald-950/80 dark:text-emerald-400 dark:ring-emerald-950/40">
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <div>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                  Message Received
                </span>
                <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                  Thank You for Contacting AssetHub
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-slate-600 dark:text-slate-300">
                  Your request has been received and our support team will review it. A confirmation notice has been queued for your records.
                </p>
              </div>

              {/* Reference Ticket Card */}
              <div className="mx-auto max-w-md rounded-2xl border border-slate-200/90 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-900/80">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Support Ticket Reference
                </p>
                <div className="mt-2 flex items-center justify-center gap-3">
                  <span className="font-mono text-xl font-bold tracking-tight text-brand-600 dark:text-brand-400">
                    {submittedTicket.ticketNumber}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyTicket}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <div className="mt-3 flex justify-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                  <span>Type: <strong className="text-slate-700 dark:text-slate-200">{submittedTicket.inquiryType}</strong></span>
                  <span>•</span>
                  <span>Estimated Response: <strong className="text-slate-700 dark:text-slate-200">&lt; 24h</strong></span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <Link to="/" className="btn-primary w-full sm:w-auto px-6 py-2.5 text-xs font-bold">
                  Back to Marketplace
                </Link>
                {user ? (
                  <Link to="/account?tab=support" className="btn-secondary w-full sm:w-auto px-6 py-2.5 text-xs font-bold">
                    View My Support Tickets
                  </Link>
                ) : (
                  <Link to="/login" className="btn-secondary w-full sm:w-auto px-6 py-2.5 text-xs font-bold">
                    Sign In to Account
                  </Link>
                )}
                <button
                  type="button"
                  onClick={handleReset}
                  className="w-full sm:w-auto text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white px-3 py-2"
                >
                  Submit Another Request
                </button>
              </div>
            </div>
          ) : (
            /* Support Submission Form */
            <div className="card p-6 sm:p-8">
              <div className="border-b border-slate-100 pb-5 dark:border-slate-800">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Submit a Support Request
                </h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Please fill out the details below. We inspect every ticket carefully to resolve issues swiftly.
                </p>
              </div>

              {errorMessage && (
                <div className="mt-5">
                  <Alert tone="error">{errorMessage}</Alert>
                </div>
              )}


              <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                {/* Honeypot field (hidden from real users) */}
                <div style={{ display: 'none' }} aria-hidden="true">
                  <input
                    type="text"
                    name="hp_field"
                    tabIndex={-1}
                    autoComplete="off"
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                  />
                </div>

                {/* Name & Email Row */}
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      className={`input mt-1.5 ${fieldErrors.name ? 'border-red-500 focus:border-red-500' : ''}`}
                      placeholder="e.g. John Doe"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        if (fieldErrors.name) setFieldErrors({ ...fieldErrors, name: '' });
                      }}
                    />
                    {fieldErrors.name && (
                      <p className="mt-1 text-[11px] font-medium text-red-500">{fieldErrors.name}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      className={`input mt-1.5 ${fieldErrors.email ? 'border-red-500 focus:border-red-500' : ''}`}
                      placeholder="e.g. user@example.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: '' });
                      }}
                    />
                    {fieldErrors.email && (
                      <p className="mt-1 text-[11px] font-medium text-red-500">{fieldErrors.email}</p>
                    )}
                  </div>
                </div>

                {/* Phone & Inquiry Type Row */}
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                      Phone Number <span className="text-slate-400 font-normal">(optional)</span>
                    </label>
                    <input
                      type="tel"
                      className={`input mt-1.5 ${fieldErrors.phone ? 'border-red-500 focus:border-red-500' : ''}`}
                      placeholder="e.g. 01700000000"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        if (fieldErrors.phone) setFieldErrors({ ...fieldErrors, phone: '' });
                      }}
                    />
                    {fieldErrors.phone && (
                      <p className="mt-1 text-[11px] font-medium text-red-500">{fieldErrors.phone}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                      Inquiry Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      className={`input mt-1.5 ${fieldErrors.inquiryType ? 'border-red-500 focus:border-red-500' : ''}`}
                      value={inquiryType}
                      onChange={(e) => {
                        setInquiryType(e.target.value);
                        if (fieldErrors.inquiryType) setFieldErrors({ ...fieldErrors, inquiryType: '' });
                      }}
                    >
                      {INQUIRY_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                    {fieldErrors.inquiryType && (
                      <p className="mt-1 text-[11px] font-medium text-red-500">{fieldErrors.inquiryType}</p>
                    )}
                  </div>
                </div>

                {/* Order ID field */}
                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                      Order ID <span className="text-slate-400 font-normal">(optional)</span>
                    </label>
                    {user && userOrders.length > 0 && (
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        {loadingOrders ? 'Loading orders...' : 'Quick-select recent order below'}
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    className="input mt-1.5 font-mono"
                    placeholder="e.g. MKT-20260904-7Q2XKD"
                    value={orderId}
                    onChange={(e) => setOrderId(e.target.value)}
                  />

                  {/* Logged-in customer quick order selector pills */}
                  {user && userOrders.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Recent:</span>
                      {userOrders.slice(0, 3).map((ord) => (
                        <button
                          key={ord.id}
                          type="button"
                          onClick={() => setOrderId(ord.orderNumber)}
                          className={`rounded-md px-2 py-0.5 text-[11px] font-mono transition ${
                            orderId === ord.orderNumber
                              ? 'bg-brand-600 text-white font-bold'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                          }`}
                        >
                          {ord.orderNumber}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Subject Field */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                    Subject <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    className={`input mt-1.5 ${fieldErrors.subject ? 'border-red-500 focus:border-red-500' : ''}`}
                    placeholder="Brief summary of your inquiry"
                    value={subject}
                    onChange={(e) => {
                      setSubject(e.target.value);
                      if (fieldErrors.subject) setFieldErrors({ ...fieldErrors, subject: '' });
                    }}
                  />
                  {fieldErrors.subject && (
                    <p className="mt-1 text-[11px] font-medium text-red-500">{fieldErrors.subject}</p>
                  )}
                </div>

                {/* Message Field */}
                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                      Message Details <span className="text-red-500">*</span>
                    </label>
                    <span className={`text-[11px] ${message.length > 2800 ? 'text-amber-500 font-bold' : 'text-slate-400'}`}>
                      {message.length}/3000
                    </span>
                  </div>
                  <textarea
                    rows={6}
                    className={`input mt-1.5 leading-relaxed resize-y ${fieldErrors.message ? 'border-red-500 focus:border-red-500' : ''}`}
                    placeholder="Describe your inquiry, issue, or question in detail so we can provide a fast, accurate resolution..."
                    value={message}
                    maxLength={3000}
                    onChange={(e) => {
                      setMessage(e.target.value);
                      if (fieldErrors.message) setFieldErrors({ ...fieldErrors, message: '' });
                    }}
                  />
                  {fieldErrors.message && (
                    <p className="mt-1 text-[11px] font-medium text-red-500">{fieldErrors.message}</p>
                  )}
                </div>

                {/* Submit Action */}
                <div className="pt-2 flex items-center justify-between gap-4">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    🔒 Protected with 256-bit SSL encryption.
                  </p>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-primary min-w-[160px] py-2.5 text-xs font-bold shadow-sm"
                  >
                    {submitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <Spinner className="h-4 w-4" />
                        <span>Sending...</span>
                      </span>
                    ) : (

                      'Send Message'
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
