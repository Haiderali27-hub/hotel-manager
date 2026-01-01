import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import {
    getCustomers,
    getExpensesByDateRange,
    getSales,
    type Customer,
    type ExpenseRecord,
    type SaleSummary
} from '../api/client';
import logoImage from '../assets/Logo/logo.png';
import { useCurrency } from '../context/CurrencyContext';
import { useLabels } from '../context/LabelContext';
import { useNotification } from '../context/NotificationContext';
import { useTheme } from '../context/ThemeContext';

interface FinancialReportProps {
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

const FinancialReport: React.FC<FinancialReportProps> = ({ onBack }) => {
  const { colors } = useTheme();
  const { showError, showSuccess, showWarning } = useNotification();
  const { formatMoney } = useCurrency();
  const { current: label } = useLabels();

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
      const [customers, sales, expenses] = await Promise.all([
        getCustomers(),
        getSales(),
        getExpensesByDateRange(startDate, endDate)
      ]);

      // Filter data for the selected month
      const monthCustomers = customers.filter(customer => {
        const customerDate = customer.check_in.substring(0, 7); // YYYY-MM format
        return customerDate === `${selectedYear}-${selectedMonth}`;
      });

      const monthSales = sales.filter(sale => {
        const saleDate = sale.created_at.substring(0, 7); // YYYY-MM format
        return saleDate === `${selectedYear}-${selectedMonth}`;
      });

      // Calculate totals
      const roomIncome = monthCustomers.reduce((sum, customer) => {
        // Calculate days stayed
        const checkIn = new Date(customer.check_in);
        const checkOut = customer.check_out ? new Date(customer.check_out) : new Date();
        const daysStayed = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
        return sum + (customer.daily_rate * Math.max(1, daysStayed));
      }, 0);

      const foodIncome = monthSales.reduce((sum, sale) => sum + sale.total_amount, 0);
      const totalIncome = roomIncome + foodIncome;
      const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
      const profitLoss = totalIncome - totalExpenses;

      setMonthlyData({
        totalIncome,
        roomIncome,
        foodIncome,
        totalExpenses,
        profitLoss,
        guestCount: monthCustomers.length,
        foodOrderCount: monthSales.length
      });

      // Generate weekly breakdown
      generateWeeklyData(selectedYear, selectedMonth, monthCustomers, monthSales, expenses);
      
      setDataLoaded(true);
      showSuccess('Report Generated', 'Monthly report has been generated successfully');
    } catch (error) {
      console.error('Error generating report:', error);
      showError('Report Error', 'Failed to generate monthly report');
    } finally {
      setLoading(false);
    }
  };

  const generateWeeklyData = (year: string, month: string, customers: Customer[], sales: SaleSummary[], expenses: ExpenseRecord[]) => {
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
      const weekCustomers = customers.filter(customer => {
        const customerDate = customer.check_in;
        return customerDate >= weekStart && customerDate <= weekEnd;
      });

      const weekSales = sales.filter(sale => {
        const saleDate = sale.created_at.substring(0, 10);
        return saleDate >= weekStart && saleDate <= weekEnd;
      });

      const weekExpenses = expenses.filter(expense => {
        const expenseDate = expense.date;
        return expenseDate >= weekStart && expenseDate <= weekEnd;
      });

      // Calculate week totals
      const weekRoomIncome = weekCustomers.reduce((sum, customer) => {
        const checkIn = new Date(customer.check_in);
        const checkOut = customer.check_out ? new Date(customer.check_out) : new Date();
        const daysStayed = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
        return sum + (customer.daily_rate * Math.max(1, daysStayed));
      }, 0);

      const weekFoodIncome = weekSales.reduce((sum, sale) => sum + sale.total_amount, 0);
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
        [`${label.unit} Income:`, formatMoney(monthlyData.roomIncome)],
        ['Sales Income:', formatMoney(monthlyData.foodIncome)],
        ['Total Expenses:', formatMoney(monthlyData.totalExpenses)],
        ['Net Profit/Loss:', formatMoney(monthlyData.profitLoss)],
        [''],
        ['Statistics'],
        [`Total ${label.client}s:`, monthlyData.guestCount.toString()],
        ['Sales:', monthlyData.foodOrderCount.toString()],
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
            :root {
              --bm-accent: #dd9f52;
              --bm-accent-soft: #dcc894;
              --bm-primary: #2b576d;
              --bm-primary-alt: #2c586e;
              --bm-muted: #8da1af;
              --bm-light: #bed0db;
            }
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: var(--bm-primary); }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid var(--bm-accent); padding-bottom: 20px; }
            .logo { max-width: 80px; height: auto; margin: 0 auto 10px; display: block; }
            .header h1 { margin: 0; color: var(--bm-primary); font-size: 28px; }
            .header h2 { margin: 5px 0; color: var(--bm-muted); font-size: 18px; }
            .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
            .summary-card { border: 1px solid var(--bm-light); border-radius: 8px; padding: 15px; background: white; }
            .summary-card h3 { margin-top: 0; color: var(--bm-primary); font-size: 16px; }
            .summary-item { display: flex; justify-content: space-between; margin: 8px 0; }
            .summary-item strong { color: var(--bm-primary); }
            .amount { font-weight: bold; }
            .positive { color: var(--bm-primary-alt); }
            .negative { color: var(--bm-accent); }
            .table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            .table th, .table td { border: 1px solid var(--bm-light); padding: 12px; text-align: left; }
            .table th { background-color: var(--bm-primary); color: white; font-weight: bold; }
            .table tr:nth-child(even) { background-color: var(--bm-light); }
            .total-row { background-color: var(--bm-accent-soft) !important; font-weight: bold; }
            .footer { margin-top: 30px; text-align: center; font-size: 12px; color: var(--bm-muted); }
          </style>
        </head>
        <body>
          <div class="header">
            <img src="${logoImage}" alt="Business Manager" class="logo">
            <h1>Business Manager</h1>
            <h2>Monthly Financial Report</h2>
            <h3>${monthName} ${selectedYear}</h3>
            <p>Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
          </div>

          <div class="summary-grid">
            <div class="summary-card">
              <h3>Income Summary</h3>
              <div class="summary-item">
                <span>${label.unit} Income:</span>
                <span class="amount positive">${formatMoney(monthlyData.roomIncome)}</span>
              </div>
              <div class="summary-item">
                <span>Sales Income:</span>
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
                <span>Total ${label.client}s:</span>
                <span class="amount">${monthlyData.guestCount}</span>
              </div>
              <div class="summary-item">
                <span>Sales:</span>
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
            <p>This report was automatically generated by Business Manager</p>
            <p>© ${new Date().getFullYear()} Business Manager</p>
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
            <div style={statCardStyle(colors.success)}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                {formatMoney(monthlyData.totalIncome)}
              </div>
              <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Total Income</div>
              <div style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
                {label.unit}: {formatMoney(monthlyData.roomIncome)} | Sales: {formatMoney(monthlyData.foodIncome)}
              </div>
            </div>

            <div style={statCardStyle(colors.error)}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                {formatMoney(monthlyData.totalExpenses)}
              </div>
              <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Total Expenses</div>
            </div>

            <div style={statCardStyle(monthlyData.profitLoss >= 0 ? colors.success : colors.error)}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                {formatMoney(monthlyData.profitLoss)}
              </div>
              <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>
                {monthlyData.profitLoss >= 0 ? 'Profit' : 'Loss'}
              </div>
            </div>

            <div style={statCardStyle(colors.warning)}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                {monthlyData.guestCount}
              </div>
              <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Total {label.client}s</div>
              <div style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
                Sales: {monthlyData.foodOrderCount}
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
                          backgroundColor: colors.success,
                          borderRadius: '4px 4px 0 0',
                          minHeight: '10px'
                        }}
                        title={`Income: ${formatMoney(week.income)}`}
                      />
                      <div
                        style={{
                          width: '20px',
                          height: `${(week.expenses / maxValue) * 180}px`,
                          backgroundColor: colors.error,
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
                <div style={{ width: '16px', height: '16px', backgroundColor: colors.success, borderRadius: '2px' }} />
                <span style={{ fontSize: '0.9rem' }}>Income</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '16px', height: '16px', backgroundColor: colors.error, borderRadius: '2px' }} />
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
                      <td style={{ padding: '1rem', textAlign: 'right', color: colors.success }}>
                        {formatMoney(week.income)}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right', color: colors.error }}>
                        {formatMoney(week.expenses)}
                      </td>
                      <td style={{ 
                        padding: '1rem', 
                        textAlign: 'right', 
                        color: week.profit >= 0 ? colors.success : colors.error,
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

export default FinancialReport;
