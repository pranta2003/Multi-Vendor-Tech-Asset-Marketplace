import { Router } from 'express';
import { authenticate, optionalAuthenticate } from '../../middleware/authenticate';
import { requireAdmin } from '../../middleware/authorize';
import { contactLimiter } from '../../middleware/rateLimiter';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import * as contactController from './contact.controller';
import {
  createContactSchema,
  listTicketsSchema,
  ticketIdParamSchema,
  updateTicketStatusSchema,
} from './contact.validation';

const router = Router();

/**
 * @openapi
 * /contact:
 *   post:
 *     tags: [Support]
 *     summary: Submit customer support inquiry or contact message
 *     description: >
 *       Public endpoint allowing visitors or customers to submit an inquiry,
 *       payment dispute, license question, or general complaint. If an Authorization
 *       Bearer header is present, the ticket is linked to the authenticated user account.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, subject, inquiryType, message]
 *             properties:
 *               name: { type: string, example: "Alex Mercer" }
 *               email: { type: string, format: email, example: "alex@example.com" }
 *               phone: { type: string, example: "+8801700000000" }
 *               subject: { type: string, example: "License activation question for React UI Kit" }
 *               inquiryType:
 *                 type: string
 *                 enum: [General Question, Order Issue, Payment Issue, Download / License Issue, Account Issue, Technical Problem, Vendor Concern, Complaint / Allegation, Other]
 *                 example: "Download / License Issue"
 *               orderId: { type: string, example: "MKT-20260904-7Q2XKD" }
 *               message: { type: string, example: "Hello, I recently purchased the React UI kit and have a question regarding commercial usage rights." }
 *     responses:
 *       201:
 *         description: Ticket received and confirmation queued.
 *       422:
 *         description: Request body validation failed.
 *       429:
 *         description: Rate limit exceeded.
 */
router.post(
  '/',
  contactLimiter,
  optionalAuthenticate,
  validate(createContactSchema),
  asyncHandler(contactController.create),
);

/**
 * @openapi
 * /contact:
 *   get:
 *     tags: [Support]
 *     summary: List all support tickets (Admin only)
 *     description: Retrieve paginated support tickets with filtering by status and inquiry type.
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [NEW, IN_PROGRESS, RESOLVED, CLOSED] }
 *       - in: query
 *         name: inquiryType
 *         schema: { type: string }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Paginated support tickets list.
 *       401:
 *         description: Unauthorized.
 *       403:
 *         description: Forbidden - Admin role required.
 */
router.get(
  '/',
  authenticate,
  requireAdmin,
  validate(listTicketsSchema),
  asyncHandler(contactController.listAll),
);

/**
 * @openapi
 * /contact/my-tickets:
 *   get:
 *     tags: [Support]
 *     summary: List customer's submitted support tickets
 *     description: Retrieve tickets created by or matching the email of the authenticated user.
 *     responses:
 *       200:
 *         description: List of support tickets for the current user.
 *       401:
 *         description: Unauthorized.
 */
router.get(
  '/my-tickets',
  authenticate,
  asyncHandler(contactController.listMine),
);

/**
 * @openapi
 * /contact/{id}:
 *   get:
 *     tags: [Support]
 *     summary: Get support ticket details
 *     description: Retrieve full ticket details. Accessible to administrators or the ticket owner.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Support ticket details.
 *       401:
 *         description: Unauthorized.
 *       403:
 *         description: Forbidden.
 *       404:
 *         description: Ticket not found.
 */
router.get(
  '/:id',
  authenticate,
  validate(ticketIdParamSchema),
  asyncHandler(contactController.getById),
);

/**
 * @openapi
 * /contact/{id}/status:
 *   patch:
 *     tags: [Support]
 *     summary: Update support ticket status and admin notes (Admin only)
 *     description: Change ticket status and optionally attach internal administrative notes.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [NEW, IN_PROGRESS, RESOLVED, CLOSED]
 *               adminNotes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Ticket status updated.
 *       401:
 *         description: Unauthorized.
 *       403:
 *         description: Forbidden - Admin role required.
 *       404:
 *         description: Ticket not found.
 *       422:
 *         description: Validation failed.
 */
router.patch(
  '/:id/status',
  authenticate,
  requireAdmin,
  validate(updateTicketStatusSchema),
  asyncHandler(contactController.updateStatus),
);

export default router;
