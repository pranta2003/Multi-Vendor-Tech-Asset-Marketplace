import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { authLimiter } from '../../middleware/rateLimiter';
import * as controller from './auth.controller';
import { changePasswordSchema, loginSchema, registerSchema } from './auth.validation';

const router = Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     RegisterRequest:
 *       type: object
 *       required: [email, password, fullName]
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           maxLength: 255
 *           description: Trimmed and lower-cased before storage. Stored in a `citext` column, so addresses are unique case-insensitively.
 *           example: buyer@example.com
 *         password:
 *           type: string
 *           minLength: 8
 *           maxLength: 128
 *           description: >
 *             Must contain at least one lowercase letter, one uppercase letter and one digit.
 *             Hashed with argon2id; the plaintext is never stored or logged.
 *           example: Str0ngPass
 *         fullName:
 *           type: string
 *           minLength: 2
 *           maxLength: 120
 *           example: Pranta Kumer Pandit
 *         phone:
 *           type: string
 *           description: Optional Bangladeshi mobile number. Accepts an optional `+88`/`88` prefix followed by `01[3-9]` and eight digits.
 *           example: "01712345678"
 *         role:
 *           type: string
 *           enum: [CUSTOMER, VENDOR]
 *           default: CUSTOMER
 *           description: >
 *             Self-service signup is limited to CUSTOMER and VENDOR by design.
 *             ADMIN is intentionally not accepted here - allowing it would be a
 *             privilege-escalation hole, so admins are provisioned out of band.
 *         storeName:
 *           type: string
 *           minLength: 3
 *           maxLength: 80
 *           description: Required when `role` is VENDOR, ignored otherwise. A new vendor starts in PENDING status and cannot publish until approved.
 *           example: PixelForge
 *
 *     LoginRequest:
 *       type: object
 *       required: [email, password]
 *       properties:
 *         email: { type: string, format: email, example: buyer@example.com }
 *         password: { type: string, example: Str0ngPass }
 *
 *     ChangePasswordRequest:
 *       type: object
 *       required: [currentPassword, newPassword]
 *       properties:
 *         currentPassword: { type: string }
 *         newPassword:
 *           type: string
 *           minLength: 8
 *           maxLength: 128
 *           description: Same strength rules as registration - lowercase, uppercase and a digit.
 *
 *     AuthResponse:
 *       type: object
 *       required: [success, message, data]
 *       properties:
 *         success: { type: boolean, example: true }
 *         message: { type: string, example: Login successful }
 *         data: { $ref: '#/components/schemas/AuthPayload' }
 */

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Create a customer or vendor account
 *     description: >
 *       Registers an account and immediately establishes a session, so the client
 *       does not have to make a second login call.
 *
 *
 *       Registering as a VENDOR also creates the vendor profile in PENDING state.
 *       A pending vendor can sign in but cannot sell: product listing requires an
 *       APPROVED vendor, which is enforced in the data-access predicates rather
 *       than by a UI check.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/RegisterRequest' }
 *           examples:
 *             customer:
 *               summary: Customer signup
 *               value: { email: buyer@example.com, password: Str0ngPass, fullName: Pranta Kumer Pandit, phone: "01712345678" }
 *             vendor:
 *               summary: Vendor signup (storeName required)
 *               value: { email: seller@example.com, password: Str0ngPass, fullName: Ayesha Rahman, role: VENDOR, storeName: PixelForge }
 *     responses:
 *       201:
 *         description: Account created and session established.
 *         headers:
 *           Set-Cookie:
 *             description: '`refresh_token=<jwt>; HttpOnly; SameSite=Lax; Path=/api/v1/auth; Max-Age=...` (adds `Secure` whenever COOKIE_SECURE is enabled, which is mandatory in production).'
 *             schema: { type: string }
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthResponse' }
 *       409:
 *         description: Email address is already registered.
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorBody' } } }
 *       422: { $ref: '#/components/responses/ValidationFailed' }
 *       429: { $ref: '#/components/responses/RateLimited' }
 */
router.post('/register', authLimiter, validate(registerSchema), controller.register);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Exchange credentials for an access token and a refresh cookie
 *     description: >
 *       Returns the access token in the body and sets the refresh token as an
 *       HttpOnly cookie. Clients should keep the access token in memory only -
 *       persisting it to `localStorage` would hand a working credential to any
 *       injected script.
 *
 *
 *       Wrong password and unknown email produce the identical 401 body. Saying
 *       "no such user" would turn this endpoint into an account-enumeration
 *       oracle. A dummy argon2 hash is also computed when the email does not
 *       exist, so the two paths take comparable time and response latency does
 *       not leak account existence either.
 *
 *
 *       Rate limiting is configured with `skipSuccessfulRequests`, so the budget
 *       is consumed by failed attempts only. Legitimate users are not locked out
 *       by ordinary activity, while credential stuffing is throttled.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/LoginRequest' }
 *     responses:
 *       200:
 *         description: Authenticated.
 *         headers:
 *           Set-Cookie:
 *             description: Sets the `refresh_token` HttpOnly cookie scoped to `Path=/api/v1/auth`.
 *             schema: { type: string }
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthResponse' }
 *       401:
 *         description: >
 *           Invalid credentials. Returned for both a wrong password and an
 *           unknown email, with an identical body in each case.
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorBody' } } }
 *       403:
 *         description: >
 *           Credentials were correct but the account is deactivated. This is
 *           distinct from 401 on purpose - the caller has proven ownership of the
 *           account, so telling them it is disabled reveals nothing they do not
 *           already know and saves them retrying a password that is not the problem.
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorBody' } } }
 *       422: { $ref: '#/components/responses/ValidationFailed' }
 *       429: { $ref: '#/components/responses/RateLimited' }
 */
router.post('/login', authLimiter, validate(loginSchema), controller.login);

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Rotate the refresh token and issue a new access token
 *     description: >
 *       Reads the `refresh_token` cookie - there is no request body, and the
 *       token is never accepted from a header or JSON field. Keeping it to the
 *       cookie means client code has no way to read or misplace it.
 *
 *
 *       **This endpoint rotates.** The presented token is invalidated and a
 *       replacement cookie is issued. Consequences callers must design for:
 *
 *
 *       - Reusing an already-consumed token returns 401 and **revokes the whole
 *         token family**, because the only innocent explanation for a replay is a
 *         buggy client, while the dangerous one is a stolen token being used
 *         alongside the legitimate session. Revoking everything is the safe
 *         reading, and it forces the real user through a fresh login.
 *       - Therefore **never issue concurrent refreshes.** A client that fires
 *         three parallel refreshes replays a consumed token twice and logs the
 *         user out. Serialise them behind a single in-flight promise.
 *       - A 401 that arrives *after* a successful refresh is stale - it belongs to
 *         a request sent with the previous token. Replay that request with the
 *         current token instead of refreshing again.
 *
 *
 *       Tokens are stored server-side as SHA-256 digests, so a database disclosure
 *       does not yield usable refresh tokens.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: New access token issued and the refresh cookie replaced.
 *         headers:
 *           Set-Cookie:
 *             description: A NEW `refresh_token` value. The previous one is now dead - clients must not retain it.
 *             schema: { type: string }
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthResponse' }
 *       401:
 *         description: >
 *           Cookie absent, signature invalid, unknown, expired, already rotated
 *           (replay - the family is revoked), or issued before the password was
 *           last changed. Treat any of these as a definitive logout: clear local
 *           state and route to the login screen.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorBody' }
 *             examples:
 *               missing:
 *                 summary: No cookie sent
 *                 value: { success: false, message: Refresh token cookie is missing, code: UNAUTHORIZED, requestId: 01JD5X2M }
 *               unknown:
 *                 summary: Token not found
 *                 value: { success: false, message: Invalid refresh token, code: UNAUTHORIZED, requestId: 01JD5X3P }
 *               replayed:
 *                 summary: Consumed token replayed - entire family revoked
 *                 value: { success: false, message: Session compromised. Please log in again., code: UNAUTHORIZED, requestId: 01JD5X4Q }
 *               staleAfterPasswordChange:
 *                 summary: Token predates the last password change
 *                 value: { success: false, message: Credentials changed. Please log in again., code: UNAUTHORIZED, requestId: 01JD5X5R }
 *       403:
 *         description: The token was valid but the account has been deactivated.
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorBody' } } }
 *       429: { $ref: '#/components/responses/RateLimited' }
 */
router.post('/refresh', authLimiter, controller.refresh);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Revoke the current session's refresh token
 *     description: >
 *       Revokes the token in the cookie and clears it.
 *
 *
 *       Deliberately **idempotent and unauthenticated**: it succeeds even with a
 *       missing, expired or already-revoked cookie. Requiring a valid access
 *       token here would mean an expired session could not be cleaned up - the
 *       exact moment logging out matters most - and returning an error would give
 *       clients a reason to leave a live refresh cookie in place.
 *
 *
 *       Only this session is revoked; other devices stay signed in. Use
 *       `/auth/logout-all` to revoke everything.
 *
 *
 *       The access token is a stateless JWT and cannot be revoked, so it stays
 *       valid until it expires. That is the accepted trade-off for its very short
 *       lifetime, and it is why clients must also discard it in memory.
 *     security: []
 *     responses:
 *       200:
 *         description: Session revoked. Returned even if no valid cookie was present.
 *         headers:
 *           Set-Cookie:
 *             description: Clears `refresh_token` using the same attributes it was set with - a mismatched Path or Domain silently fails to clear the cookie.
 *             schema: { type: string }
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Logged out successfully }
 *                 data: { type: object, nullable: true, example: null }
 */
router.post('/logout', controller.logout);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get the authenticated user's profile
 *     description: >
 *       Reads the user from the database rather than trusting the JWT claims, so
 *       a role change or suspension takes effect immediately instead of lingering
 *       until the access token expires.
 *     responses:
 *       200:
 *         description: Current user.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Current user retrieved }
 *                 data:
 *                   type: object
 *                   properties:
 *                     user: { $ref: '#/components/schemas/PublicUser' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/me', authenticate, controller.me);

/**
 * @openapi
 * /auth/logout-all:
 *   post:
 *     tags: [Auth]
 *     summary: Revoke every refresh token for the current user
 *     description: >
 *       Signs the user out of all devices and returns how many sessions were
 *       revoked. This is the user-facing remedy for a suspected compromise, and
 *       the non-zero count is what makes it trustworthy - it tells the user
 *       whether sessions they did not recognise actually existed.
 *
 *
 *       Requires a valid access token, unlike `/auth/logout`, because this affects
 *       sessions beyond the caller's own.
 *     responses:
 *       200:
 *         description: All sessions revoked.
 *         headers:
 *           Set-Cookie:
 *             description: Clears the caller's own `refresh_token` cookie as well.
 *             schema: { type: string }
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: All sessions revoked }
 *                 data:
 *                   type: object
 *                   properties:
 *                     revokedSessions: { type: integer, example: 3 }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.post('/logout-all', authenticate, controller.logoutAll);

/**
 * @openapi
 * /auth/change-password:
 *   patch:
 *     tags: [Auth]
 *     summary: Change the current user's password
 *     description: >
 *       Requires `currentPassword` even though the caller is already
 *       authenticated. A bearer token proves possession of a session, not that
 *       the person at the keyboard is the account owner - re-authenticating stops
 *       an unattended tab or a stolen access token from taking over the account.
 *
 *
 *       On success **every refresh token for the user is revoked**, including the
 *       caller's, and the cookie is cleared. A password change is the standard
 *       response to a suspected compromise, so leaving other sessions alive would
 *       defeat its purpose. Clients must expect to be logged out and should route
 *       straight to the login screen; the 200 message says as much.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ChangePasswordRequest' }
 *     responses:
 *       200:
 *         description: Password changed. All sessions revoked - the client must sign in again.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: 'Password changed. Please log in again.' }
 *                 data: { type: object, nullable: true, example: null }
 *       401:
 *         description: Not authenticated, or `currentPassword` is wrong.
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorBody' } } }
 *       403:
 *         description: The account has no password set, so there is nothing to change.
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorBody' } } }
 *       422: { $ref: '#/components/responses/ValidationFailed' }
 */
router.patch('/change-password', authenticate, validate(changePasswordSchema), controller.changePassword);

export default router;
