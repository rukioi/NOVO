import { Router } from 'express';
import { adminController } from '../controllers/adminController';
import { authenticateAdminToken } from '../middleware/auth';

const router = Router();

// All admin routes require admin authentication
router.use(authenticateAdminToken);

// Registration Keys
router.post('/keys', authenticateAdminToken, adminController.createRegistrationKey);
router.get('/keys', authenticateAdminToken, adminController.getRegistrationKeys);
router.patch('/keys/:keyId/revoke', authenticateAdminToken, adminController.revokeRegistrationKey);

// Tenant Management
router.get('/tenants', adminController.getTenants);
router.post('/tenants', adminController.createTenant);
router.put('/tenants/:id', adminController.updateTenant);
router.delete('/tenants/:id', adminController.deleteTenant);
router.patch('/tenants/:id/status', adminController.toggleTenantStatus);

// Global Metrics
router.get('/metrics', adminController.getGlobalMetrics);

export default router;