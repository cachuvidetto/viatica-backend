// backend/src/routes/license.ts
import { Router } from 'express';
import { validateLicense } from '../controllers/licenseController';

const licenseRouter = Router();

// Public endpoint for Desktop App to validate license
// POST /api/v1/license/validate
licenseRouter.post('/validate', validateLicense);

// Protected endpoint for Dashboard to list licenses
import { getAllLicenses } from '../controllers/licenseController';
import { requireAuth } from '../middlewares/auth';

licenseRouter.get('/', requireAuth(), getAllLicenses);

export default licenseRouter;
