import React, { useEffect, useMemo, useState } from 'react';
import {
    hotelRestaurantService,
    type ExpenseRecord,
    type FoodOrderSummary,
    type Guest,
} from '../../../api/modules/hotelRestaurantService';
import { useNotification } from '../../../context/NotificationContext';

interface MonthlyReportProps {
  onBack: () => void;
}

interface MonthlyData {
  totalIncome: number;
  roomIncome: number;
  foodIncome: number;
  totalExpenses: number;
  profitLoss: number;
  guestCount: number;
  foodOrderCount: number;
}

const MonthlyReport: React.FC<MonthlyReportProps> = ({ onBack }) => {
  const { showError, showSuccess, showWarning } = useNotification();
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1).padStart(2, '0'));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<MonthlyData>({
    totalIncome: 0,
    roomIncome: 0,
    foodIncome: 0,
    totalExpenses: 0,
    profitLoss: 0,
    guestCount: 0,
    foodOrderCount: 0,
  });

  const monthName = useMemo(() => {
    return new Date(Number(year), Number(month) - 1, 1).toLocaleString('default', { month: 'long' });
  }, [year, month]);

  const generate = async () => {
    if (!month || !year) {
      showWarning('Select month and year first');
      return;
    }

    setLoading(true);
    try {
      const startDate = `${year}-${month}-01`;
      const lastDay = new Date(Number(year), Number(month), 0).getDate();
      const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

      const [guests, foodOrders, expenses] = await Promise.all([
        hotelRestaurantService.getAllGuests() as Promise<Guest[]>,
        hotelRestaurantService.getFoodOrders() as Promise<FoodOrderSummary[]>,
        hotelRestaurantService.getExpensesByDateRange(startDate, endDate) as Promise<ExpenseRecord[]>,
      ]);

      const monthGuests = guests.filter((guest) => guest.check_in.slice(0, 7) === `${year}-${month}`);
      const monthOrders = foodOrders.filter((order) => order.created_at.slice(0, 7) === `${year}-${month}`);

      const roomIncome = monthGuests.reduce((sum, guest) => {
        const start = new Date(guest.check_in);
        const end = guest.check_out ? new Date(guest.check_out) : new Date();
        const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
        return sum + guest.daily_rate * days;
      }, 0);

      const foodIncome = monthOrders.reduce((sum, order) => sum + order.total_amount, 0);
      const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
      const totalIncome = roomIncome + foodIncome;

      setData({
        totalIncome,
        roomIncome,
        foodIncome,
        totalExpenses,
        profitLoss: totalIncome - totalExpenses,
        guestCount: monthGuests.length,
        foodOrderCount: monthOrders.length,
      });

      setReady(true);
      showSuccess('Monthly report generated');
    } catch (error) {
      showError('Failed to generate report', String(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setReady(false);
  }, [month, year]);

  const exportCsv = () => {
    if (!ready) return;
    const lines = [
      'Metric,Value',
      `Month,${monthName} ${year}`,
      `Total Income,${data.totalIncome}`,
      `Room Income,${data.roomIncome}`,
      `Food Income,${data.foodIncome}`,
      `Total Expenses,${data.totalExpenses}`,
      `Profit/Loss,${data.profitLoss}`,
      `Guest Count,${data.guestCount}`,
      `Food Order Count,${data.foodOrderCount}`,
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `monthly_report_${year}_${month}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding: 20 }}>
      <button className="bc-btn bc-btn-outline" onClick={onBack}>← Back</button>
      <h2 style={{ marginTop: 12 }}>Monthly Report</h2>

      <div className="bc-card" style={{ padding: 12, maxWidth: 720 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8 }}>
          <select className="bc-input" value={month} onChange={(e) => setMonth(e.target.value)}>
            {Array.from({ length: 12 }, (_, index) => {
              const value = String(index + 1).padStart(2, '0');
              const label = new Date(2000, index, 1).toLocaleString('default', { month: 'long' });
              return <option key={value} value={value}>{label}</option>;
            })}
          </select>
          <select className="bc-input" value={year} onChange={(e) => setYear(e.target.value)}>
            {Array.from({ length: 7 }, (_, index) => String(new Date().getFullYear() - 3 + index)).map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
          <button className="bc-btn bc-btn-primary" onClick={generate} disabled={loading}>
            {loading ? 'Generating...' : 'Generate'}
          </button>
        </div>

        {ready && (
          <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
            <div>Total Income: {data.totalIncome.toFixed(2)}</div>
            <div>Room Income: {data.roomIncome.toFixed(2)}</div>
            <div>Food Income: {data.foodIncome.toFixed(2)}</div>
            <div>Total Expenses: {data.totalExpenses.toFixed(2)}</div>
            <div>Profit/Loss: {data.profitLoss.toFixed(2)}</div>
            <div>Guests: {data.guestCount}</div>
            <div>Food Orders: {data.foodOrderCount}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button className="bc-btn bc-btn-outline" onClick={exportCsv}>Export CSV</button>
              <button className="bc-btn bc-btn-outline" onClick={() => window.print()}>Print</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MonthlyReport;
