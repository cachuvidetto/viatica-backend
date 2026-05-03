// backend/src/routes/admin.ts
import { Router } from 'express';
import { requireAuth } from '../middlewares/auth';
import {
  purchaseLicense,
  getAllLicenses
} from '../controllers/licenseController';

const adminRouter = Router();

// 🔹 License Management (Purchase & View)
adminRouter.post('/licenses/purchase', requireAuth(['admin', 'user']), purchaseLicense); // Allow users to purchase too
adminRouter.get('/licenses', requireAuth(['admin', 'user']), getAllLicenses);

// 🔹 Admin Check
adminRouter.get('/ping', requireAuth(['admin']), (req, res) => {
  res.json({ ok: true, scope: 'admin' });
});

export default adminRouter;