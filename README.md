# � Business Manager - Universal Business Management System

A comprehensive desktop business management application built with **Tauri**, **React**, **TypeScript**, and **Rust**. This white-label application provides a complete solution for managing hotel, restaurant, retail, or any service-based business operations including customer management, sales tracking, inventory control, financial reporting, and multi-user access control.

## 🌟 Key Features

### 🔐 Authentication & Multi-User Access (Phase 1 & 4)
- **Offline Authentication**: Secure username/password system with no internet required
- **Role-Based Access Control (RBAC)**: Three-tier permission system
  - **Admin**: Full system access, settings, user management
  - **Manager**: Reports, inventory, sales management (no critical settings)
  - **Staff**: Point-of-sale operations only
- **Password Recovery**: Security question-based reset
- **Session Management**: Automatic session tracking and cleanup
- **Setup Wizard**: First-run configuration with admin account creation

### 🎨 White-Label Customization (Phase 3)
- **Custom Branding**: Upload your business logo
- **Color Themes**: Set custom primary color for your brand
- **Receipt Customization**: Add custom header and footer text to all receipts
- **Business Naming**: Fully customizable business name (no hard-coded "hotel" references)
- **Multi-Mode Support**: Hotel, Restaurant, or Retail mode

### 👥 Customer Management (Phase 2)
- **Universal Customer Records**: Supports guests, walk-ins, and regular customers
- **Flexible Registration**: Optional room/resource assignment
- **Customer History**: Complete transaction records
- **Active Customer Tracking**: Real-time status monitoring
- **Generic Labels**: Adapts terminology based on business mode

### 🏠 Resource/Room Management
- **Dynamic Resource Creation**: Rooms, tables, workstations, or any bookable resource
- **Status Tracking**: Real-time occupancy/availability
- **Flexible Pricing**: Custom daily/hourly rates
- **Type Categories**: Customizable resource types

### 🍽️ Menu/Catalog Management with Inventory (Phase 4)
- **Product/Service Catalog**: Manage sellable items with categories
- **True Inventory Tracking**: 
  - Track physical products with stock quantities
  - Mark services as non-tracked items
  - Automatic stock decrement on sales
  - Low stock alerts with customizable thresholds
- **Category Organization**: Customizable categories for your business
- **Price Management**: Set custom prices per item

### 💰 Sales & Point of Sale
- **Quick Sales Entry**: Fast order/sale creation
- **Order Tracking**: Monitor pending and completed sales
- **Payment Status**: Mark sales as paid/unpaid
- **Customer Association**: Link sales to specific customers or walk-ins
- **Stock Validation**: Prevents overselling tracked inventory

### 💼 End-of-Day Management (Phase 4)
- **Shift Management**: Open/close shifts with cash reconciliation
- **Z-Report Generation**: Complete end-of-day reports with:
  - Starting cash amount
  - Total sales and expenses
  - Expected vs actual cash
  - Variance tracking and notes
- **Shift History**: Review past shifts and performance
- **Multi-Cashier Support**: Track who opened/closed each shift

### 📊 Financial Reporting
- **Expense Tracking**: Record operational expenses by category
- **Revenue Monitoring**: Track income from all sources
- **Profit/Loss Calculation**: Real-time P&L analysis
- **Monthly Reports**: Comprehensive financial summaries
- **Date Range Reports**: Custom period analysis
- **Low Stock Alerts**: Dashboard widget for inventory monitoring

### ⚙️ System Features
- **Multi-Currency Support**: Customizable currency code and formatting
- **Dark/Light Themes**: User preference theme switching
- **Responsive Design**: Works on various screen sizes
- **Offline Operation**: No internet connection required
- **Data Backup & Export**: CSV exports and database backups
- **Protected Routes**: UI elements hidden based on user role
- **Quick Navigation**: Intuitive menu system

## 🎯 Phase Progression

### ✅ Phase 1: Offline-First Foundation
- Secure offline authentication
- Session management
- Setup wizard for initial configuration
- Password recovery system

### ✅ Phase 2: Generic Business Model
- Removed hard-coded "hotel" terminology
- Generic resource/customer models
- Backward-compatible data structure
- Multi-business-mode support

### ✅ Phase 3: White-Labeling
- Custom logo upload and display
- Brand color customization
- Receipt header/footer customization
- Full branding control

### ✅ Phase 4: Essential Business Features
- **RBAC**: Three-tier role-based access control
- **Inventory**: True stock tracking with alerts
- **Shifts**: End-of-day closing and Z-reports

## 🛠️ Technology Stack

### Frontend
- **React 18**: Modern UI framework
- **TypeScript**: Type-safe development
- **Vite**: Fast build tool and development server
- **CSS3**: Custom styling with theme support

### Backend
- **Rust**: High-performance backend logic
- **Tauri**: Desktop application framework
- **SQLite**: Local database storage
- **Rusqlite**: Database ORM for Rust

### Desktop
- **Native App**: Cross-platform desktop application
- **MSI Installer**: Windows installation package
- **NSIS Installer**: Alternative Windows installer

## 📦 Installation

### For End Users

1. **Download the installer** from the releases section:
   - `hotel-app_0.1.0_x64_en-US.msi` (MSI Installer - Recommended)
   - `hotel-app_0.1.0_x64-setup.exe` (NSIS Installer)

2. **Run the installer** and follow the installation wizard

3. **Launch the application** from your desktop or start menu

### Default Login Credentials
- **Username**: `yasinheaven`
- **Password**: `YHSHotel@2025!`

## 🚀 Quick Start Guide

### 1. First Login
1. Launch the hotel management application
2. Enter your admin credentials
3. Click "Login to Hotel Manager"

### 2. Initial Setup
1. **Add Rooms**: Go to Settings → Manage Menu/Rooms → Rooms tab
2. **Create Menu**: Add food items in the Menu tab
3. **Set Preferences**: Configure tax rates and system settings

### 3. Daily Operations

#### Adding a Guest
1. Click "Add Guest" from dashboard or navigation
2. Fill in guest details (name, phone, email)
3. Select available room and dates
4. Set daily rate and confirm booking

#### Managing Food Orders
1. Click "Add Food Order" 
2. Select guest or choose walk-in customer
3. Add menu items to the order
4. Process payment or mark as pending

#### Checking Out Guests
1. Go to "Active Guests"
2. Click "Checkout" for the departing guest
3. Review final bill (room charges + food orders)
4. Process payment and complete checkout

## 📋 Application Flow

### Main Navigation
```
Dashboard (Home)
├── Add Guest
├── Active Guests  
├── Add Food Order
├── Add Expense
├── History
├── Monthly Report
└── Settings
    ├── Manage Menu Items
    ├── Manage Rooms
    └── System Settings
```

### User Workflow
1. **Login** → Secure authentication
2. **Dashboard** → Overview of hotel status
3. **Manage Rooms** → Set up available rooms
4. **Add Menu Items** → Create restaurant menu
5. **Add Guests** → Register new bookings
6. **Process Orders** → Handle food orders
7. **Monitor Active Guests** → Track current occupancy
8. **Generate Reports** → Financial summaries
9. **Track Expenses** → Record operational costs

## 🎨 User Interface

### Navigation Features
- **Quick Access**: Click hotel logo for navigation dropdown
- **Theme Toggle**: Switch between dark and light modes
- **Responsive Layout**: Adaptive sidebar and mobile-friendly design
- **Visual Feedback**: Active page highlighting and hover effects

### Dashboard Widgets
- **Total Guests This Month**: Monthly guest count
- **Active Guests**: Currently checked-in
- **Total Revenue**: Monthly earnings
- **Average Daily Rate**: Room pricing analytics

## 🗃️ Database Schema

### Core Tables
- **guests**: Guest information and stay records
- **rooms**: Room details and availability
- **menu_items**: Restaurant menu with pricing
- **food_orders**: Order records and payments
- **food_order_items**: Individual order items
- **expenses**: Operational expense tracking
- **admin_settings**: System configuration

### Data Relationships
- Guests ↔ Rooms (booking relationship)
- Guests ↔ Food Orders (guest orders)
- Food Orders ↔ Menu Items (order contents)

## 🔧 Development

### Prerequisites
- **Node.js 18+**: JavaScript runtime
- **Rust 1.70+**: System programming language
- **Tauri CLI**: Desktop app framework

### Setup Development Environment

1. **Clone the repository**
```bash
git clone https://github.com/Haiderali27-hub/hotel-manager.git
cd hotel-app
```

2. **Install dependencies**
```bash
npm install
```

3. **Install Tauri CLI**
```bash
npm install -g @tauri-apps/cli
```

4. **Start development server**
```bash
npm run tauri dev
```

### Build for Production

```bash
# Build the application
npm run tauri build

# Output files will be in:
# src-tauri/target/release/app.exe (standalone)
# src-tauri/target/release/bundle/msi/ (MSI installer)
# src-tauri/target/release/bundle/nsis/ (NSIS installer)
```

## 📁 Project Structure

```
hotel-app/
├── src/                    # React frontend
│   ├── components/         # UI components
│   ├── context/           # React contexts
│   ├── services/          # API services
│   ├── styles/           # CSS styles
│   └── utils/            # Utility functions
├── src-tauri/            # Rust backend
│   ├── src/              # Rust source code
│   ├── icons/            # App icons
│   └── capabilities/     # Tauri permissions
├── public/               # Static assets
├── scripts/              # Database scripts
└── db/                   # SQLite database
```

## 🛡️ Security Features

- **Offline Authentication**: No network dependencies
- **Local Data Storage**: All data stored locally
- **Session Management**: Secure login/logout
- **Input Validation**: Prevent malicious inputs
- **Data Encryption**: Secure sensitive information

## 📱 System Requirements

### Minimum Requirements
- **OS**: Windows 10/11 (64-bit)
- **Memory**: 4GB RAM
- **Storage**: 100MB available space
- **Display**: 1024x768 resolution

### Recommended
- **OS**: Windows 11 (64-bit)
- **Memory**: 8GB RAM
- **Storage**: 500MB available space
- **Display**: 1920x1080 resolution

## 🆘 Support & Troubleshooting

### Common Issues

**Login Problems**
- Ensure correct credentials: `yasinheaven` / `YHSHotel@2025!`
- Try password recovery with security question
- Restart application if session issues occur

**Database Issues**
- Check if database file is accessible
- Restart application to reinitialize database
- Contact support for data recovery

**Performance Issues**
- Close unnecessary applications
- Restart the hotel management app
- Check available disk space

### Getting Help
- Check the built-in help documentation
- Review error messages for specific issues
- Contact system administrator for technical support

## 📝 License

This project is proprietary software developed for Yasin Heaven Star Hotel.

## 👥 Credits

Developed by the hotel management development team for efficient hotel operations and guest services.

---

**Version**: 0.1.0  
**Last Updated**: September 2025  
**Supported Platforms**: Windows 64-bit
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },

```
