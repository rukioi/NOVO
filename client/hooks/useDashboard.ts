import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';

// Helper functions to transform backend data to frontend format
function transformCashFlowToMonthly(cashFlowData: any[]) {
  // Group daily data by month and sum values
  const monthlyData = new Map();

  cashFlowData.forEach(item => {
    const month = new Date(item.day).toLocaleDateString('pt-BR', { month: 'short' });
    const monthKey = month.charAt(0).toUpperCase() + month.slice(1).slice(0, 3);

    if (!monthlyData.has(monthKey)) {
      monthlyData.set(monthKey, { 
        month: monthKey, 
        receitas: 0, 
        despesas: 0, 
        saldo: 0 
      });
    }

    const existing = monthlyData.get(monthKey);
    existing.receitas += item.income;
    existing.despesas += item.expense;
    existing.saldo += item.net;
  });

  return Array.from(monthlyData.values());
}

function transformCategoriesToRevenue(categories: any[]) {
  const revenueCategories = categories
    .filter(cat => cat.type === 'income')
    .map((cat, index) => ({
      name: cat.category || 'Outros',
      value: Math.round((cat.total / categories.reduce((sum, c) => sum + (c.type === 'income' ? c.total : 0), 0)) * 100),
      amount: cat.total,
      color: getColorForIndex(index)
    }));

  return revenueCategories;
}

function transformCategoriesToExpenses(categories: any[]) {
  const expenseCategories = categories
    .filter(cat => cat.type === 'expense')
    .map((cat, index) => ({
      name: cat.category || 'Outros',
      value: Math.round((cat.total / categories.reduce((sum, c) => sum + (c.type === 'expense' ? c.total : 0), 0)) * 100),
      amount: cat.total,
      color: getColorForIndex(index)
    }));

  return expenseCategories;
}

function getColorForIndex(index: number) {
  const colors = [
    "#10B981", "#3B82F6", "#8B5CF6", "#F59E0B", "#EF4444", 
    "#06B6D4", "#EC4899", "#84CC16", "#F97316", "#6B7280"
  ];
  return colors[index % colors.length];
}

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
  publications?: {
    total: number;
    novo: number;
    lido: number;
    arquivado: number;
    thisMonth: number;
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

export function useDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [chartData, setChartData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboardMetrics = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await apiService.getDashboardMetrics();
      setMetrics(response);
      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load dashboard metrics';
      setError(errorMessage);
      console.error('Dashboard metrics error:', err);

      // Set empty metrics instead of throwing
      setMetrics({
        financial: {
          revenue: 0,
          expenses: 0,
          balance: 0,
          thisMonth: { revenue: 0, expenses: 0 },
          invoices: { total: 0, paid: 0, pending: 0, overdue: 0 }
        },
        clients: { total: 0, active: 0, inactive: 0, thisMonth: 0 },
        projects: { total: 0, contacted: 0, proposal: 0, won: 0, lost: 0, thisMonth: 0 },
        tasks: { total: 0, completed: 0, inProgress: 0, notStarted: 0, urgent: 0 }
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadRecentActivity = async (limit: number = 10) => {
    try {
      const response = await apiService.getRecentActivity(limit);
      setRecentActivity(response);
      return response;
    } catch (err) {
      console.error('Recent activity error:', err);
      setRecentActivity([]);
    }
  };

  const loadChartData = async (period: string = '30d') => {
    try {
      const response = await apiService.getChartData(period);

      // Transform backend data to frontend format
      const transformedData = {
        monthlyFinancialData: response.financial?.cashFlow ? 
          transformCashFlowToMonthly(response.financial.cashFlow) : [],
        revenueByCategory: response.financial?.categories ? 
          transformCategoriesToRevenue(response.financial.categories) : [],
        expensesByCategory: response.financial?.categories ? 
          transformCategoriesToExpenses(response.financial.categories) : []
      };

      setChartData(transformedData);
      return transformedData;
    } catch (err) {
      console.error('Chart data error:', err);
      setChartData({ 
        monthlyFinancialData: [], 
        revenueByCategory: [], 
        expensesByCategory: [] 
      });
    }
  };

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        await Promise.allSettled([
          loadDashboardMetrics(),
          loadRecentActivity(),
          loadChartData()
        ]);
      } catch (error) {
        console.error('Error loading initial dashboard data:', error);
      }
    };

    loadInitialData();
  }, []);

  return {
    metrics,
    recentActivity,
    chartData,
    isLoading,
    error,
    loadDashboardMetrics,
    loadRecentActivity,
    loadChartData,
  };
}