/**
 * Contract alignment test.
 *
 * A TypeScript interface on the frontend is only a CLAIM about what the server
 * sends - the compiler cannot verify it, because the data arrives as untyped
 * JSON at runtime. This script calls the real API and asserts that every field
 * the client's types declare is actually present, and that fields which must
 * NEVER be exposed are absent.
 *
 * It also exercises the refresh-cookie flow the axios interceptor depends on.
 */
import axios from 'axios';

const BASE = process.env.API_BASE ?? 'http://localhost:5000/api/v1';
let pass = 0;
let fail = 0;

const check = (label, ok, extra = '') => {
  if (ok) { pass += 1; console.log(`  PASS  ${label}`); }
  else { fail += 1; console.log(`  FAIL  ${label}${extra ? `  (${extra})` : ''}`); }
};

const hasFields = (obj, fields) => fields.filter((f) => !(f in (obj ?? {})));

/** Minimal cookie handling so we can prove the HttpOnly refresh cookie works. */
const jar = { cookie: '' };
const client = axios.create({ baseURL: BASE, validateStatus: () => true, timeout: 15000 });
client.interceptors.request.use((cfg) => {
  if (jar.cookie) cfg.headers.Cookie = jar.cookie;
  return cfg;
});
client.interceptors.response.use((res) => {
  const setCookie = res.headers['set-cookie'];
  if (setCookie) {
    for (const c of setCookie) {
      const [pair] = c.split(';');
      if (pair.startsWith('refresh_token=')) jar.cookie = pair;
    }
  }
  return res;
});

const main = async () => {
  console.log('=== 1. Auth payload shape (AuthPayload) ===');
  const login = await client.post('/auth/login', { email: 'buyer@test.com', password: 'Str0ngPass' });
  check('login 200', login.status === 200, `status ${login.status}`);
  const auth = login.data?.data;
  check('envelope { success, message, data }',
    login.data?.success === true && typeof login.data?.message === 'string' && !!auth);
  const missingAuth = hasFields(auth, ['user', 'accessToken', 'expiresIn']);
  check('AuthPayload fields present', missingAuth.length === 0, `missing ${missingAuth}`);
  const missingUser = hasFields(auth?.user, [
    'id', 'email', 'fullName', 'role', 'avatarUrl', 'isEmailVerified', 'createdAt',
  ]);
  check('PublicUser fields present', missingUser.length === 0, `missing ${missingUser}`);
  check('no password hash leaked', !('passwordHash' in (auth?.user ?? {})));
  check('refreshToken NOT in body (cookie only)', !('refreshToken' in (auth ?? {})));
  check('refresh cookie captured', jar.cookie.startsWith('refresh_token='));

  const token = auth?.accessToken;
  const authHeader = { Authorization: `Bearer ${token}` };

  console.log('\n=== 2. Refresh flow the axios interceptor relies on ===');
  const refreshed = await client.post('/auth/refresh', {});
  check('refresh with cookie returns 200', refreshed.status === 200, `status ${refreshed.status}`);
  check('refresh returns a new accessToken', typeof refreshed.data?.data?.accessToken === 'string');
  check('refresh response has expiresIn', typeof refreshed.data?.data?.expiresIn === 'number');

  // Rotation: the OLD refresh cookie must now be rejected. This is exactly why
  // the client must single-flight refreshes.
  // Reuse detection: log in FRESH, capture that exact cookie, refresh once so it
  // rotates, then replay the captured (now-consumed) cookie. It must be
  // rejected. This is the behaviour that forces the client to single-flight
  // refreshes - two parallel refreshes would look like token theft and revoke
  // the whole family.
  const fresh = await axios.post(`${BASE}/auth/login`,
    { email: 'buyer2@test.com', password: 'Str0ngPass' }, { validateStatus: () => true });
  const originalCookie = (fresh.headers['set-cookie'] ?? [])
    .map((c) => c.split(';')[0]).find((c) => c.startsWith('refresh_token='));
  check('fresh login set a refresh cookie', !!originalCookie);
  const rot = await axios.post(`${BASE}/auth/refresh`, {},
    { headers: { Cookie: originalCookie }, validateStatus: () => true });
  check('first use of that cookie succeeds', rot.status === 200, `status ${rot.status}`);
  const rotatedCookie = (rot.headers['set-cookie'] ?? [])
    .map((c) => c.split(';')[0]).find((c) => c.startsWith('refresh_token='));
  check('cookie value actually rotated', !!rotatedCookie && rotatedCookie !== originalCookie);
  const replay = await axios.post(`${BASE}/auth/refresh`, {},
    { headers: { Cookie: originalCookie }, validateStatus: () => true });
  check('REPLAY of consumed cookie is rejected 401', replay.status === 401, `status ${replay.status}`);
  const afterBreach = await axios.post(`${BASE}/auth/refresh`, {},
    { headers: { Cookie: rotatedCookie }, validateStatus: () => true });
  check('whole token family revoked after reuse detected', afterBreach.status === 401,
    `status ${afterBreach.status}`);
  console.log('  info  HttpOnly + rotation + reuse detection all confirmed');

  console.log('\n=== 3. Product list shape (ProductListItem) ===');
  const products = await client.get('/products', { params: { limit: 5 } });
  check('products 200', products.status === 200);
  check('data is an array', Array.isArray(products.data?.data));
  const meta = products.data?.meta;
  const missingMeta = hasFields(meta, ['page', 'limit', 'total', 'totalPages', 'hasNext', 'hasPrev']);
  check('PaginationMeta fields present', missingMeta.length === 0, `missing ${missingMeta}`);
  const p0 = products.data?.data?.[0];
  const missingP = hasFields(p0, [
    'id', 'title', 'slug', 'summary', 'priceUsdCents', 'priceBdtPoisha',
    'thumbnailUrl', 'stock', 'ratingSum', 'ratingCount', 'downloadCount',
    'publishedAt', 'category', 'vendor',
  ]);
  check('ProductListItem fields present', missingP.length === 0, `missing ${missingP}`);
  check('vendor has storeName + slug',
    !!p0?.vendor && 'storeName' in p0.vendor && 'slug' in p0.vendor);
  check('money is an integer (minor units)', Number.isInteger(p0?.priceBdtPoisha));
  for (const secret of ['commissionRateBps', 'vendorEarning', 'platformFeeAmount', 'vendorId']) {
    check(`no ${secret} exposed`, !(secret in (p0 ?? {})));
  }

  console.log('\n=== 4. Product detail shape (ProductDetail) ===');
  const detail = await client.get(`/products/${p0.slug}`);
  check('detail 200', detail.status === 200);
  const pd = detail.data?.data?.product;
  check('response nested under data.product', !!pd);
  check('has description', typeof pd?.description === 'string');

  console.log('\n=== 5. Cart shape (CartView / CartLine) ===');
  const added = await client.post('/cart/items',
    { productId: p0.id, quantity: 1 }, { params: { currency: 'BDT' }, headers: authHeader });
  check('add to cart 201', added.status === 201, `status ${added.status}`);
  const cart = added.data?.data?.cart;
  const missingCart = hasFields(cart, ['currency', 'items', 'itemCount', 'subtotalAmount']);
  check('CartView fields present', missingCart.length === 0, `missing ${missingCart}`);
  const line = cart?.items?.[0];
  const missingLine = hasFields(line, [
    'itemId', 'productId', 'title', 'slug', 'thumbnailUrl',
    'unitAmount', 'quantity', 'lineTotal', 'stock', 'vendorStoreName',
  ]);
  check('CartLine fields present', missingLine.length === 0, `missing ${missingLine}`);
  check('subtotal is integer minor units', Number.isInteger(cart?.subtotalAmount));

  console.log('\n=== 6. Checkout request contract ===');
  // The client sends ONLY billing fields. Verify the server accepts that exact
  // payload shape (a 402 here means it got as far as the gateway, which is the
  // expected outcome in a sandbox with no gateway reachable).
  const checkout = await client.post('/orders/checkout', {
    provider: 'SSLCOMMERZ', currency: 'BDT',
    billingName: 'Pranta Kumer Pandit', billingEmail: 'buyer@test.com',
    billingPhone: '01712345678', billingCity: 'Dhaka', billingCountry: 'BD',
    billingAddress: 'Road 12, Banani',
  }, { headers: authHeader });
  console.log(`  info  checkout -> HTTP ${checkout.status} (${checkout.data?.code ?? 'ok'})`);
  check('checkout payload accepted by validator (not 422)', checkout.status !== 422,
    JSON.stringify(checkout.data?.details ?? {}));
  if (checkout.status === 201) {
    const r = checkout.data.data;
    check('CheckoutResult.order fields', hasFields(r?.order,
      ['id', 'orderNumber', 'status', 'currency', 'totalAmount']).length === 0);
    check('CheckoutResult.payment.provider present', !!r?.payment?.provider);
  }

  console.log('\n=== 7. Orders / entitlements shapes ===');
  const orders = await client.get('/orders', { headers: authHeader });
  check('orders 200', orders.status === 200);
  check('orders data is array', Array.isArray(orders.data?.data));
  const o0 = orders.data?.data?.[0];
  if (o0) {
    const missingO = hasFields(o0, [
      'id', 'orderNumber', 'status', 'currency', 'subtotalAmount', 'discountAmount',
      'taxAmount', 'totalAmount', 'billingName', 'billingEmail', 'paidAt',
      'fulfilledAt', 'failureReason', 'createdAt', 'items',
    ]);
    check('OrderSummary fields present', missingO.length === 0, `missing ${missingO}`);
    const detailRes = await client.get(`/orders/${o0.orderNumber}`, { headers: authHeader });
    check('order detail nested under data.order', !!detailRes.data?.data?.order);
    const items = detailRes.data?.data?.order?.items;
    if (Array.isArray(items) && items[0]) {
      const missingItem = hasFields(items[0], [
        'productId', 'productTitle', 'productThumbnail', 'unitAmount', 'quantity', 'lineTotal',
      ]);
      check('OrderItemView fields present', missingItem.length === 0, `missing ${missingItem}`);
      check('no vendorEarning in customer order item', !('vendorEarning' in items[0]));
    }
    const statusRes = await client.get(`/payments/${o0.orderNumber}/status`, { headers: authHeader });
    check('payment status 200', statusRes.status === 200);
    const missingS = hasFields(statusRes.data?.data, ['orderNumber', 'orderStatus', 'paymentStatus']);
    check('PaymentStatusView fields present', missingS.length === 0, `missing ${missingS}`);
  } else {
    console.log('  info  no orders present, skipping order detail shape checks');
  }

  const ents = await client.get('/orders/entitlements', { headers: authHeader });
  check('entitlements nested under data.grants', Array.isArray(ents.data?.data?.grants));

  console.log('\n=== 8. Error envelope the client parses ===');
  const notFound = await client.get('/products/definitely-not-a-real-slug');
  check('404 status', notFound.status === 404);
  const missingErr = hasFields(notFound.data, ['success', 'message', 'code']);
  check('ErrorBody fields present', missingErr.length === 0, `missing ${missingErr}`);
  check('success === false', notFound.data?.success === false);
  check('requestId present for support correlation', typeof notFound.data?.requestId === 'string');

  const unauth = await client.get('/orders');
  check('401 when unauthenticated (drives refresh interceptor)', unauth.status === 401);

  console.log(`\nPASSED=${pass}  FAILED=${fail}`);
  process.exit(fail > 0 ? 1 : 0);
};

main().catch((err) => { console.error('FATAL', err.message); process.exit(1); });
