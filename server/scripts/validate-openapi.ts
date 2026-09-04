/**
 * Validates the generated OpenAPI document.
 *
 * swagger-jsdoc parses JSDoc YAML SILENTLY: a malformed block is skipped and the
 * route simply vanishes from the docs with no warning at build time. A spec that
 * "looks fine" in Swagger UI can therefore be missing half the API, so the only
 * trustworthy check is to assert against the generated document itself.
 */
import type { swaggerSpec as SwaggerSpecType } from '../src/config/swagger';

// Safe mock environment defaults so the OpenAPI document can be validated in
// isolated environments (e.g. CI) without requiring real secrets or a database.
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

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { swaggerSpec } = require('../src/config/swagger') as { swaggerSpec: typeof SwaggerSpecType };

interface Spec {
  openapi: string;
  paths: Record<string, Record<string, unknown>>;
  components: { schemas: Record<string, unknown>; responses: Record<string, unknown> };
  tags: { name: string }[];
}
const spec = swaggerSpec as unknown as Spec;

let pass = 0, fail = 0;
const check = (label: string, ok: boolean, extra = ''): void => {
  if (ok) { pass++; console.log(`  PASS  ${label}`); }
  else { fail++; console.log(`  FAIL  ${label}${extra ? `  (${extra})` : ''}`); }
};

console.log('=== 1. Document shape ===');
check('openapi version present', spec.openapi === '3.0.3', spec.openapi);
check('paths object is non-empty', Object.keys(spec.paths ?? {}).length > 0);

console.log('\n=== 2. Every auth route is documented ===');
const expected: [string, string][] = [
  ['/auth/register', 'post'],
  ['/auth/login', 'post'],
  ['/auth/refresh', 'post'],
  ['/auth/logout', 'post'],
  ['/auth/logout-all', 'post'],
  ['/auth/me', 'get'],
  ['/auth/change-password', 'patch'],
];
for (const [p, m] of expected) {
  check(`${m.toUpperCase()} ${p}`, !!spec.paths[p]?.[m], 'missing from generated spec');
}
const authPaths = Object.keys(spec.paths).filter((p) => p.startsWith('/auth'));
check('no unexpected/typo auth paths', authPaths.length === expected.length,
  `found ${authPaths.length}: ${authPaths.join(', ')}`);

console.log('\n=== 3. Public endpoints opt out of bearer auth ===');
for (const p of ['/auth/register', '/auth/login', '/auth/logout']) {
  const op = spec.paths[p]?.post as { security?: unknown[] } | undefined;
  check(`${p} declares security: []`, Array.isArray(op?.security) && op.security.length === 0);
}
const refreshOp = spec.paths['/auth/refresh']?.post as { security?: Record<string, unknown>[] };
check('/auth/refresh declares cookieAuth', !!refreshOp?.security?.some((s) => 'cookieAuth' in s));
for (const p of ['/auth/me', '/auth/logout-all', '/auth/change-password']) {
  const m = p === '/auth/me' ? 'get' : p === '/auth/change-password' ? 'patch' : 'post';
  const op = spec.paths[p]?.[m] as { security?: unknown[] } | undefined;
  check(`${p} inherits global bearerAuth`, op?.security === undefined);
}

console.log('\n=== 4. Request bodies are described, not just mentioned ===');
for (const [p, m] of [['/auth/register', 'post'], ['/auth/login', 'post'], ['/auth/change-password', 'patch']] as const) {
  const op = spec.paths[p]?.[m] as { requestBody?: { required?: boolean; content?: Record<string, unknown> } };
  check(`${p} has a required requestBody`, op?.requestBody?.required === true);
  check(`${p} requestBody has an application/json schema`,
    !!op?.requestBody?.content?.['application/json']);
}
for (const p of ['/auth/refresh', '/auth/logout']) {
  const op = spec.paths[p]?.post as { requestBody?: unknown };
  check(`${p} correctly declares NO requestBody`, op?.requestBody === undefined);
}

console.log('\n=== 5. Set-Cookie documented where the cookie actually changes ===');
for (const [p, m, code] of [
  ['/auth/register', 'post', '201'], ['/auth/login', 'post', '200'],
  ['/auth/refresh', 'post', '200'], ['/auth/logout', 'post', '200'],
  ['/auth/logout-all', 'post', '200'],
] as const) {
  const res = (spec.paths[p]?.[m] as { responses: Record<string, { headers?: Record<string, unknown> }> })
    ?.responses?.[code];
  check(`${p} ${code} documents Set-Cookie`, !!res?.headers?.['Set-Cookie']);
}

console.log('\n=== 6. Error responses declared ===');
const wants: Record<string, string[]> = {
  '/auth/register|post': ['201', '409', '422', '429'],
  '/auth/login|post': ['200', '401', '403', '422', '429'],
  '/auth/refresh|post': ['200', '401', '403', '429'],
  '/auth/logout|post': ['200'],
  '/auth/me|get': ['200', '401'],
  '/auth/logout-all|post': ['200', '401'],
  '/auth/change-password|patch': ['200', '401', '403', '422'],
};
for (const [key, codes] of Object.entries(wants)) {
  const [p, m] = key.split('|') as [string, string];
  const res = (spec.paths[p]?.[m] as { responses: Record<string, unknown> })?.responses ?? {};
  const missing = codes.filter((c) => !(c in res));
  check(`${m.toUpperCase()} ${p} documents [${codes.join(', ')}]`, missing.length === 0,
    `missing ${missing.join(', ')}`);
}

console.log('\n=== 7. Every $ref resolves (no dangling references) ===');
const refs = new Set<string>();
const walk = (node: unknown): void => {
  if (Array.isArray(node)) { node.forEach(walk); return; }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (k === '$ref' && typeof v === 'string') refs.add(v);
      else walk(v);
    }
  }
};
walk(spec);
const dangling: string[] = [];
for (const ref of refs) {
  const parts = ref.replace(/^#\//, '').split('/');
  let cur: unknown = spec;
  for (const part of parts) {
    cur = (cur as Record<string, unknown> | undefined)?.[part];
    if (cur === undefined) break;
  }
  if (cur === undefined) dangling.push(ref);
}
check(`all ${refs.size} $refs resolve`, dangling.length === 0, `dangling: ${dangling.join(', ')}`);

console.log('\n=== 8. Every referenced tag is declared ===');
const declared = new Set((spec.tags ?? []).map((t) => t.name));
const used = new Set<string>();
for (const ops of Object.values(spec.paths)) {
  for (const op of Object.values(ops)) {
    for (const t of ((op as { tags?: string[] }).tags ?? [])) used.add(t);
  }
}
const undeclared = [...used].filter((t) => !declared.has(t));
check('no undeclared tags', undeclared.length === 0, `undeclared: ${undeclared.join(', ')}`);
console.log(`  info  tags in use: ${[...used].sort().join(', ')}`);

console.log('\n=== 9. Docs must not leak secrets ===');
const json = JSON.stringify(spec);
for (const s of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'sk_test', 'sk_live', 'whsec_',
  'SSLCZ_STORE_PASSWORD', 'DATABASE_URL', 'devpass', 'testpass']) {
  check(`no '${s}' in spec`, !json.includes(s));
}

console.log('\n=== 10. Coverage across all modules ===');
let documented = 0, undocumentedOps: string[] = [];
for (const [p, ops] of Object.entries(spec.paths)) {
  for (const [m, op] of Object.entries(ops)) {
    documented++;
    if (!(op as { responses?: unknown }).responses) undocumentedOps.push(`${m} ${p}`);
  }
}
check('every documented operation declares responses', undocumentedOps.length === 0,
  undocumentedOps.join(', '));
console.log(`  info  ${documented} operations documented across ${Object.keys(spec.paths).length} paths`);

console.log(`\nPASSED=${pass}  FAILED=${fail}`);
process.exit(fail > 0 ? 1 : 0);
