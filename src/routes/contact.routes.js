import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { pool, withTransaction } from '../db/pool.js';
import { requireAuth, requireAdmin } from './middleware/auth.js';
import { asyncHandler } from '../utils/async-handler.js';
import { assert } from '../utils/http-error.js';
import { isAdminUser } from '../utils/admin-access.js';
import { contactFilters, getContactConversation, listContacts, listOwnContacts, replyToContact, saveContact, updateContact, validateContact, validateContactReply } from '../services/contact-messages.js';
import { id } from '../services/admin-validation.js';

const privateResponse = (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); };
export const contactRouter = Router();
contactRouter.use(requireAuth, privateResponse, (req, _res, next) => {
  try {
    assert(req.user.email_verified_at && !isAdminUser(req.user), 403, 'A verified student or institution account is required.');
    next();
  } catch (error) { next(error); }
});
contactRouter.post('/', rateLimit({
  windowMs: 15 * 60_000, limit: 5, keyGenerator: req => req.user.user_id,
  standardHeaders: 'draft-8', legacyHeaders: false,
  message: { error: { message: 'Please wait before sending another message. Limit: 5 messages per 15 minutes.' } }
}), asyncHandler(async (req, res) => {
  const result = await saveContact(pool, req.user, validateContact(req.body));
  res.status(result.alreadySubmitted ? 200 : 201).json(result);
}));
const replyLimit = () => rateLimit({
  windowMs: 15 * 60_000, limit: 30, keyGenerator: req => req.user.user_id,
  standardHeaders: 'draft-8', legacyHeaders: false,
  message: { error: { message: 'Please wait before sending another reply. Limit: 30 replies per 15 minutes.' } }
});
contactRouter.get('/', asyncHandler(async (req, res) => {
  res.json(await listOwnContacts(pool, req.user.user_id, req.query.page));
}));
contactRouter.get('/:id', asyncHandler(async (req, res) => {
  res.json(await getContactConversation(pool, req.user, req.params.id, req.query.before));
}));
contactRouter.post('/:id/replies', replyLimit(), asyncHandler(async (req, res) => {
  const messageId = id(req.params.id), item = validateContactReply(req.body);
  const result = await withTransaction(connection => replyToContact(connection, req.user, messageId, item));
  res.status(result.alreadySubmitted ? 200 : 201).json(result);
}));

export const contactAdminRouter = Router();
contactAdminRouter.use(requireAuth, requireAdmin, privateResponse);
contactAdminRouter.get('/', asyncHandler(async (req, res) => {
  res.json(await listContacts(pool, contactFilters(req.query)));
}));
contactAdminRouter.get('/:id', asyncHandler(async (req, res) => {
  res.json(await getContactConversation(pool, req.user, req.params.id, req.query.before));
}));
contactAdminRouter.post('/:id/replies', replyLimit(), asyncHandler(async (req, res) => {
  const messageId = id(req.params.id), item = validateContactReply(req.body);
  const result = await withTransaction(connection => replyToContact(connection, req.user, messageId, item));
  res.status(result.alreadySubmitted ? 200 : 201).json(result);
}));
contactAdminRouter.patch('/:id', asyncHandler(async (req, res) => {
  res.json(await withTransaction(connection => updateContact(connection, req.params.id, req.body?.status, req.user.user_id)));
}));
