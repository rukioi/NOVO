
import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { projectsController } from '../controllers/projectsController';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// CRUD routes
router.get('/', projectsController.getProjects);
router.get('/stats', projectsController.getProjectStats);
router.get('/:id', projectsController.getProject);
router.post('/', projectsController.createProject);
router.put('/:id', projectsController.updateProject);
router.delete('/:id', projectsController.deleteProject);

// Special actions
router.patch('/:id/move', projectsController.moveProject);

export default router;
