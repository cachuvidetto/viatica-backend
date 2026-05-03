import { Router } from 'express';
import { requireAuth } from '../middlewares/auth';
import { inviteUser, getPendingInvitations, acceptInvite } from '../controllers/invitationController';

const invitationRouter = Router();

// Public route to accept invite
invitationRouter.post('/accept', acceptInvite);

// Only Admin and Owner can invite users
invitationRouter.post('/', requireAuth(['admin', 'owner']), inviteUser);
invitationRouter.get('/', requireAuth(['admin', 'owner']), getPendingInvitations);

export default invitationRouter;
