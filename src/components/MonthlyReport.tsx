import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import {
    getAllGuests,
    getExpensesByDateRange,
    getFoodOrders,
    type ExpenseRecord,
    type FoodOrderSummary,
    type Guest
} from '../api/client';
import logoImage from '../assets/Logo/logo.png';
import { useCurrency } from '../context/CurrencyContext';
import { useNotification } from '../context/NotificationContext';
import { useTheme } from '../context/ThemeContext';

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

interface WeeklyData {
  week: string;
  income: number;
  expenses: number;
  profit: number;
}

const MonthlyReport: React.FC<MonthlyReportProps> = ({ onBack }) => {
  const { colors } = useTheme();
  const { showError, showSuccess, showWarning } = useNotification();
  const { formatMoney } = useCurrency();

  // State management
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [monthlyData, setMonthlyData] = useState<MonthlyData>({
    totalIncome: 0,
    roomIncome: 0,
    foodIncome: 0,
    totalExpenses: 0,
    profitLoss: 0,
    guestCount: 0,
    foodOrderCount: 0
  });
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([]);
  const [loading, setLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Initialize with current month/year
  useEffect(() => {
    const now = new Date();
    setSelectedMonth((now.getMonth() + 1).toString().padStart(2, '0'));
    setSelectedYear(now.getFullYear().toString());
  }, []);

  // Generate month and year options
  const months = [
    { value: '01', label: 'January' },
    { value: '02', label: 'February' },
    { value: '03', label: 'March' },
    { value: '04', label: 'April' },
    { value: '05', label: 'May' },
    { value: '06', label: 'June' },
    { value: '07', label: 'July' },
    { value: '08', label: 'August' },
    { value: '09', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' }
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => (currentYear - 2 + i).toString());

  const generateReport = async () => {
    if (!selectedMonth || !selectedYear) {
      showWarning('Selection Required', 'Please select both month and year');
      return;
    }

    setLoading(true);
    try {
      // Calculate date range for the selected month
      const startDate = `${selectedYear}-${selectedMonth}-01`;
      const lastDay = new Date(parseInt(selectedYear), parseInt(selectedMonth), 0).getDate();
      const endDate = `${selectedYear}-${selectedMonth}-${lastDay.toString().padStart(2, '0')}`;

      console.log('Generating report for:', startDate, 'to', endDate);

      // Fetch data in parallel
      const [guests, foodOrders, expenses] = await Promise.all([
        getAllGuests(),
        getFoodOrders(),
        getExpensesByDateRange(startDate, endDate)
      ]);

      // Filter data for the selected month
      const monthGuests = guests.filter(guest => {
        const guestDate = guest.check_in.substring(0, 7); // YYYY-MM format
        return guestDate === `${selectedYear}-${selectedMonth}`;
      });

      const monthFoodOrders = foodOrders.filter(order => {
        const orderDate = order.created_at.substring(0, 7); // YYYY-MM format
        return orderDate === `${selectedYear}-${selectedMonth}`;
      });

      // Calculate totals
      const roomIncome = monthGuests.reduce((sum, guest) => {
        // Calculate days stayed
        const checkIn = new Date(guest.check_in);
        const checkOut = guest.check_out ? new Date(guest.check_out) : new Date();
        const daysStayed = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
        return sum + (guest.daily_rate * Math.max(1, daysStayed));
      }, 0);

      const foodIncome = monthFoodOrders.reduce((sum, order) => sum + order.total_amount, 0);
      const totalIncome = roomIncome + foodIncome;
      const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
      const profitLoss = totalIncome - totalExpenses;

      setMonthlyData({
        totalIncome,
        roomIncome,
        foodIncome,
        totalExpenses,
        profitLoss,
        guestCount: monthGuests.length,
        foodOrderCount: monthFoodOrders.length
      });

      // Generate weekly breakdown
      generateWeeklyData(selectedYear, selectedMonth, monthGuests, monthFoodOrders, expenses);
      
      setDataLoaded(true);
      showSuccess('Report Generated', 'Monthly report has been generated successfully');
    } catch (error) {
      console.error('Error generating report:', error);
      showError('Report Error', 'Failed to generate monthly report');
    } finally {
      setLoading(false);
    }
  };

  const generateWeeklyData = (year: string, month: string, guests: Guest[], foodOrders: FoodOrderSummary[], expenses: ExpenseRecord[]) => {
    const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
    const weeks: WeeklyData[] = [];

    // Split month into weeks
    for (let week = 1; week <= 5; week++) {
      const startDay = (week - 1) * 7 + 1;
      const endDay = Math.min(week * 7, daysInMonth);
      
      if (startDay > daysInMonth) break;

      const weekStart = `${year}-${month}-${startDay.toString().padStart(2, '0')}`;
      const weekEnd = `${year}-${month}-${endDay.toString().padStart(2, '0')}`;

      // Filter data for this week
      const weekGuests = guests.filter(guest => {
        const guestDate = guest.check_in;
        return guestDate >= weekStart && guestDate <= weekEnd;
      });

      const weekFoodOrders = foodOrders.filter(order => {
        const orderDate = order.created_at.substring(0, 10);
        return orderDate >= weekStart && orderDate <= weekEnd;
      });

      const weekExpenses = expenses.filter(expense => {
        const expenseDate = expense.date;
        return expenseDate >= weekStart && expenseDate <= weekEnd;
      });

      // Calculate week totals
      const weekRoomIncome = weekGuests.reduce((sum, guest) => {
        const checkIn = new Date(guest.check_in);
        const checkOut = guest.check_out ? new Date(guest.check_out) : new Date();
        const daysStayed = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
        return sum + (guest.daily_rate * Math.max(1, daysStayed));
      }, 0);

      const weekFoodIncome = weekFoodOrders.reduce((sum, order) => sum + order.total_amount, 0);
      const weekIncome = weekRoomIncome + weekFoodIncome;
      const weekExpenseTotal = weekExpenses.reduce((sum, expense) => sum + expense.amount, 0);

      weeks.push({
        week: `Week ${week}`,
        income: weekIncome,
        expenses: weekExpenseTotal,
        profit: weekIncome - weekExpenseTotal
      });
    }

    setWeeklyData(weeks);
  };

  const handleExport = async () => {
    try {
      const monthName = new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1).toLocaleString('default', { month: 'long' });
      const fileName = `Monthly_Report_${monthName}_${selectedYear}.xlsx`;

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();

      // Summary data
      const summaryData = [
        ['Monthly Report Summary'],
        ['Month:', `${monthName} ${selectedYear}`],
        ['Generated:', new Date().toLocaleString()],
        [''],
        ['Financial Overview'],
        ['Total Income:', formatMoney(monthlyData.totalIncome)],
        ['Room Income:', formatMoney(monthlyData.roomIncome)],
        ['Food Income:', formatMoney(monthlyData.foodIncome)],
        ['Total Expenses:', formatMoney(monthlyData.totalExpenses)],
        ['Net Profit/Loss:', formatMoney(monthlyData.profitLoss)],
        [''],
        ['Statistics'],
        ['Total Guests:', monthlyData.guestCount.toString()],
        ['Food Orders:', monthlyData.foodOrderCount.toString()],
        ['']
      ];

      // Weekly breakdown
      const weeklyHeader = [['Weekly Breakdown'], ['Week', 'Income', 'Expenses', 'Profit/Loss']];
      const weeklyRows = weeklyData.map(week => [
        week.week,
        formatMoney(week.income),
        formatMoney(week.expenses),
        formatMoney(week.profit)
      ]);

      // Combine all data
      const allData = [...summaryData, ...weeklyHeader, ...weeklyRows];

      // Create worksheet
      const ws = XLSX.utils.aoa_to_sheet(allData);

      // Style the worksheet
      ws['!cols'] = [
        { width: 20 },
        { width: 20 },
        { width: 15 },
        { width: 15 }
      ];

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Monthly Report');

      // Save file
      XLSX.writeFile(wb, fileName);
      showSuccess('Export Successful', `Report exported as ${fileName}`);
    } catch (error) {
      console.error('Export error:', error);
      showError('Export Failed', 'Failed to export report to Excel');
    }
  };

  const handlePrint = () => {
    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showError('Print Failed', 'Unable to open print window');
      return;
    }

    const monthName = new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1).toLocaleString('default', { month: 'long' });

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Monthly Report - ${monthName} ${selectedYear}</title>
          <style>
            @media print {
              body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
              .page-break { page-break-before: always; }
              .no-print { display: none !important; }
            }
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #007bff; padding-bottom: 20px; }
            .logo { max-width: 80px; height: auto; margin: 0 auto 10px; display: block; }
            .header h1 { margin: 0; color: #007bff; font-size: 28px; }
            .header h2 { margin: 5px 0; color: #666; font-size: 18px; }
            .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
            .summary-card { border: 1px solid #ddd; border-radius: 8px; padding: 15px; background: #f8f9fa; }
            .summary-card h3 { margin-top: 0; color: #007bff; font-size: 16px; }
            .summary-item { display: flex; justify-content: space-between; margin: 8px 0; }
            .summary-item strong { color: #333; }
            .amount { font-weight: bold; }
            .positive { color: #28a745; }
            .negative { color: #dc3545; }
            .table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            .table th, .table td { border: 1px solid #ddd; padding: 12px; text-align: left; }
            .table th { background-color: #007bff; color: white; font-weight: bold; }
            .table tr:nth-child(even) { background-color: #f2f2f2; }
            .total-row { background-color: #e3f2fd !important; font-weight: bold; }
            .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="header">
            <img src="${logoImage}" alt="Yasin Heaven Star Hotel" class="logo">
            <h1>Yasin Heaven Star Hotel</h1>
            <h2>Monthly Financial Report</h2>
            <h3>${monthName} ${selectedYear}</h3>
            <p>Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
          </div>

          <div class="summary-grid">
            <div class="summary-card">
              <h3>Income Summary</h3>
              <div class="summary-item">
                <span>Room Income:</span>
                <span class="amount positive">${formatMoney(monthlyData.roomIncome)}</span>
              </div>
              <div class="summary-item">
                <span>Food Income:</span>
                <span class="amount positive">${formatMoney(monthlyData.foodIncome)}</span>
              </div>
              <div class="summary-item">
                <strong>Total Income:</strong>
                <span class="amount positive">${formatMoney(monthlyData.totalIncome)}</span>
              </div>
            </div>

            <div class="summary-card">
              <h3>Expense & Profit Summary</h3>
              <div class="summary-item">
                <span>Total Expenses:</span>
                <span class="amount negative">${formatMoney(monthlyData.totalExpenses)}</span>
              </div>
              <div class="summary-item">
                <strong>Net Profit/Loss:</strong>
                <span class="amount ${monthlyData.profitLoss >= 0 ? 'positive' : 'negative'}">
                  ${formatMoney(monthlyData.profitLoss)}
                </span>
              </div>
              <div class="summary-item">
                <span>Total Guests:</span>
                <span class="amount">${monthlyData.guestCount}</span>
              </div>
              <div class="summary-item">
                <span>Food Orders:</span>
                <span class="amount">${monthlyData.foodOrderCount}</span>
              </div>
            </div>
          </div>

          <h3>Weekly Breakdown</h3>
          <table class="table">
            <thead>
              <tr>
                <th>Period</th>
                <th>Income</th>
                <th>Expenses</th>
                <th>Profit/Loss</th>
              </tr>
            </thead>
            <tbody>
              ${weeklyData.map(week => `
                <tr>
                  <td>${week.week}</td>
                  <td class="positive">${formatMoney(week.income)}</td>
                  <td class="negative">${formatMoney(week.expenses)}</td>
                  <td class="${week.profit >= 0 ? 'positive' : 'negative'}">${formatMoney(week.profit)}</td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td><strong>Total</strong></td>
                <td><strong>${formatMoney(monthlyData.totalIncome)}</strong></td>
                <td><strong>${formatMoney(monthlyData.totalExpenses)}</strong></td>
                <td><strong>${formatMoney(monthlyData.profitLoss)}</strong></td>
              </tr>
            </tbody>
          </table>

          <div class="footer">
            <p>This report was automatically generated by the Hotel Management System</p>
            <p>© ${new Date().getFullYear()} Hotel Management System</p>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    
    // Wait for content to load then print
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    };
  };

  // Styles
  const containerStyle: React.CSSProperties = {
    padding: '2rem',
    color: colors.text,
    minHeight: '100vh',
    backgroundColor: colors.primary
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: colors.surface,
    borderRadius: '12px',
    padding: '1.5rem',
    marginBottom: '1.5rem',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
  };

  const statCardStyle = (bgColor: string): React.CSSProperties => ({
    backgroundColor: bgColor,
    borderRadius: '12px',
    padding: '1.5rem',
    color: 'white',
    textAlign: 'center',
    minHeight: '120px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center'
  });

  const buttonStyle: React.CSSProperties = {
    padding: '0.75rem 1.5rem',
    backgroundColor: colors.accent,
    color: colors.primary,
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '1rem',
    marginRight: '1rem'
  };

  const selectStyle: React.CSSProperties = {
    padding: '0.75rem',
    borderRadius: '8px',
    border: `1px solid ${colors.border}`,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: '1rem',
    marginRight: '1rem',
    minWidth: '150px'
  };

  const chartContainerStyle: React.CSSProperties = {
    height: '300px',
    display: 'flex',
    alignItems: 'end',
    justifyContent: 'space-around',
    padding: '2rem 1rem',
    borderRadius: '8px',
    backgroundColor: colors.surface,
    position: 'relative'
  };

  const maxValue = Math.max(...weeklyData.map(w => Math.max(w.income, w.expenses))) || 1;

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        marginBottom: '2rem',
        borderBottom: `1px solid ${colors.border}`,
        paddingBottom: '1rem'
      }}>
        <button
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            color: colors.text,
            fontSize: '1.5rem',
            cursor: 'pointer',
            marginRight: '1rem'
          }}
        >
          ←
        </button>
        <h1 style={{ margin: 0, fontSize: '1.8rem' }}>Monthly Report</h1>
      </div>

      {/* Controls */}
      <div style={cardStyle}>
        <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Select Period</h3>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Month</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={selectStyle}
            >
              <option value="">Select Month</option>
              {months.map(month => (
                <option key={month.value} value={month.value}>{month.label}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Year</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              style={selectStyle}
            >
              <option value="">Select Year</option>
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          <div style={{ alignSelf: 'end' }}>
            <button
              onClick={generateReport}
              disabled={loading}
              style={{
                ...buttonStyle,
                backgroundColor: loading ? colors.border : colors.accent,
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Generating...' : 'Generate Report'}
            </button>
          </div>
        </div>
      </div>

      {dataLoaded && (
        <>
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
            <div style={statCardStyle('#4A90E2')}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                {formatMoney(monthlyData.totalIncome)}
              </div>
              <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Total Income</div>
              <div style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
                Room: {formatMoney(monthlyData.roomIncome)} | Food: {formatMoney(monthlyData.foodIncome)}
              </div>
            </div>

            <div style={statCardStyle('#E74C3C')}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                {formatMoney(monthlyData.totalExpenses)}
              </div>
              <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Total Expenses</div>
            </div>

            <div style={statCardStyle(monthlyData.profitLoss >= 0 ? '#27AE60' : '#E74C3C')}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                {formatMoney(monthlyData.profitLoss)}
              </div>
              <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>
                {monthlyData.profitLoss >= 0 ? 'Profit' : 'Loss'}
              </div>
            </div>

            <div style={statCardStyle('#F39C12')}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                {monthlyData.guestCount}
              </div>
              <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Total Guests</div>
              <div style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
                Food Orders: {monthlyData.foodOrderCount}
              </div>
            </div>
          </div>

          {/* Chart */}
          <div style={cardStyle}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Weekly Breakdown</h3>
            <div style={chartContainerStyle}>
              {weeklyData.map((week, index) => (
                <div key={index} style={{ textAlign: 'center', minWidth: '80px' }}>
                  <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'center', height: '200px', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'end', gap: '8px' }}>
                      <div
                        style={{
                          width: '20px',
                          height: `${(week.income / maxValue) * 180}px`,
                          backgroundColor: '#4A90E2',
                          borderRadius: '4px 4px 0 0',
                          minHeight: '10px'
                        }}
                        title={`Income: ${formatMoney(week.income)}`}
                      />
                      <div
                        style={{
                          width: '20px',
                          height: `${(week.expenses / maxValue) * 180}px`,
                          backgroundColor: '#E74C3C',
                          borderRadius: '4px 4px 0 0',
                          minHeight: '10px'
                        }}
                        title={`Expenses: ${formatMoney(week.expenses)}`}
                      />
                    </div>
                  </div>
                  <div style={{ fontSize: '0.8rem', fontWeight: '600' }}>{week.week}</div>
                  <div style={{ fontSize: '0.7rem', color: colors.text, opacity: 0.8 }}>
                    P: {formatMoney(week.profit)}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginTop: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '16px', height: '16px', backgroundColor: '#4A90E2', borderRadius: '2px' }} />
                <span style={{ fontSize: '0.9rem' }}>Income</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '16px', height: '16px', backgroundColor: '#E74C3C', borderRadius: '2px' }} />
                <span style={{ fontSize: '0.9rem' }}>Expenses</span>
              </div>
            </div>
          </div>

          {/* Summary Table */}
          <div style={cardStyle}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Weekly Summary</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: colors.accent, color: colors.primary }}>
                    <th style={{ padding: '1rem', textAlign: 'left', borderRadius: '8px 0 0 0' }}>Period</th>
                    <th style={{ padding: '1rem', textAlign: 'right' }}>Income</th>
                    <th style={{ padding: '1rem', textAlign: 'right' }}>Expenses</th>
                    <th style={{ padding: '1rem', textAlign: 'right', borderRadius: '0 8px 0 0' }}>Profit/Loss</th>
                  </tr>
                </thead>
                <tbody>
                  {weeklyData.map((week, index) => (
                    <tr key={index} style={{ borderBottom: `1px solid ${colors.border}` }}>
                      <td style={{ padding: '1rem', fontWeight: '600' }}>{week.week}</td>
                      <td style={{ padding: '1rem', textAlign: 'right', color: '#4A90E2' }}>
                        {formatMoney(week.income)}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right', color: '#E74C3C' }}>
                        {formatMoney(week.expenses)}
                      </td>
                      <td style={{ 
                        padding: '1rem', 
                        textAlign: 'right', 
                        color: week.profit >= 0 ? '#27AE60' : '#E74C3C',
                        fontWeight: '600'
                      }}>
                        {formatMoney(week.profit)}
                      </td>
                    </tr>
                  ))}
                  <tr style={{ backgroundColor: colors.accent, color: colors.primary, fontWeight: 'bold' }}>
                    <td style={{ padding: '1rem' }}>Total</td>
                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                      {formatMoney(monthlyData.totalIncome)}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                      {formatMoney(monthlyData.totalExpenses)}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                      {formatMoney(monthlyData.profitLoss)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={cardStyle}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Actions</h3>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <button onClick={handleExport} style={buttonStyle}>
                📊 Export to Excel
              </button>
              <button onClick={handlePrint} style={buttonStyle}>
                🖨️ Print Report
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default MonthlyReport;
