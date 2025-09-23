import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { dashboardService } from '../services/dashboardService';

export class DashboardController {
  async getStats(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user || !req.tenantId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const metrics = await dashboardService.getDashboardMetrics(req.tenantId, req.user.id, req.user.accountType);
      res.json(metrics);
    } catch (error) {
      console.error('Dashboard stats error:', error);
      res.status(500).json({
        error: 'Failed to fetch dashboard stats',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getDashboard(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user || !req.tenantId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const [metrics, recentActivity, chartData] = await Promise.all([
        dashboardService.getDashboardMetrics(req.tenantId, req.user.id, req.user.accountType),
        dashboardService.getRecentActivity(req.tenantId, req.user.id, 10),
        dashboardService.getChartData(req.tenantId, req.user.accountType)
      ]);

      const dashboardData = {
        metrics,
        charts: chartData,
        recentActivity,
      };

      res.json(dashboardData);
    } catch (error) {
      console.error('Dashboard error:', error);
      res.status(500).json({
        error: 'Failed to fetch dashboard data',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getMetrics(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user || !req.tenantId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Mock metrics based on account type
      const accountType = req.user.accountType;

      let metrics;
      if (accountType === 'SIMPLES') {
        metrics = {
          revenue: 0,
          expenses: 0,
          balance: 0,
          clients: 127,
          projects: 23,
          tasks: 89,
          revenueGrowth: 0,
          clientGrowth: 12,
        };
      } else {
        metrics = {
          revenue: 45280,
          expenses: 12340,
          balance: 32940,
          clients: 127,
          projects: 23,
          tasks: 89,
          revenueGrowth: 15.2,
          clientGrowth: 12,
        };
      }

      res.json({
        metrics,
        accountType: req.user.accountType,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Dashboard metrics error:', error);
      res.status(500).json({
        error: 'Failed to fetch dashboard metrics',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getFinancialData(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user || !req.tenantId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Only COMPOSTA and GERENCIAL can access financial data
      if (req.user.accountType === 'SIMPLES') {
        return res.json({
          revenue: 0,
          expenses: 0,
          balance: 0,
          transactions: [],
          charts: [],
          message: 'Financial data not available for this account type',
        });
      }

      // Mock financial data
      const mockData = {
        revenue: 45280,
        expenses: 12340,
        balance: 32940,
        transactionCount: 156,
        trends: [
          { month: '2024-01', revenue: 38000, expenses: 11000, balance: 27000 },
          { month: '2024-02', revenue: 42000, expenses: 12500, balance: 29500 },
          { month: '2024-03', revenue: 45280, expenses: 12340, balance: 32940 },
        ],
        categories: [
          { category: 'Honorários', type: 'income', total: 35000, count: 25 },
          { category: 'Consultorias', type: 'income', total: 10280, count: 8 },
          { category: 'Salários', type: 'expense', total: 8000, count: 3 },
          { category: 'Aluguel', type: 'expense', total: 2500, count: 1 },
        ],
      };

      res.json(mockData);
    } catch (error) {
      console.error('Financial data error:', error);
      res.status(500).json({
        error: 'Failed to fetch financial data',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getClientMetrics(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user || !req.tenantId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Mock client metrics
      const mockMetrics = {
        totalClients: 127,
        newThisMonth: 12,
        growthPercentage: 10.4,
        byStatus: [
          { status: 'active', count: 115 },
          { status: 'inactive', count: 8 },
          { status: 'pending', count: 4 },
        ],
      };

      res.json(mockMetrics);
    } catch (error) {
      console.error('Client metrics error:', error);
      res.status(500).json({
        error: 'Failed to fetch client metrics',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getProjectMetrics(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user || !req.tenantId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Mock project metrics
      const mockMetrics = {
        totalProjects: 23,
        activeProjects: 18,
        overdueProjects: 2,
        averageProgress: 67,
        totalRevenue: 125000,
      };

      res.json(mockMetrics);
    } catch (error) {
      console.error('Project metrics error:', error);
      res.status(500).json({
        error: 'Failed to fetch project metrics',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

export const dashboardController = new DashboardController();