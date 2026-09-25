// Safe mock environment defaults so the tests run in isolated environments without live DB or secrets
process.env.NODE_ENV ||= 'test';
process.env.CLIENT_ORIGIN ||= 'http://localhost:8080';
process.env.SERVER_ORIGIN ||= 'http://localhost:8080';
process.env.DATABASE_URL ||= 'postgresql://marketplace:mock@localhost:5432/marketplace_db?schema=public';
process.env.JWT_ACCESS_SECRET ||= 'mock_access_secret_min_32_characters_long_val';
process.env.JWT_REFRESH_SECRET ||= 'mock_refresh_secret_min_32_characters_long_val';
process.env.STRIPE_SECRET_KEY ||= 'mock_stripe_secret_key';
process.env.STRIPE_WEBHOOK_SECRET ||= 'mock_stripe_webhook_secret';
process.env.SSLCZ_STORE_ID ||= 'mock_sslcz_store_id';
process.env.SSLCZ_STORE_PASSWORD ||= 'mock_sslcz_store_password';

import assert from 'node:assert';
import {
  createContactSchema,
  listTicketsSchema,
  updateTicketStatusSchema,
  ticketIdParamSchema,
  INQUIRY_TYPES,
} from '../src/modules/contact/contact.validation';
import { generateTicketNumber } from '../src/utils/identifiers';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  buildNotificationEmailHtml,
  buildNotificationEmailText,
  sendTicketNotifications,
} = require('../src/modules/contact/notification.service');

console.log('=== Running Contact Support System Tests ===');

let pass = 0;
let fail = 0;

const test = (name: string, fn: () => void) => {
  try {
    fn();
    pass++;
    console.log(`  PASS  ${name}`);
  } catch (err: any) {
    fail++;
    console.error(`  FAIL  ${name}: ${err?.message || err}`);
  }
};

// 1. Ticket Number Generation
test('generateTicketNumber generates valid Crockford format', () => {
  const tkt = generateTicketNumber();
  assert(
    /^TKT-\d{8}-[0-9A-HJKMNP-TV-Z]{6}$/.test(tkt),
    `Malformed ticket number: ${tkt}`,
  );
});

// 2. createContactSchema validation
test('createContactSchema accepts valid payload', () => {
  const result = createContactSchema.safeParse({
    body: {
      name: 'Pranta Pandit',
      email: 'pranta@example.com',
      phone: '01700000000',
      subject: 'Question regarding React course licenses',
      inquiryType: 'Download / License Issue',
      orderId: 'MKT-20260904-7Q2XKD',
      message: 'Hello, I would like to clarify if this license permits multi-team distribution.',
    },
  });
  assert(result.success, JSON.stringify(result));
});

test('createContactSchema rejects missing required fields', () => {
  const result = createContactSchema.safeParse({
    body: {
      email: 'pranta@example.com',
      message: 'Missing name, subject and inquiry type',
    },
  });
  assert(!result.success, 'Should fail validation');
});

test('createContactSchema rejects invalid email format', () => {
  const result = createContactSchema.safeParse({
    body: {
      name: 'John Doe',
      email: 'not-an-email',
      subject: 'Testing subject line',
      inquiryType: 'General Question',
      message: 'This message should be rejected due to invalid email format.',
    },
  });
  assert(!result.success, 'Should reject invalid email');
});

test('createContactSchema rejects invalid inquiry type', () => {
  const result = createContactSchema.safeParse({
    body: {
      name: 'John Doe',
      email: 'valid@example.com',
      subject: 'Testing subject line',
      inquiryType: 'NonExistentCategory',
      message: 'This message should be rejected due to invalid category.',
    },
  });
  assert(!result.success, 'Should reject invalid inquiry type');
});

test('createContactSchema accepts all 9 defined inquiry types', () => {
  for (const inquiryType of INQUIRY_TYPES) {
    const res = createContactSchema.safeParse({
      body: {
        name: 'John Doe',
        email: 'valid@example.com',
        subject: `Testing ${inquiryType}`,
        inquiryType,
        message: 'This is a long enough message to pass length validation cleanly.',
      },
    });
    assert(res.success, `Failed for ${inquiryType}`);
  }
});

test('createContactSchema rejects message shorter than 10 characters', () => {
  const result = createContactSchema.safeParse({
    body: {
      name: 'John Doe',
      email: 'valid@example.com',
      subject: 'Testing subject line',
      inquiryType: 'General Question',
      message: 'Too short',
    },
  });
  assert(!result.success, 'Should reject short message');
});

test('createContactSchema rejects message longer than 3000 characters', () => {
  const result = createContactSchema.safeParse({
    body: {
      name: 'John Doe',
      email: 'valid@example.com',
      subject: 'Testing subject line',
      inquiryType: 'General Question',
      message: 'a'.repeat(3001),
    },
  });
  assert(!result.success, 'Should reject oversize message');
});

// 3. listTicketsSchema validation
test('listTicketsSchema parses pagination and status filters', () => {
  const result = listTicketsSchema.safeParse({
    query: {
      page: '2',
      limit: '25',
      status: 'NEW',
      search: 'react',
    },
  });
  assert(result.success);
  if (result.success) {
    assert.strictEqual(result.data.query.page, 2);
    assert.strictEqual(result.data.query.limit, 25);
    assert.strictEqual(result.data.query.status, 'NEW');
  }
});

// 4. updateTicketStatusSchema validation
test('updateTicketStatusSchema validates UUID and status enum', () => {
  const result = updateTicketStatusSchema.safeParse({
    params: { id: '550e8400-e29b-41d4-a716-446655440000' },
    body: { status: 'RESOLVED', adminNotes: 'Issue clarified with customer via email.' },
  });
  assert(result.success);
});

test('updateTicketStatusSchema rejects invalid status', () => {
  const result = updateTicketStatusSchema.safeParse({
    params: { id: '550e8400-e29b-41d4-a716-446655440000' },
    body: { status: 'INVALID_STATUS' },
  });
  assert(!result.success);
});

test('ticketIdParamSchema validates UUID format', () => {
  const valid = ticketIdParamSchema.safeParse({
    params: { id: '550e8400-e29b-41d4-a716-446655440000' },
  });
  assert(valid.success);

  const invalid = ticketIdParamSchema.safeParse({
    params: { id: '123-not-a-uuid' },
  });
  assert(!invalid.success);
});

// 5. Email Template & Notification Tests
test('buildNotificationEmailHtml renders branding, customer info, and ticket data', () => {
  const payload = {
    ticketNumber: 'TKT-20260925-ABC123',
    name: 'John Doe',
    email: 'johndoe@example.com',
    phone: '+8801700000000',
    subject: 'Refund request for checkout bug',
    inquiryType: 'Payment / Billing',
    orderId: 'MKT-20260925-XYZ987',
    message: 'Hello Support,\nI encountered an error during checkout and was charged twice.',
    createdAt: new Date('2026-09-25T12:00:00Z'),
  };
  const adminUrl = 'https://marketplace.example.com/account?tab=admin-support';
  const html = buildNotificationEmailHtml(payload, adminUrl);

  assert(html.includes('TKT-20260925-ABC123'), 'Must contain ticket number');
  assert(html.includes('John Doe'), 'Must contain customer name');
  assert(html.includes('johndoe@example.com'), 'Must contain customer email');
  assert(html.includes('+8801700000000'), 'Must contain customer phone');
  assert(html.includes('Payment / Billing'), 'Must contain inquiry type');
  assert(html.includes('MKT-20260925-XYZ987'), 'Must contain order ID');
  assert(html.includes('Refund request for checkout bug'), 'Must contain subject');
  assert(html.includes('I encountered an error during checkout'), 'Must contain message');
  assert(html.includes(adminUrl), 'Must contain admin URL button link');
  assert(html.includes('Direct Reply:'), 'Must contain direct reply notice');
});

test('buildNotificationEmailText renders clean plain-text format', () => {
  const payload = {
    ticketNumber: 'TKT-20260925-ABC123',
    name: 'John Doe',
    email: 'johndoe@example.com',
    subject: 'General Question',
    inquiryType: 'General Question',
    message: 'Simple question',
    createdAt: new Date('2026-09-25T12:00:00Z'),
  };
  const adminUrl = 'https://marketplace.example.com/account?tab=admin-support';
  const text = buildNotificationEmailText(payload, adminUrl);

  assert(text.includes('AssetHub — New Customer Support Request'));
  assert(text.includes('TKT-20260925-ABC123'));
  assert(text.includes('johndoe@example.com'));
  assert(text.includes(adminUrl));
});

(async () => {
  // Test sendTicketNotifications returns SKIPPED_NO_API_KEY when no RESEND_API_KEY
  delete process.env.RESEND_API_KEY;
  const result = await sendTicketNotifications({
    ticketNumber: 'TKT-20260925-ABC123',
    name: 'John Doe',
    email: 'johndoe@example.com',
    subject: 'General Question',
    inquiryType: 'General Question',
    message: 'Simple question',
    createdAt: new Date(),
  });
  if (result.status === 'SKIPPED_NO_API_KEY') {
    pass++;
    console.log('  PASS  sendTicketNotifications gracefully returns SKIPPED_NO_API_KEY when key missing');
  } else {
    fail++;
    console.error('  FAIL  Expected SKIPPED_NO_API_KEY but got ' + result.status);
  }

  // Test sendTicketNotifications returns EMAIL_FAILED on API error
  process.env.RESEND_API_KEY = 're_test_key_123';
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: false,
    status: 403,
    json: async () => ({ message: 'Domain not verified', name: 'restricted_api_key' }),
  }) as any;

  const failedResult = await sendTicketNotifications({
    ticketNumber: 'TKT-20260925-FAIL99',
    name: 'John Doe',
    email: 'johndoe@example.com',
    subject: 'General Question',
    inquiryType: 'General Question',
    message: 'Simple question',
    createdAt: new Date(),
  });

  global.fetch = originalFetch;
  delete process.env.RESEND_API_KEY;

  if (failedResult.status === 'EMAIL_FAILED' && failedResult.error === 'Domain not verified') {
    pass++;
    console.log('  PASS  sendTicketNotifications gracefully returns EMAIL_FAILED on provider error');
  } else {
    fail++;
    console.error('  FAIL  Expected EMAIL_FAILED with Domain not verified but got ' + JSON.stringify(failedResult));
  }

  console.log(`\nResults: ${pass} PASSED, ${fail} FAILED`);
  if (fail > 0) process.exit(1);
})();
