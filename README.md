# Finance Compass

A beginner-friendly personal finance web app that mirrors spreadsheet-style budgeting, savings, and investment calculations.

## Getting started

1. Install Node.js 20+.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the app:
   ```bash
   npm run dev
   ```
4. Open http://localhost:3000

## Current features

- Spreadsheet data is preloaded from your Budget, Savings, and Investment workbooks
- Dashboard tab with key totals (income, expenditure, savings, net worth)
- Budget tab with editable monthly and yearly expense tables
- Savings tab for primary, secondary, and investment-fund buckets
- Investments tab with holdings and total invested
- Excel serial date support (for example `45505`) with readable date hints
- Auto-save in browser local storage

## If data looks old

Click **Reload spreadsheet defaults** in the app header to reset local saved data and use the latest built-in spreadsheet seed.
