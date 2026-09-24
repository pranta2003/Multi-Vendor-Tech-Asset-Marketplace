import assert from 'node:assert';
import {
  createContactSchema,
  listTicketsSchema,
  updateTicketStatusSchema,
  ticketIdParamSchema,
  INQUIRY_TYPES,
} from '../src/modules/contact/contact.validation';
import { generateTicketNumber } from '../src/utils/identifiers';

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

console.log(`\nResults: ${pass} PASSED, ${fail} FAILED`);
if (fail > 0) process.exit(1);
