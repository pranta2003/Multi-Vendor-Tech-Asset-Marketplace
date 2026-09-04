/**
 * Exercises the REAL src/lib/api.ts module (not a re-implementation) against a
 * stub server that counts refresh calls.
 *
 * The property under test is the one that actually matters in production: the
 * server rotates refresh tokens and treats a reused token as theft, revoking the
 * entire family. So if three requests 401 simultaneously and the client fires
 * three refreshes, two of them replay a consumed token and the user is force
 * logged out. Only a single-flight refresh is safe.
 */
import express from 'express';
import type { Server } from 'node:http';
import { api, getAccessToken, setAccessToken, setSessionExpiredHandler, ApiClientError } from '../src/lib/api';

let pass = 0, fail = 0;
const check = (label: string, ok: boolean, extra = ''): void => {
  if (ok) { pass++; console.log(`  PASS  ${label}`); }
  else { fail++; console.log(`  FAIL  ${label}${extra ? `  (${extra})` : ''}`); }
};

let refreshCalls = 0;
let protectedCalls = 0;
let currentToken = 'token-v1';
let refreshShouldFail = false;

const app = express();
app.use(express.json());

app.post('/api/v1/auth/refresh', (_req, res) => {
  refreshCalls += 1;
  if (refreshShouldFail) {
    res.status(401).json({ success: false, message: 'Refresh token expired', code: 'UNAUTHORIZED', requestId: 'r1' });
    return;
  }
  currentToken = `token-v${refreshCalls + 1}`;
  res.json({ success: true, message: 'ok', data: { user: { id: 'u1', email: 'a@b.c', fullName: 'A', role: 'CUSTOMER', avatarUrl: null, isEmailVerified: true, createdAt: new Date().toISOString() }, accessToken: currentToken, expiresIn: 900 } });
});

app.get('/api/v1/protected', (req, res) => {
  protectedCalls += 1;
  const sent = String(req.headers.authorization ?? '').replace('Bearer ', '');
  if (sent !== currentToken) {
    res.status(401).json({ success: false, message: 'Access token expired', code: 'UNAUTHORIZED', requestId: 'r2' });
    return;
  }
  res.json({ success: true, message: 'ok', data: { ok: true, tokenUsed: sent } });
});

app.get('/api/v1/always401', (_req, res) => {
  res.status(401).json({ success: false, message: 'nope', code: 'UNAUTHORIZED', requestId: 'r3' });
});

app.get('/api/v1/boom', (_req, res) => {
  res.status(409).json({ success: false, message: 'Conflict', code: 'CONFLICT', requestId: 'r4', details: { retry: true } });
});

const main = async (): Promise<void> => {
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(5099, () => resolve(s));
  });

  console.log('=== 1. Single-flight refresh under concurrent 401s ===');
  // Prime the client with a token the stub will reject, forcing a 401 storm.
  setAccessToken('stale-token');
  refreshCalls = 0; protectedCalls = 0;

  const results = await Promise.all([
    api.get('/protected'), api.get('/protected'), api.get('/protected'),
    api.get('/protected'), api.get('/protected'),
  ]);
  check('all 5 concurrent requests succeeded', results.every((r) => r.data.success === true));
  check('exactly ONE refresh call for 5 parallel 401s', refreshCalls === 1, `got ${refreshCalls}`);
  check('each request was retried once (5 fails + 5 retries)', protectedCalls === 10, `got ${protectedCalls}`);
  const tokens = new Set(results.map((r) => (r.data.data as { tokenUsed: string }).tokenUsed));
  check('all retries used the SAME new token', tokens.size === 1, `tokens ${[...tokens]}`);

  console.log('\n=== 2. Subsequent requests reuse the refreshed token (no re-refresh) ===');
  const before = refreshCalls;
  await api.get('/protected');
  check('no extra refresh when token is valid', refreshCalls === before, `got ${refreshCalls}`);

  console.log('\n=== 3. One-shot retry: a 401 after refresh must not loop ===');
  const callsBefore = refreshCalls;
  try {
    await api.get('/always401');
    check('always401 should have thrown', false);
  } catch (err) {
    check('threw ApiClientError', err instanceof ApiClientError);
    check('refreshed at most once, no infinite loop', refreshCalls - callsBefore <= 1,
      `${refreshCalls - callsBefore} refreshes`);
    // A 401 on the RETRY must keep its real code. Reporting SESSION_EXPIRED here
    // would log out a user whose session is perfectly valid.
    check('retry 401 is NOT misreported as SESSION_EXPIRED',
      (err as ApiClientError).code !== 'SESSION_EXPIRED', `code ${(err as ApiClientError).code}`);
    check('session survived a forbidden endpoint', getAccessToken() !== null);
  }

  console.log('\n=== 4. Failed refresh triggers the session-expired handler exactly once ===');
  let expiredCount = 0;
  setSessionExpiredHandler(() => { expiredCount += 1; });
  refreshShouldFail = true;
  currentToken = 'rotated-away';
  await Promise.allSettled([api.get('/protected'), api.get('/protected'), api.get('/protected')]);
  check('session-expired handler fired', expiredCount >= 1, `fired ${expiredCount}x`);
  check('handler not fired once per request (deduped)', expiredCount === 1, `fired ${expiredCount}x`);
  refreshShouldFail = false;

  console.log('\n=== 5. Error normalisation ===');
  try {
    await api.get('/boom');
    check('boom should have thrown', false);
  } catch (err) {
    const e = err as ApiClientError;
    check('ApiClientError instance', e instanceof ApiClientError);
    check('status carried through', e.status === 409, `status ${e.status}`);
    check('code carried through', e.code === 'CONFLICT', `code ${e.code}`);
    check('requestId carried through', e.requestId === 'r4', `requestId ${e.requestId}`);
    check('message is the server message, not "Request failed with status code 409"',
      e.message === 'Conflict', `message "${e.message}"`);
    check('409 marked retryable', e.isRetryable === true);
  }

  console.log('\n=== 6. Auth-free paths never attempt a refresh ===');
  const rc = refreshCalls;
  await api.post('/auth/refresh', {}).catch(() => undefined);
  check('a 401 on an AUTH_FREE_PATH does not recurse into refresh',
    refreshCalls - rc <= 1, `${refreshCalls - rc} calls`);

  server.close();
  console.log(`\nPASSED=${pass}  FAILED=${fail}`);
  process.exit(fail > 0 ? 1 : 0);
};

void main();
