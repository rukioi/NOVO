
/**
 * DASHBOARD SERVICE - MÉTRICAS E ESTATÍSTICAS
 * ==========================================
 * 
 * Serviço responsável por agregar métricas de todos os módulos para o dashboard.
 * Respeita isolamento por tenant e restrições por tipo de conta.
 */

import { tenantDB } from './tenantDatabase';
import { clientsService } from './clientsService';
import { projectsService } from './projectsService';
import { tasksService } from './tasksService';
import { transactionsService } from './transactionsService';
import { invoicesService } from './invoicesService';
import { publicationsService } from './publicationsService';

export interface DashboardMetrics {
  financial: {
    revenue: number;
    expenses: number;
    balance: number;
    thisMonth: {
      revenue: number;
      expenses: number;
    };
    invoices: {
      total: number;
      paid: number;
      pending: number;
      overdue: number;
    };
  };
  clients: {
    total: number;
    active: number;
    inactive: number;
    thisMonth: number;
  };
  projects: {
    total: number;
    contacted: number;
    proposal: number;
    won: number;
    lost: number;
    thisMonth: number;
  };
  tasks: {
    total: number;
    completed: number;
    inProgress: number;
    notStarted: number;
    urgent: number;
  };
  publications?: {
    total: number;
    novo: number;
    lido: number;
    arquivado: number;
    thisMonth: number;
  };
}

export interface RecentActivity {
  id: string;
  type: 'client' | 'project' | 'task' | 'transaction' | 'invoice' | 'publication';
  title: string;
  description: string;
  date: string;
  status?: string;
  amount?: number;
}

export class DashboardService {
  /**
   * Obtém métricas agregadas do dashboard
   */
  async getDashboardMetrics(tenantId: string, userId: string, accountType: 'SIMPLES' | 'COMPOSTA' | 'GERENCIAL'): Promise<DashboardMetrics> {
    try {
      // Métricas básicas (todos os tipos de conta)
      const [clientsStats, projectsStats, tasksStats] = await Promise.all([
        clientsService.getClientsStats(tenantId),
        projectsService.getProjectsStats(tenantId),
        tasksService.getTaskStats(tenantId)
      ]);

      let financialStats = {
        revenue: 0,
        expenses: 0,
        balance: 0,
        thisMonth: { revenue: 0, expenses: 0 },
        invoices: { total: 0, paid: 0, pending: 0, overdue: 0 }
      };

      let publicationsStats;

      // Métricas financeiras apenas para COMPOSTA e GERENCIAL
      if (accountType === 'COMPOSTA' || accountType === 'GERENCIAL') {
        const [transactionsStats, invoicesStats] = await Promise.all([
          transactionsService.getTransactionsStats(tenantId),
          invoicesService.getInvoicesStats(tenantId)
        ]);

        financialStats = {
          revenue: transactionsStats.totalIncome,
          expenses: transactionsStats.totalExpense,
          balance: transactionsStats.netAmount,
          thisMonth: {
            revenue: transactionsStats.thisMonthIncome,
            expenses: transactionsStats.thisMonthExpense
          },
          invoices: {
            total: invoicesStats.total,
            paid: invoicesStats.paid,
            pending: invoicesStats.pending,
            overdue: invoicesStats.overdue
          }
        };
      }

      // Publications stats (isolado por usuário)
      publicationsStats = await publicationsService.getPublicationsStats(tenantId, userId);

      return {
        financial: financialStats,
        clients: clientsStats,
        projects: projectsStats,
        tasks: {
          total: parseInt(tasksStats.total) || 0,
          completed: parseInt(tasksStats.completed) || 0,
          inProgress: parseInt(tasksStats.in_progress) || 0,
          notStarted: parseInt(tasksStats.not_started) || 0,
          urgent: parseInt(tasksStats.urgent) || 0
        },
        publications: publicationsStats
      };
    } catch (error) {
      console.error('Error getting dashboard metrics:', error);
      throw error;
    }
  }

  /**
   * Obtém atividades recentes do usuário
   */
  async getRecentActivity(tenantId: string, userId: string, limit: number = 10): Promise<RecentActivity[]> {
    try {
      const activities: RecentActivity[] = [];

      // Buscar atividades de cada módulo
      const [recentClients, recentProjects, recentTasks] = await Promise.all([
        clientsService.getClients(tenantId, { limit: 5, page: 1 }),
        projectsService.getProjects(tenantId, { limit: 5, page: 1 }),
        tasksService.getTasks(tenantId, 5, 0)
      ]);

      // Adicionar clientes recentes
      recentClients.clients.forEach(client => {
        activities.push({
          id: client.id,
          type: 'client',
          title: `Cliente: ${client.name}`,
          description: `Novo cliente adicionado`,
          date: client.created_at,
          status: client.status
        });
      });

      // Adicionar projetos recentes
      recentProjects.projects.forEach(project => {
        activities.push({
          id: project.id,
          type: 'project',
          title: `Projeto: ${project.title}`,
          description: `Cliente: ${project.client_name}`,
          date: project.created_at,
          status: project.status,
          amount: project.budget
        });
      });

      // Adicionar tarefas recentes
      recentTasks.tasks.forEach(task => {
        activities.push({
          id: task.id,
          type: 'task',
          title: `Tarefa: ${task.title}`,
          description: `Progresso: ${task.progress}%`,
          date: task.created_at,
          status: task.status
        });
      });

      // Ordenar por data e limitar
      return activities
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, limit);
    } catch (error) {
      console.error('Error getting recent activity:', error);
      throw error;
    }
  }

  /**
   * Obtém dados para gráficos do dashboard
   */
  async getChartData(tenantId: string, accountType: 'SIMPLES' | 'COMPOSTA' | 'GERENCIAL', period: string = '30d') {
    try {
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - 30);
      const dateFromStr = dateFrom.toISOString().split('T')[0];

      let financialData = null;

      // Dados financeiros apenas para COMPOSTA e GERENCIAL
      if (accountType === 'COMPOSTA' || accountType === 'GERENCIAL') {
        const transactionsByCategory = await transactionsService.getTransactionsByCategory(
          tenantId, 
          undefined, 
          dateFromStr
        );

        financialData = {
          categories: transactionsByCategory,
          cashFlow: await this.getCashFlowData(tenantId, dateFromStr)
        };
      }

      return {
        financial: financialData,
        projects: await this.getProjectsChartData(tenantId, dateFromStr),
        tasks: await this.getTasksChartData(tenantId, dateFromStr)
      };
    } catch (error) {
      console.error('Error getting chart data:', error);
      throw error;
    }
  }

  /**
   * Dados do fluxo de caixa para gráficos
   */
  private async getCashFlowData(tenantId: string, dateFrom: string) {
    const query = `
      SELECT 
        DATE(date) as day,
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense
      FROM \${schema}.transactions
      WHERE is_active = TRUE AND date >= $1
      GROUP BY DATE(date)
      ORDER BY day ASC
    `;

    const result = await tenantDB.executeInTenantSchema(tenantId, query, [dateFrom]);
    return result.map(row => ({
      day: row.day,
      income: parseFloat(row.income || '0'),
      expense: parseFloat(row.expense || '0'),
      net: parseFloat(row.income || '0') - parseFloat(row.expense || '0')
    }));
  }

  /**
   * Dados de projetos para gráficos
   */
  private async getProjectsChartData(tenantId: string, dateFrom: string) {
    const query = `
      SELECT 
        status,
        COUNT(*) as count,
        COALESCE(SUM(budget), 0) as total_budget
      FROM \${schema}.projects
      WHERE is_active = TRUE AND created_at >= $1
      GROUP BY status
    `;

    const result = await tenantDB.executeInTenantSchema(tenantId, query, [dateFrom]);
    return result.map(row => ({
      status: row.status,
      count: parseInt(row.count || '0'),
      totalBudget: parseFloat(row.total_budget || '0')
    }));
  }

  /**
   * Dados de tarefas para gráficos
   */
  private async getTasksChartData(tenantId: string, dateFrom: string) {
    const query = `
      SELECT 
        status,
        priority,
        COUNT(*) as count,
        AVG(progress) as avg_progress
      FROM \${schema}.tasks
      WHERE is_active = TRUE AND created_at >= $1
      GROUP BY status, priority
    `;

    const result = await tenantDB.executeInTenantSchema(tenantId, query, [dateFrom]);
    return result.map(row => ({
      status: row.status,
      priority: row.priority,
      count: parseInt(row.count || '0'),
      avgProgress: parseFloat(row.avg_progress || '0')
    }));
  }
}

export const dashboardService = new DashboardService();
import { database } from '../config/database';
import { clientsService } from './clientsService';
import { projectsService } from './projectsService';
import { transactionsService } from './transactionsService';
import { invoicesService } from './invoicesService';
import { tasksService } from './tasksService';

interface DashboardMetrics {
  financial: {
    revenue: number;
    expenses: number;
    balance: number;
    thisMonth: {
      revenue: number;
      expenses: number;
    };
    invoices: {
      total: number;
      paid: number;
      pending: number;
      overdue: number;
    };
  };
  clients: {
    total: number;
    active: number;
    inactive: number;
    thisMonth: number;
  };
  projects: {
    total: number;
    contacted: number;
    proposal: number;
    won: number;
    lost: number;
    thisMonth: number;
  };
  tasks: {
    total: number;
    completed: number;
    inProgress: number;
    notStarted: number;
    urgent: number;
  };
}

interface RecentActivity {
  id: string;
  type: 'client' | 'project' | 'task' | 'transaction' | 'invoice' | 'publication';
  title: string;
  description: string;
  date: string;
  status?: string;
  amount?: number;
}

class DashboardService {
  async getDashboardMetrics(tenantId: string, userId: string, accountType: string): Promise<DashboardMetrics> {
    try {
      // Get financial metrics
      const currentMonth = new Date();
      currentMonth.setDate(1);
      currentMonth.setHours(0, 0, 0, 0);
      
      const financialQuery = `
        SELECT 
          SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as total_revenue,
          SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as total_expenses,
          SUM(CASE WHEN type = 'income' AND created_at >= $1 THEN amount ELSE 0 END) as monthly_revenue,
          SUM(CASE WHEN type = 'expense' AND created_at >= $1 THEN amount ELSE 0 END) as monthly_expenses
        FROM ${tenantId}.transactions
        WHERE status = 'completed'
      `;
      
      const financialResult = await database.query(financialQuery, [currentMonth.toISOString()]);
      const financial = financialResult.rows[0] || {};

      // Get invoice metrics
      const invoiceQuery = `
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdue
        FROM ${tenantId}.invoices
      `;
      
      const invoiceResult = await database.query(invoiceQuery);
      const invoices = invoiceResult.rows[0] || {};

      // Get client metrics
      const clientQuery = `
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive,
          SUM(CASE WHEN created_at >= $1 THEN 1 ELSE 0 END) as this_month
        FROM ${tenantId}.clients
      `;
      
      const clientResult = await database.query(clientQuery, [currentMonth.toISOString()]);
      const clients = clientResult.rows[0] || {};

      // Get project metrics
      const projectQuery = `
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN stage = 'contacted' THEN 1 ELSE 0 END) as contacted,
          SUM(CASE WHEN stage = 'proposal' THEN 1 ELSE 0 END) as proposal,
          SUM(CASE WHEN stage = 'won' THEN 1 ELSE 0 END) as won,
          SUM(CASE WHEN stage = 'lost' THEN 1 ELSE 0 END) as lost,
          SUM(CASE WHEN created_at >= $1 THEN 1 ELSE 0 END) as this_month
        FROM ${tenantId}.projects
      `;
      
      const projectResult = await database.query(projectQuery, [currentMonth.toISOString()]);
      const projects = projectResult.rows[0] || {};

      // Get task metrics
      const taskQuery = `
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
          SUM(CASE WHEN status = 'not_started' THEN 1 ELSE 0 END) as not_started,
          SUM(CASE WHEN priority = 'high' THEN 1 ELSE 0 END) as urgent
        FROM ${tenantId}.tasks
      `;
      
      const taskResult = await database.query(taskQuery);
      const tasks = taskResult.rows[0] || {};

      return {
        financial: {
          revenue: parseFloat(financial.total_revenue || '0'),
          expenses: parseFloat(financial.total_expenses || '0'),
          balance: parseFloat(financial.total_revenue || '0') - parseFloat(financial.total_expenses || '0'),
          thisMonth: {
            revenue: parseFloat(financial.monthly_revenue || '0'),
            expenses: parseFloat(financial.monthly_expenses || '0'),
          },
          invoices: {
            total: parseInt(invoices.total || '0'),
            paid: parseInt(invoices.paid || '0'),
            pending: parseInt(invoices.pending || '0'),
            overdue: parseInt(invoices.overdue || '0'),
          },
        },
        clients: {
          total: parseInt(clients.total || '0'),
          active: parseInt(clients.active || '0'),
          inactive: parseInt(clients.inactive || '0'),
          thisMonth: parseInt(clients.this_month || '0'),
        },
        projects: {
          total: parseInt(projects.total || '0'),
          contacted: parseInt(projects.contacted || '0'),
          proposal: parseInt(projects.proposal || '0'),
          won: parseInt(projects.won || '0'),
          lost: parseInt(projects.lost || '0'),
          thisMonth: parseInt(projects.this_month || '0'),
        },
        tasks: {
          total: parseInt(tasks.total || '0'),
          completed: parseInt(tasks.completed || '0'),
          inProgress: parseInt(tasks.in_progress || '0'),
          notStarted: parseInt(tasks.not_started || '0'),
          urgent: parseInt(tasks.urgent || '0'),
        },
      };
    } catch (error) {
      console.error('Error getting dashboard metrics:', error);
      throw new Error('Failed to get dashboard metrics');
    }
  }

  async getRecentActivity(tenantId: string, userId: string, limit: number = 10): Promise<RecentActivity[]> {
    try {
      const query = `
        (
          SELECT 'client' as type, name as title, 
                 'Cliente adicionado' as description, 
                 created_at as date, status, null as amount, id
          FROM ${tenantId}.clients 
          ORDER BY created_at DESC LIMIT 5
        )
        UNION ALL
        (
          SELECT 'project' as type, name as title, 
                 'Projeto atualizado' as description, 
                 updated_at as date, stage as status, value as amount, id
          FROM ${tenantId}.projects 
          ORDER BY updated_at DESC LIMIT 5
        )
        UNION ALL
        (
          SELECT 'task' as type, title, 
                 'Tarefa modificada' as description, 
                 updated_at as date, status, null as amount, id
          FROM ${tenantId}.tasks 
          ORDER BY updated_at DESC LIMIT 5
        )
        UNION ALL
        (
          SELECT 'transaction' as type, description as title, 
                 'Transação registrada' as description, 
                 created_at as date, status, amount, id
          FROM ${tenantId}.transactions 
          ORDER BY created_at DESC LIMIT 5
        )
        ORDER BY date DESC LIMIT $1
      `;

      const result = await database.query(query, [limit]);
      
      return result.rows.map(row => ({
        id: row.id,
        type: row.type,
        title: row.title,
        description: row.description,
        date: row.date,
        status: row.status,
        amount: row.amount ? parseFloat(row.amount) : undefined,
      }));
    } catch (error) {
      console.error('Error getting recent activity:', error);
      return [];
    }
  }

  async getChartData(tenantId: string, accountType: string, period: string = '30d') {
    try {
      const days = parseInt(period.replace('d', ''));
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const query = `
        SELECT 
          DATE(created_at) as date,
          SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as revenue,
          SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expenses
        FROM ${tenantId}.transactions
        WHERE created_at >= $1 AND status = 'completed'
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `;

      const result = await database.query(query, [startDate.toISOString()]);
      
      return {
        revenue: result.rows.map(row => ({
          date: row.date,
          value: parseFloat(row.revenue || '0'),
        })),
        expenses: result.rows.map(row => ({
          date: row.date,
          value: parseFloat(row.expenses || '0'),
        })),
      };
    } catch (error) {
      console.error('Error getting chart data:', error);
      return { revenue: [], expenses: [] };
    }
  }
}

export const dashboardService = new DashboardService();
