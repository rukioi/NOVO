
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

      // Métricas financeiras apenas para COMPOSTA e GERENCIAL
      if (accountType === 'COMPOSTA' || accountType === 'GERENCIAL') {
        try {
          const [transactionsStats, invoicesStats] = await Promise.all([
            transactionsService.getTransactionsStats(tenantId),
            invoicesService.getInvoicesStats(tenantId)
          ]);

          financialStats = {
            revenue: transactionsStats.totalIncome || 0,
            expenses: transactionsStats.totalExpenses || 0,
            balance: (transactionsStats.totalIncome || 0) - (transactionsStats.totalExpenses || 0),
            thisMonth: {
              revenue: transactionsStats.thisMonthIncome || 0,
              expenses: transactionsStats.thisMonthExpenses || 0
            },
            invoices: {
              total: invoicesStats.total || 0,
              paid: invoicesStats.paid || 0,
              pending: invoicesStats.pending || 0,
              overdue: invoicesStats.overdue || 0
            }
          };
        } catch (financialError) {
          console.warn('Error loading financial stats:', financialError);
          // Keep default zeros for financial stats
        }
      }

      return {
        financial: financialStats,
        clients: {
          total: clientsStats.total || 0,
          active: clientsStats.active || 0,
          inactive: clientsStats.inactive || 0,
          thisMonth: clientsStats.thisMonth || 0
        },
        projects: {
          total: projectsStats.total || 0,
          contacted: projectsStats.contacted || 0,
          proposal: projectsStats.proposal || 0,
          won: projectsStats.won || 0,
          lost: projectsStats.lost || 0,
          thisMonth: projectsStats.thisMonth || 0
        },
        tasks: {
          total: tasksStats.total || 0,
          completed: tasksStats.completed || 0,
          inProgress: tasksStats.inProgress || 0,
          notStarted: tasksStats.notStarted || 0,
          urgent: tasksStats.urgent || 0
        }
      };
    } catch (error) {
      console.error('Error getting dashboard metrics:', error);
      throw error;
    }
  }

  /**
   * Obtém atividades recentes
   */
  async getRecentActivity(tenantId: string, limit: number = 10): Promise<RecentActivity[]> {
    try {
      const activities: RecentActivity[] = [];

      // Get recent clients, projects, tasks, and transactions
      const [clients, projects, tasks, transactions] = await Promise.all([
        clientsService.getClients(tenantId, 1, 5).catch(() => ({ clients: [] })),
        projectsService.getProjects(tenantId, 1, 5).catch(() => ({ projects: [] })),
        tasksService.getTasks(tenantId, 1, 5).catch(() => ({ tasks: [] })),
        transactionsService.getTransactions(tenantId, 1, 5).catch(() => ({ transactions: [] }))
      ]);

      // Convert clients to activities
      if (clients.clients) {
        clients.clients.forEach((client: any) => {
          activities.push({
            id: client.id,
            type: 'client',
            title: `Cliente: ${client.name}`,
            description: client.email || 'Novo cliente adicionado',
            date: client.created_at || client.createdAt || new Date().toISOString(),
            status: client.status || 'active'
          });
        });
      }

      // Convert projects to activities
      if (projects.projects) {
        projects.projects.forEach((project: any) => {
          activities.push({
            id: project.id,
            type: 'project',
            title: `Projeto: ${project.title || project.name}`,
            description: project.description || 'Novo projeto criado',
            date: project.created_at || project.createdAt || new Date().toISOString(),
            status: project.status || 'active'
          });
        });
      }

      // Convert tasks to activities
      if (tasks.tasks) {
        tasks.tasks.forEach((task: any) => {
          activities.push({
            id: task.id,
            type: 'task',
            title: `Tarefa: ${task.title}`,
            description: task.description || 'Nova tarefa criada',
            date: task.created_at || task.createdAt || new Date().toISOString(),
            status: task.status || 'pending'
          });
        });
      }

      // Convert transactions to activities
      if (transactions.transactions) {
        transactions.transactions.forEach((transaction: any) => {
          activities.push({
            id: transaction.id,
            type: 'transaction',
            title: `${transaction.type === 'income' ? 'Receita' : 'Despesa'}: ${transaction.description}`,
            description: `R$ ${transaction.amount.toFixed(2)}`,
            date: transaction.created_at || transaction.createdAt || new Date().toISOString(),
            amount: transaction.amount
          });
        });
      }

      // Ordenar por data e limitar
      return activities
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, limit);
    } catch (error) {
      console.error('Error getting recent activity:', error);
      throw error;
    })
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
    return result.map((row: any) => ({
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
    return result.map((row: any) => ({
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
    return result.map((row: any) => ({
      status: row.status,
      priority: row.priority,
      count: parseInt(row.count || '0'),
      avgProgress: parseFloat(row.avg_progress || '0')
    }));
  }
}

export const dashboardService = new DashboardService();
