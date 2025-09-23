
import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../middleware/auth';
import { projectsService } from '../services/projectsService';

// Validation schemas
const createProjectSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  clientName: z.string().min(1, 'Client name is required'),
  clientId: z.string().optional(),
  organization: z.string().optional(),
  address: z.string().optional(),
  budget: z.number().min(0).optional(),
  currency: z.enum(['BRL', 'USD', 'EUR']).default('BRL'),
  status: z.enum(['contacted', 'proposal', 'won', 'lost']).default('contacted'),
  startDate: z.string().min(1, 'Start date is required'),
  dueDate: z.string().min(1, 'Due date is required'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  progress: z.number().min(0).max(100).default(0),
  tags: z.array(z.string()).default([]),
  assignedTo: z.array(z.string()).default([]),
  contacts: z.array(z.object({
    name: z.string(),
    email: z.string().email(),
    phone: z.string(),
    role: z.string()
  })).default([]),
  notes: z.string().optional(),
});

const updateProjectSchema = createProjectSchema.partial();

export class ProjectsController {
  async getProjects(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user || !req.tenantId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { page = '1', limit = '50', search, status, priority } = req.query;
      
      const filters = {
        search: search as string,
        status: status as string,
        priority: priority as string,
      };

      const projects = await projectsService.getProjectsByTenant(
        req.tenantId,
        parseInt(page as string),
        parseInt(limit as string),
        filters
      );

      res.json(projects);
    } catch (error) {
      console.error('Error fetching projects:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getProject(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user || !req.tenantId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      const project = await projectsService.getProjectById(req.tenantId, id);

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      res.json(project);
    } catch (error) {
      console.error('Error fetching project:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async createProject(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user || !req.tenantId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const validatedData = createProjectSchema.parse(req.body);
      
      const projectData = {
        ...validatedData,
        createdBy: req.user.name || req.user.email,
        tenantId: req.tenantId,
      };

      const project = await projectsService.createProject(req.tenantId, projectData);
      res.status(201).json(project);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Validation error', 
          details: error.errors 
        });
      }
      console.error('Error creating project:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async updateProject(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user || !req.tenantId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      const validatedData = updateProjectSchema.parse(req.body);

      const updateData = {
        ...validatedData,
        lastModifiedBy: req.user.name || req.user.email,
      };

      const project = await projectsService.updateProject(req.tenantId, id, updateData);
      
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      res.json(project);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Validation error', 
          details: error.errors 
        });
      }
      console.error('Error updating project:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async deleteProject(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user || !req.tenantId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      const deleted = await projectsService.deleteProject(req.tenantId, id);

      if (!deleted) {
        return res.status(404).json({ error: 'Project not found' });
      }

      res.json({ message: 'Project deleted successfully' });
    } catch (error) {
      console.error('Error deleting project:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getProjectStats(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user || !req.tenantId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const stats = await projectsService.getProjectStats(req.tenantId);
      res.json(stats);
    } catch (error) {
      console.error('Error fetching project stats:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async moveProject(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user || !req.tenantId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      const { status } = req.body;

      if (!['contacted', 'proposal', 'won', 'lost'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      const project = await projectsService.updateProject(req.tenantId, id, { 
        status,
        lastModifiedBy: req.user.name || req.user.email 
      });

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      res.json(project);
    } catch (error) {
      console.error('Error moving project:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

export const projectsController = new ProjectsController();
