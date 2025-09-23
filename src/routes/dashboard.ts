import { Router } from 'express';
import { dashboardController } from '../controllers/dashboardController';
import { authenticateToken, tenantMiddleware } from '../middleware/auth';

const router = Router();

// All dashboard routes require authentication and tenant context
router.use(authenticateToken);
router.use(tenantMiddleware);

router.get('/metrics', dashboardController.getMetrics);
router.get('/financeiro', dashboardController.getFinancialData);
router.get('/clientes', dashboardController.getClientMetrics);
router.get('/projetos', dashboardController.getProjectMetrics);
router.get('/stats', dashboardController.getStats);

export default router;