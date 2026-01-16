# 💰 Spendlytics - Smart Expense Tracker

[![Live Demo](https://img.shields.io/badge/Live%20Demo-spendlytics.netlify.app-blue?style=for-the-badge&logo=netlify)](https://spendlytics.netlify.app/)
[![React](https://img.shields.io/badge/React-18.3.1-blue?style=for-the-badge&logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6.2-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-green?style=for-the-badge&logo=supabase)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-3.4.17-blue?style=for-the-badge&logo=tailwindcss)](https://tailwindcss.com/)

A modern, feature-rich expense tracking application built with React, TypeScript, and Supabase. Track your expenses, manage budgets, set savings goals, and gain insights into your spending patterns with beautiful analytics and reports.

## 🚀 Live Demo

**Try it now:** [https://spendlytics.netlify.app/](https://spendlytics.netlify.app/)

## ✨ Features

### 📊 **Dashboard & Analytics**
- **Interactive Dashboard** with spending overview and trends
- **Visual Charts** showing spending by category and monthly trends
- **Real-time Statistics** including total expenses, monthly spending, and transaction counts
- **Spending Insights** with unusual spending detection

### 💸 **Expense Management**
- **Add/Edit/Delete Expenses** with detailed information
- **Multiple Categories** including Food, Transportation, Entertainment, Bills, Healthcare, and more
- **Payment Method Tracking** (Cash, Credit Card, Debit Card, Bank Transfer, Digital Wallet)
- **Receipt Management** with URL attachments
- **Tags System** for better organization
- **Recurring Expenses** with frequency settings

### 💰 **Budget Management**
- **Monthly Budget Limits** per category
- **Budget Progress Tracking** with visual progress bars
- **Budget Alerts** when approaching or exceeding limits
- **Budget vs Actual** spending comparisons

### 💵 **Income Tracking**
- **Income Entry Management** with categories
- **Multiple Income Sources** (Salary, Freelance, Investment, Business, etc.)
- **Net Cash Flow** calculations

### 🎯 **Savings Goals**
- **Goal Setting** with target amounts and deadlines
- **Progress Tracking** with visual indicators
- **Goal Management** with add/edit/delete functionality
- **Achievement Celebrations** when goals are reached

### 📈 **Reports & Insights**
- **Monthly Reports** with detailed breakdowns
- **Category Analysis** with percentages and trends
- **Spending Trends** over the last 6 months
- **CSV Export** for external analysis
- **Unusual Spending Detection** for budget awareness

### 🔍 **Advanced Filtering**
- **Search Functionality** across descriptions and categories
- **Date Range Filtering** for specific periods
- **Amount Range Filtering** for expense amounts
- **Category and Payment Method Filters**
- **Saved Filter Presets** for quick access
- **Recurring Expense Filtering**

### 📱 **Modern UI/UX**
- **Responsive Design** optimized for mobile and desktop
- **Dark/Light Mode** toggle
- **Progressive Web App (PWA)** with offline capabilities
- **Beautiful Animations** and smooth transitions
- **Glassmorphism Design** with modern aesthetics

### 🔐 **Security & Authentication**
- **Secure User Authentication** with Supabase Auth
- **Row Level Security (RLS)** for data isolation
- **Password Reset** functionality
- **Multi-user Support** with isolated data

### ⚙️ **Customization**
- **Feature Toggles** to enable/disable specific features
- **Multiple Currency Support** with formatting
- **Customizable Categories** and tags
- **Import/Export** capabilities

## 🛠️ Tech Stack

- **Frontend:** React 18.3.1 with TypeScript
- **Styling:** Tailwind CSS with custom animations
- **Backend:** Supabase (PostgreSQL + Auth + Real-time)
- **Charts:** Recharts for data visualization
- **Icons:** Lucide React
- **Date Handling:** date-fns
- **PDF Generation:** jsPDF for reports
- **Build Tool:** Vite
- **Deployment:** Netlify

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/laoluafolami/spendlytics.git
   cd spendlytics
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Supabase**
   - Create a new project at [supabase.com](https://supabase.com)
   - Copy your project URL and anon key
   - Run the database migrations (see [Database Setup](#database-setup))

4. **Environment Configuration**
   ```bash
   cp .env.example .env
   ```
   
   Update `.env` with your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to `http://localhost:5173`

### Database Setup

Run the following SQL migrations in your Supabase SQL Editor in order:

1. **Create expenses table:**
   ```sql
   -- Run: supabase/migrations/20260114125656_create_expenses_table.sql
   ```

2. **Add enhanced features:**
   ```sql
   -- Run: supabase/migrations/20260114135858_add_enhanced_features_simple.sql
   ```

3. **Add security policies:**
   ```sql
   -- Run the security migration to add user_id columns and RLS policies
   ```

For detailed migration instructions, see `SUPABASE_SETUP.md`.

## 📱 How to Use

### 🔐 **Getting Started**

1. **Sign Up/Login**
   - Visit [https://spendlytics.netlify.app/](https://spendlytics.netlify.app/)
   - Create a new account or login with existing credentials
   - Your data is completely private and secure

### 💸 **Managing Expenses**

1. **Add New Expense**
   - Click "Add Expense" in the sidebar
   - Fill in amount, category, description, and date
   - Optionally add payment method, tags, and receipt URL
   - Set as recurring if it's a regular expense

2. **View All Expenses**
   - Navigate to "All Expenses" to see your transaction history
   - Use filters to find specific expenses
   - Edit or delete expenses as needed

3. **Advanced Features**
   - **Tags:** Organize expenses with custom tags
   - **Receipts:** Attach receipt URLs for record keeping
   - **Recurring:** Set up automatic recurring expenses

### 💰 **Budget Management**

1. **Create Budgets**
   - Go to "Budgets" section
   - Set monthly limits for each category
   - Monitor progress with visual indicators

2. **Track Progress**
   - View budget vs actual spending
   - Get alerts when approaching limits
   - Analyze spending patterns

### 🎯 **Savings Goals**

1. **Set Goals**
   - Navigate to "Savings" section
   - Create goals with target amounts and deadlines
   - Track progress visually

2. **Update Progress**
   - Add funds to your savings goals
   - Monitor achievement percentage
   - Celebrate when goals are reached

### 📊 **Analytics & Reports**

1. **Dashboard Overview**
   - View spending trends and category breakdowns
   - Monitor monthly vs previous periods
   - Identify unusual spending patterns

2. **Detailed Reports**
   - Generate monthly reports with category analysis
   - Export data to CSV for external analysis
   - Track spending trends over time

### ⚙️ **Customization**

1. **Settings**
   - Toggle features on/off based on your needs
   - Change currency preferences
   - Customize categories and payment methods

2. **Filters & Search**
   - Save frequently used filter combinations
   - Search across all expense data
   - Filter by date ranges, amounts, and categories

## 🎨 Features Overview

### 📊 Dashboard
- Real-time spending overview
- Category breakdown with pie charts
- Monthly trend analysis
- Quick statistics

### 💸 Expense Tracking
- Comprehensive expense entry
- Multiple categories and payment methods
- Receipt attachment support
- Recurring expense automation

### 💰 Budget Management
- Category-based budget limits
- Progress tracking and alerts
- Budget vs actual comparisons
- Visual progress indicators

### 🎯 Savings Goals
- Goal setting with deadlines
- Progress tracking
- Achievement celebrations
- Multiple concurrent goals

### 📈 Reports & Analytics
- Monthly detailed reports
- CSV export functionality
- Spending trend analysis
- Unusual spending detection

### 🔍 Advanced Filtering
- Multi-criteria search
- Saved filter presets
- Date and amount range filters
- Category and payment filters

## 🚀 Deployment

### Netlify Deployment

1. **Connect Repository**
   - Link your GitHub repository to Netlify
   - Set build command: `npm run build`
   - Set publish directory: `dist`

2. **Environment Variables**
   - Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
   - Deploy the site

3. **Custom Domain (Optional)**
   - Configure custom domain in Netlify settings
   - Set up SSL certificate

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Supabase](https://supabase.com/) for the amazing backend-as-a-service
- [Tailwind CSS](https://tailwindcss.com/) for the utility-first CSS framework
- [Lucide](https://lucide.dev/) for the beautiful icons
- [Recharts](https://recharts.org/) for the charting library

## 📞 Support

If you have any questions or need help, please:
- Open an issue on GitHub
- Visit the live demo: [https://spendlytics.netlify.app/](https://spendlytics.netlify.app/)

---

**Made with ❤️ by [Laolu Afolami](https://github.com/laoluafolami)**

[![Live Demo](https://img.shields.io/badge/🚀%20Try%20It%20Now-spendlytics.netlify.app-success?style=for-the-badge)](https://spendlytics.netlify.app/)