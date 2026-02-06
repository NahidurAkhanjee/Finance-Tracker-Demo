"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { spreadsheetSeed } from "@/data/spreadsheetSeed";

type AmountRow = {
  id: string;
  label: string;
  date: string;
  amount: number;
};

type IncomeRow = {
  id: string;
  label: string;
  monthlyAmount: number;
};

type MonthlyBudgetItem = {
  id: string;
  label: string;
  category: "spending" | "saving" | "investing";
  monthlyAmount: number;
};

type RegularDepositRow = {
  id: string;
  date: string;
  amount: number;
  target: number;
};

type AdditionalDepositRow = {
  id: string;
  date: string;
  amount: number;
  note: string;
};

type WithdrawalRow = {
  id: string;
  date: string;
  amount: number;
  reason: string;
};

type MarketChangeRow = {
  id: string;
  date: string;
  amount: number;
  currentValue?: number;
  note: string;
  holdingId?: string;
};

type SavingsBucket = {
  location: string;
  cashStash: number;
  regularDeposits: RegularDepositRow[];
  additionalDeposits: AdditionalDepositRow[];
  withdrawals: WithdrawalRow[];
  marketChanges: MarketChangeRow[];
};

type SavingsSectionTab = "savings" | "investments";

type SavingsSection = {
  id: string;
  title: string;
  tab: SavingsSectionTab;
  bucket: SavingsBucket;
};

type HoldingRow = {
  id: string;
  name: string;
  location: string;
  amount: number;
};

type AppState = {
  budget: {
    monthlyExpenses: AmountRow[];
    yearlyExpenses: AmountRow[];
    monthlyBudgetItems: MonthlyBudgetItem[];
    incomeStreams: IncomeRow[];
  };
  savings: {
    sections: SavingsSection[];
  };
  investments: {
    startDate: string;
    holdings: HoldingRow[];
    marketChanges: MarketChangeRow[];
  };
};

type TabKey = "dashboard" | "budget" | "savings" | "investments";
type BudgetAuditAction = "add" | "update" | "delete";

type BudgetAuditEntry = {
  id: string;
  at: string;
  section: string;
  item: string;
  field: string;
  action: BudgetAuditAction;
  before: string;
  after: string;
};

const STORAGE_KEY = "finance-compass-v3";
const BUDGET_AUDIT_STORAGE_KEY = "finance-compass-budget-audit-v2";
const HISTORY_LIMIT = 150;

type LegacyBudgetValues = {
  monthlySpendingBudget?: number;
  monthlyPrimarySavings?: number;
  monthlySecondarySavings?: number;
  monthlyInvestmentBudget?: number;
  monthlyPensionContribution?: number;
};

type LegacySavingsState = {
  primary?: SavingsBucket;
  secondary?: SavingsBucket;
  investmentFund?: SavingsBucket;
  sections?: SavingsSection[];
};

const toNumber = (raw: string) => {
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
};

const sumAmounts = <T extends { amount: number }>(rows: T[]) =>
  rows.reduce((total, row) => total + row.amount, 0);

const sortByLabel = <T extends { label: string }>(rows: T[]) =>
  [...rows].sort((left, right) => {
    const leftLabel = left.label.trim().toLowerCase();
    const rightLabel = right.label.trim().toLowerCase();

    if (!leftLabel && !rightLabel) return 0;
    if (!leftLabel) return 1;
    if (!rightLabel) return -1;

    return leftLabel.localeCompare(rightLabel, "en-GB", { sensitivity: "base" });
  });

const yearlyFromMonthly = (value: number) => value * 12;

const formatPounds = (value: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 2
  }).format(value);

const formatCompactPounds = (value: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);

const formatSignedPercent = (ratio: number | null) => {
  if (ratio === null || !Number.isFinite(ratio)) {
    return "n/a";
  }

  const percentageText = new Intl.NumberFormat("en-GB", {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Math.abs(ratio));

  return ratio < 0 ? `-${percentageText}` : percentageText;
};

const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;

const formatUkDate = (date: Date) => {
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
};

const excelSerialToUkDate = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  const baseDate = new Date(Date.UTC(1899, 11, 30));
  baseDate.setUTCDate(baseDate.getUTCDate() + Math.floor(parsed));
  return formatUkDate(baseDate);
};

const isoDateToUkDate = (value: string) => {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
};

const normalizeDateToUk = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    return trimmed;
  }

  const excelDate = excelSerialToUkDate(trimmed);
  if (excelDate) {
    return excelDate;
  }

  const isoDate = isoDateToUkDate(trimmed);
  if (isoDate) {
    return isoDate;
  }

  return trimmed;
};

type DateInputMode = "full" | "day" | "dayMonth";

const toTwoDigits = (value: number) => `${value}`.padStart(2, "0");

const normalizeDayOfMonth = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const isoMatch = trimmed.match(/^\d{4}-\d{1,2}-(\d{1,2})$/);
  if (isoMatch) {
    const day = Number(isoMatch[1]);
    return day >= 1 && day <= 31 ? toTwoDigits(day) : "";
  }

  const dayMatch = trimmed.match(/^(\d{1,2})(?:[\/-]\d{1,2}(?:[\/-]\d{2,4})?)?$/);
  if (dayMatch) {
    const day = Number(dayMatch[1]);
    return day >= 1 && day <= 31 ? toTwoDigits(day) : "";
  }

  return "";
};

const normalizeDayAndMonth = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const isoMatch = trimmed.match(/^\d{4}-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const month = Number(isoMatch[1]);
    const day = Number(isoMatch[2]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return `${toTwoDigits(day)}/${toTwoDigits(month)}`;
    }
    return "";
  }

  const dayMonthMatch = trimmed.match(/^(\d{1,2})[\/-](\d{1,2})(?:[\/-]\d{2,4})?$/);
  if (dayMonthMatch) {
    const day = Number(dayMonthMatch[1]);
    const month = Number(dayMonthMatch[2]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return `${toTwoDigits(day)}/${toTwoDigits(month)}`;
    }
    return "";
  }

  return "";
};

const normalizeDateByMode = (value: string, mode: DateInputMode) => {
  if (mode === "day") {
    return normalizeDayOfMonth(value);
  }
  if (mode === "dayMonth") {
    return normalizeDayAndMonth(value);
  }
  return normalizeDateToUk(value);
};

const normalizeSavingsMarketChanges = (rows: MarketChangeRow[], baseValue: number): MarketChangeRow[] => {
  let previousCurrentValue = baseValue;

  return rows.map((row) => {
    const explicitCurrentValue =
      typeof row.currentValue === "number" && Number.isFinite(row.currentValue) ? row.currentValue : undefined;
    const currentValue = explicitCurrentValue ?? previousCurrentValue + row.amount;
    const amount = currentValue - previousCurrentValue;
    previousCurrentValue = currentValue;

    return {
      ...row,
      amount,
      currentValue
    };
  });
};

const calculateSavingsSummary = (bucket: SavingsBucket) => {
  const regularTotal = sumAmounts(bucket.regularDeposits);
  const regularTargetTotal = bucket.regularDeposits.reduce((total, row) => total + row.target, 0);
  const additionalTotal = sumAmounts(bucket.additionalDeposits);
  const withdrawalTotal = sumAmounts(bucket.withdrawals);
  const totalBeforeWithdrawals = regularTotal + additionalTotal;
  const baseValue = totalBeforeWithdrawals - withdrawalTotal - bucket.cashStash;
  const normalizedMarketChanges = normalizeSavingsMarketChanges(bucket.marketChanges, baseValue);
  const marketChangeTotal = sumAmounts(normalizedMarketChanges);
  const marketChangeRatio = baseValue !== 0 ? marketChangeTotal / baseValue : null;
  const finalTotal = baseValue + marketChangeTotal;

  return {
    regularTotal,
    regularTargetTotal,
    additionalTotal,
    withdrawalTotal,
    marketChangeTotal,
    marketChangeRatio,
    totalBeforeWithdrawals,
    baseValue,
    normalizedMarketChanges,
    finalTotal
  };
};

const createEmptySavingsBucket = (): SavingsBucket => ({
  location: "",
  cashStash: 0,
  regularDeposits: [],
  additionalDeposits: [],
  withdrawals: [],
  marketChanges: []
});

const buildBucketFromSeed = (
  bucket: (typeof spreadsheetSeed)["savings"]["primary"],
  prefix: string
): SavingsBucket => ({
  location: bucket.location,
  cashStash: bucket.cashStash,
  regularDeposits: bucket.regularDeposits.map((row, index) => ({
    id: `${prefix}-regular-${index + 1}`,
    date: normalizeDateToUk(row.date),
    amount: row.amount,
    target: row.target
  })),
  additionalDeposits: bucket.additionalDeposits.map((row, index) => ({
    id: `${prefix}-extra-${index + 1}`,
    date: normalizeDateToUk(row.date),
    amount: row.amount,
    note: row.note
  })),
  withdrawals: bucket.withdrawals.map((row, index) => ({
    id: `${prefix}-withdraw-${index + 1}`,
    date: normalizeDateToUk(row.date),
    amount: row.amount,
    reason: row.reason
  })),
  marketChanges: []
});

const buildDefaultSavingsSections = (): SavingsSection[] => [
  {
    id: "savings-section-primary",
    title: "Primary savings",
    tab: "savings",
    bucket: buildBucketFromSeed(spreadsheetSeed.savings.primary, "primary")
  },
  {
    id: "savings-section-secondary",
    title: "Secondary savings",
    tab: "savings",
    bucket: buildBucketFromSeed(spreadsheetSeed.savings.secondary, "secondary")
  },
  {
    id: "savings-section-investment-fund",
    title: "Investments tracker",
    tab: "investments",
    bucket: buildBucketFromSeed(spreadsheetSeed.savings.investmentFund, "fund")
  }
];

const buildDefaultMonthlyBudgetItems = (): MonthlyBudgetItem[] => [
  {
    id: "monthly-budget-1",
    label: "Monthly spending budget (£)",
    category: "spending",
    monthlyAmount: spreadsheetSeed.budget.monthlySpendingBudget
  },
  {
    id: "monthly-budget-2",
    label: "Monthly primary savings amount (£)",
    category: "saving",
    monthlyAmount: spreadsheetSeed.budget.monthlyPrimarySavings
  },
  {
    id: "monthly-budget-3",
    label: "Monthly secondary savings amount (£)",
    category: "saving",
    monthlyAmount: spreadsheetSeed.budget.monthlySecondarySavings
  },
  {
    id: "monthly-budget-4",
    label: "Monthly investment budget (£)",
    category: "investing",
    monthlyAmount: spreadsheetSeed.budget.monthlyInvestmentBudget
  },
  {
    id: "monthly-budget-5",
    label: "Monthly pension contribution (£)",
    category: "investing",
    monthlyAmount: spreadsheetSeed.budget.monthlyPensionContribution
  }
];

const normalizeMonthlyBudgetCategory = (
  categoryRaw: unknown,
  label: string
): MonthlyBudgetItem["category"] => {
  if (categoryRaw === "spending" || categoryRaw === "saving" || categoryRaw === "investing") {
    return categoryRaw;
  }

  const normalizedLabel = label.trim().toLowerCase();
  if (categoryRaw === "savingInvesting") {
    if (normalizedLabel.includes("invest") || normalizedLabel.includes("pension")) {
      return "investing";
    }
    return "saving";
  }

  if (normalizedLabel.includes("spend")) {
    return "spending";
  }
  if (normalizedLabel.includes("invest") || normalizedLabel.includes("pension")) {
    return "investing";
  }
  return "saving";
};

const normalizeMonthlyBudgetItems = (
  monthlyBudgetItems: unknown,
  legacyValues?: LegacyBudgetValues
): MonthlyBudgetItem[] => {
  if (Array.isArray(monthlyBudgetItems)) {
    const normalized = monthlyBudgetItems
      .map((item, index) => {
        if (!item || typeof item !== "object") {
          return null;
        }

        const candidate = item as Partial<MonthlyBudgetItem>;
        const label = typeof candidate.label === "string" ? candidate.label : "";
        const category = normalizeMonthlyBudgetCategory(
          (candidate as Partial<MonthlyBudgetItem> & { category?: unknown }).category,
          label
        );

        return {
          id: typeof candidate.id === "string" && candidate.id.trim() ? candidate.id : `monthly-budget-${index + 1}`,
          label,
          category,
          monthlyAmount:
            typeof candidate.monthlyAmount === "number" && Number.isFinite(candidate.monthlyAmount)
              ? candidate.monthlyAmount
              : 0
        } as MonthlyBudgetItem;
      })
      .filter((item): item is MonthlyBudgetItem => item !== null);

    if (normalized.length > 0) {
      return normalized;
    }
  }

  if (legacyValues) {
    return [
      {
        id: "monthly-budget-1",
        label: "Monthly spending budget (£)",
        category: "spending",
        monthlyAmount: Number.isFinite(legacyValues.monthlySpendingBudget ?? NaN)
          ? legacyValues.monthlySpendingBudget ?? 0
          : spreadsheetSeed.budget.monthlySpendingBudget
      },
      {
        id: "monthly-budget-2",
        label: "Monthly primary savings amount (£)",
        category: "saving",
        monthlyAmount: Number.isFinite(legacyValues.monthlyPrimarySavings ?? NaN)
          ? legacyValues.monthlyPrimarySavings ?? 0
          : spreadsheetSeed.budget.monthlyPrimarySavings
      },
      {
        id: "monthly-budget-3",
        label: "Monthly secondary savings amount (£)",
        category: "saving",
        monthlyAmount: Number.isFinite(legacyValues.monthlySecondarySavings ?? NaN)
          ? legacyValues.monthlySecondarySavings ?? 0
          : spreadsheetSeed.budget.monthlySecondarySavings
      },
      {
        id: "monthly-budget-4",
        label: "Monthly investment budget (£)",
        category: "investing",
        monthlyAmount: Number.isFinite(legacyValues.monthlyInvestmentBudget ?? NaN)
          ? legacyValues.monthlyInvestmentBudget ?? 0
          : spreadsheetSeed.budget.monthlyInvestmentBudget
      },
      {
        id: "monthly-budget-5",
        label: "Monthly pension contribution (£)",
        category: "investing",
        monthlyAmount: Number.isFinite(legacyValues.monthlyPensionContribution ?? NaN)
          ? legacyValues.monthlyPensionContribution ?? 0
          : spreadsheetSeed.budget.monthlyPensionContribution
      }
    ];
  }

  return buildDefaultMonthlyBudgetItems();
};

const cloneAppState = (value: AppState): AppState => JSON.parse(JSON.stringify(value)) as AppState;

const areStatesEqual = (left: AppState, right: AppState) => JSON.stringify(left) === JSON.stringify(right);

const buildInitialState = (): AppState => ({
  budget: {
    monthlyExpenses: spreadsheetSeed.budget.monthlyExpenses.map((row, index) => ({
      id: `monthly-expense-${index + 1}`,
      label: row.label,
      date: "",
      amount: row.amount
    })),
    yearlyExpenses: spreadsheetSeed.budget.yearlyExpenses.map((row, index) => ({
      id: `yearly-expense-${index + 1}`,
      label: row.label,
      date: "",
      amount: row.amount
    })),
    monthlyBudgetItems: buildDefaultMonthlyBudgetItems(),
    incomeStreams: spreadsheetSeed.budget.incomeStreams.map((row, index) => ({
      id: `income-stream-${index + 1}`,
      label: row.label,
      monthlyAmount: row.monthlyAmount
    }))
  },
  savings: {
    sections: buildDefaultSavingsSections()
  },
  investments: {
    startDate: normalizeDateToUk(spreadsheetSeed.investments.startDate),
    holdings: spreadsheetSeed.investments.holdings.map((row, index) => ({
      id: `holding-${index + 1}`,
      name: row.name,
      location: row.location,
      amount: row.amount
    })),
    marketChanges: []
  }
});

const normalizeMarketChangeRows = (rows: unknown, prefix: string): MarketChangeRow[] => {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .map((row, index) => {
      if (!row || typeof row !== "object") {
        return null;
      }

      const current = row as Partial<MarketChangeRow>;
      return {
        id:
          typeof current.id === "string" && current.id.trim()
            ? current.id
            : `${prefix}-${index + 1}`,
        date: normalizeDateToUk(typeof current.date === "string" ? current.date : ""),
        amount: typeof current.amount === "number" && Number.isFinite(current.amount) ? current.amount : 0,
        currentValue:
          typeof current.currentValue === "number" && Number.isFinite(current.currentValue)
            ? current.currentValue
            : undefined,
        note: typeof current.note === "string" ? current.note : "",
        holdingId: typeof current.holdingId === "string" ? current.holdingId : ""
      } as MarketChangeRow;
    })
    .filter((row): row is MarketChangeRow => row !== null);
};

const inferHoldingIdFromNote = (note: string, holdings: HoldingRow[]) => {
  const normalizedNote = note.trim().toLowerCase();
  if (!normalizedNote) {
    return "";
  }

  const match = holdings.find((holding) => {
    const name = holding.name.trim().toLowerCase();
    return name && normalizedNote.includes(name);
  });

  return match?.id ?? "";
};

const resolveInvestmentRowCurrentValue = (row: MarketChangeRow, holdings: HoldingRow[]) => {
  if (typeof row.currentValue === "number" && Number.isFinite(row.currentValue)) {
    return row.currentValue;
  }

  if (row.holdingId) {
    const linkedHolding = holdings.find((holding) => holding.id === row.holdingId);
    if (linkedHolding) {
      return linkedHolding.amount + row.amount;
    }
  }

  return row.amount;
};

const deriveInvestmentRowDelta = (currentValue: number, holdingId: string | undefined, holdings: HoldingRow[]) => {
  if (!holdingId) {
    return currentValue;
  }

  const linkedHolding = holdings.find((holding) => holding.id === holdingId);
  if (!linkedHolding) {
    return currentValue;
  }

  return currentValue - linkedHolding.amount;
};

const normalizeBucketDates = (bucket: SavingsBucket): SavingsBucket => ({
  ...bucket,
  regularDeposits: bucket.regularDeposits.map((row) => ({
    ...row,
    date: normalizeDateToUk(row.date)
  })),
  additionalDeposits: bucket.additionalDeposits.map((row) => ({
    ...row,
    date: normalizeDateToUk(row.date)
  })),
  withdrawals: bucket.withdrawals.map((row) => ({
    ...row,
    date: normalizeDateToUk(row.date)
  })),
  marketChanges: bucket.marketChanges.map((row) => ({
    ...row,
    date: normalizeDateToUk(row.date)
  }))
});

const normalizeBucketShape = (value: unknown, prefix: string): SavingsBucket => {
  if (!value || typeof value !== "object") {
    return createEmptySavingsBucket();
  }

  const candidate = value as Partial<SavingsBucket>;

  return normalizeBucketDates({
    location: typeof candidate.location === "string" ? candidate.location : "",
    cashStash:
      typeof candidate.cashStash === "number" && Number.isFinite(candidate.cashStash) ? candidate.cashStash : 0,
    regularDeposits: Array.isArray(candidate.regularDeposits)
      ? candidate.regularDeposits
          .map((row, index) => {
            if (!row || typeof row !== "object") {
              return null;
            }

            const current = row as Partial<RegularDepositRow>;
            return {
              id:
                typeof current.id === "string" && current.id.trim()
                  ? current.id
                  : `${prefix}-regular-${index + 1}`,
              date: typeof current.date === "string" ? current.date : "",
              amount: typeof current.amount === "number" && Number.isFinite(current.amount) ? current.amount : 0,
              target: typeof current.target === "number" && Number.isFinite(current.target) ? current.target : 0
            } as RegularDepositRow;
          })
          .filter((row): row is RegularDepositRow => row !== null)
      : [],
    additionalDeposits: Array.isArray(candidate.additionalDeposits)
      ? candidate.additionalDeposits
          .map((row, index) => {
            if (!row || typeof row !== "object") {
              return null;
            }

            const current = row as Partial<AdditionalDepositRow>;
            return {
              id:
                typeof current.id === "string" && current.id.trim()
                  ? current.id
                  : `${prefix}-extra-${index + 1}`,
              date: typeof current.date === "string" ? current.date : "",
              amount: typeof current.amount === "number" && Number.isFinite(current.amount) ? current.amount : 0,
              note: typeof current.note === "string" ? current.note : ""
            } as AdditionalDepositRow;
          })
          .filter((row): row is AdditionalDepositRow => row !== null)
      : [],
    withdrawals: Array.isArray(candidate.withdrawals)
      ? candidate.withdrawals
          .map((row, index) => {
            if (!row || typeof row !== "object") {
              return null;
            }

            const current = row as Partial<WithdrawalRow>;
            return {
              id:
                typeof current.id === "string" && current.id.trim()
                  ? current.id
                  : `${prefix}-withdraw-${index + 1}`,
              date: typeof current.date === "string" ? current.date : "",
              amount: typeof current.amount === "number" && Number.isFinite(current.amount) ? current.amount : 0,
              reason: typeof current.reason === "string" ? current.reason : ""
            } as WithdrawalRow;
          })
          .filter((row): row is WithdrawalRow => row !== null)
      : [],
    marketChanges: normalizeMarketChangeRows(candidate.marketChanges, `${prefix}-market`)
  });
};

const normalizeSavingsSections = (value: unknown): SavingsSection[] => {
  if (value && typeof value === "object") {
    const candidate = value as LegacySavingsState;

    if (Array.isArray(candidate.sections)) {
      const normalizedSections = candidate.sections
        .map((section, index) => {
          if (!section || typeof section !== "object") {
            return null;
          }

          const current = section as Partial<SavingsSection> & { tab?: unknown; bucket?: unknown };
          return {
            id:
              typeof current.id === "string" && current.id.trim() ? current.id : `savings-section-${index + 1}`,
            title: typeof current.title === "string" ? current.title : "",
            tab: current.tab === "investments" ? "investments" : "savings",
            bucket: normalizeBucketShape(current.bucket, `section-${index + 1}`)
          } as SavingsSection;
        })
        .filter((section): section is SavingsSection => section !== null);

      if (normalizedSections.length > 0) {
        return normalizedSections;
      }
    }

    const legacySections: SavingsSection[] = [];
    if (candidate.primary && typeof candidate.primary === "object") {
      legacySections.push({
        id: "savings-section-primary",
        title: "Primary savings",
        tab: "savings",
        bucket: normalizeBucketShape(candidate.primary, "primary")
      });
    }
    if (candidate.secondary && typeof candidate.secondary === "object") {
      legacySections.push({
        id: "savings-section-secondary",
        title: "Secondary savings",
        tab: "savings",
        bucket: normalizeBucketShape(candidate.secondary, "secondary")
      });
    }
    if (candidate.investmentFund && typeof candidate.investmentFund === "object") {
      legacySections.push({
        id: "savings-section-investment-fund",
        title: "Investments tracker",
        tab: "investments",
        bucket: normalizeBucketShape(candidate.investmentFund, "fund")
      });
    }

    if (legacySections.length > 0) {
      return legacySections;
    }
  }

  return buildDefaultSavingsSections();
};

const normalizeBudgetExpenseRows = (rows: AmountRow[], mode: DateInputMode): AmountRow[] =>
  rows.map((row) => ({
    ...row,
    date: normalizeDateByMode(typeof row.date === "string" ? row.date : "", mode)
  }));

const normalizeIncomeRows = (rows: IncomeRow[]): IncomeRow[] =>
  rows.map((row, index) => ({
    id: typeof row.id === "string" && row.id.trim() ? row.id : `income-stream-${index + 1}`,
    label: typeof row.label === "string" ? row.label : "",
    monthlyAmount:
      typeof row.monthlyAmount === "number" && Number.isFinite(row.monthlyAmount) ? row.monthlyAmount : 0
  }));

const normalizeStateDates = (state: AppState): AppState => {
  const budgetState = state.budget as AppState["budget"] &
    LegacyBudgetValues & {
      monthlyBudgetItems?: MonthlyBudgetItem[];
    };
  const investmentsState = state.investments as AppState["investments"] & {
    marketChanges?: unknown;
  };

  return {
    ...state,
    budget: {
      ...state.budget,
      monthlyExpenses: normalizeBudgetExpenseRows(state.budget.monthlyExpenses, "day"),
      yearlyExpenses: normalizeBudgetExpenseRows(state.budget.yearlyExpenses, "dayMonth"),
      incomeStreams: normalizeIncomeRows(state.budget.incomeStreams),
      monthlyBudgetItems: normalizeMonthlyBudgetItems(budgetState.monthlyBudgetItems, budgetState)
    },
    savings: {
      sections: normalizeSavingsSections(state.savings)
    },
    investments: {
      ...state.investments,
      startDate: normalizeDateToUk(state.investments.startDate),
      marketChanges: normalizeMarketChangeRows(investmentsState.marketChanges, "investment-market").map((row) => {
        const hasValidHolding =
          typeof row.holdingId === "string" &&
          row.holdingId.trim() &&
          state.investments.holdings.some((holding) => holding.id === row.holdingId);

        if (hasValidHolding) {
          return row;
        }

        return {
          ...row,
          holdingId: inferHoldingIdFromNote(row.note, state.investments.holdings)
        };
      })
    }
  };
};

type DateInputCellProps = {
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  onBlur?: (value: string) => void;
  mode?: DateInputMode;
  placeholder?: string;
};

function DateInputCell({ value, onChange, onFocus, onBlur, mode = "full", placeholder }: DateInputCellProps) {
  const resolvedPlaceholder =
    placeholder ?? (mode === "day" ? "DD" : mode === "dayMonth" ? "DD/MM" : "DD/MM/YYYY");
  const resolvedPattern =
    mode === "day"
      ? "^(0[1-9]|[12][0-9]|3[01])$"
      : mode === "dayMonth"
        ? "^(0[1-9]|[12][0-9]|3[01])/(0[1-9]|1[0-2])$"
        : undefined;

  return (
    <div className="date-cell">
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={onFocus}
        onBlur={(event) => {
          const normalizedValue = normalizeDateByMode(event.target.value, mode);
          onChange(normalizedValue);
          onBlur?.(normalizedValue);
        }}
        placeholder={resolvedPlaceholder}
        inputMode="numeric"
        pattern={resolvedPattern}
      />
    </div>
  );
}

type ChartDatum = {
  label: string;
  value: number;
  color?: string;
  ratio?: number | null;
};

const chartPalette = ["#0f8a5b", "#2f6fed", "#db5a2d", "#c05621", "#5b54d6", "#3d3d3d", "#a03e9d", "#2f855a"];

const chartColorForIndex = (index: number) => chartPalette[index % chartPalette.length];

type HorizontalBarChartProps = {
  data: ChartDatum[];
  emptyMessage: string;
  maxItems?: number;
  valueFormatter?: (value: number) => string;
};

function HorizontalBarChart({
  data,
  emptyMessage,
  maxItems = 8,
  valueFormatter = formatPounds
}: HorizontalBarChartProps) {
  const normalizedData = [...data]
    .filter((item) => Number.isFinite(item.value) && item.value > 0)
    .sort((left, right) => right.value - left.value)
    .slice(0, maxItems)
    .map((item, index) => ({
      ...item,
      color: item.color ?? chartColorForIndex(index)
    }));

  if (normalizedData.length === 0) {
    return <p className="formula">{emptyMessage}</p>;
  }

  const maxValue = Math.max(...normalizedData.map((item) => item.value), 1);

  return (
    <div className="chart-bars">
      {normalizedData.map((item) => (
        <div className="chart-bar-row" key={`${item.label}-${item.value}`}>
          <div className="chart-bar-top">
            <span>{item.label.trim() || "Unnamed"}</span>
            <strong>{valueFormatter(item.value)}</strong>
          </div>
          <div className="chart-bar-track">
            <span
              className="chart-bar-fill"
              style={{
                width: `${Math.max((item.value / maxValue) * 100, 2)}%`,
                backgroundColor: item.color
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

type SignedHorizontalBarChartProps = {
  data: ChartDatum[];
  emptyMessage: string;
  maxItems?: number;
  valueFormatter?: (value: number) => string;
  xAxisTitle?: string;
  yAxisTitle?: string;
};

function SignedHorizontalBarChart({
  data,
  emptyMessage,
  maxItems = 8,
  valueFormatter = formatPounds,
  xAxisTitle = "",
  yAxisTitle = "Growth/decline (£)"
}: SignedHorizontalBarChartProps) {
  const splitLabelLines = (label: string) => {
    const trimmed = label.trim();
    if (!trimmed) {
      return ["Unnamed"];
    }

    const maxLineLength = 15;
    const words = trimmed.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let currentLine = "";

    for (const word of words) {
      if (word.length > maxLineLength) {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = "";
        }
        for (let i = 0; i < word.length; i += maxLineLength) {
          lines.push(word.slice(i, i + maxLineLength));
        }
        continue;
      }

      const candidate = currentLine ? `${currentLine} ${word}` : word;
      if (candidate.length <= maxLineLength) {
        currentLine = candidate;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  };

  const normalizedData = [...data]
    .filter((item) => Number.isFinite(item.value))
    .slice(0, maxItems)
    .map((item, index) => {
      const label = item.label.trim() || `Item ${index + 1}`;
      return {
        ...item,
        label,
        labelLines: splitLabelLines(label),
        color: item.color ?? (item.value >= 0 ? "#0f8a5b" : "#b33a34")
      };
    });

  const hasAnyMovement = normalizedData.some((item) => item.value !== 0);
  if (normalizedData.length === 0 || !hasAnyMovement) {
    return <p className="formula">{emptyMessage}</p>;
  }

  const minValue = Math.min(0, ...normalizedData.map((item) => item.value));
  const maxValue = Math.max(0, ...normalizedData.map((item) => item.value));
  const valueRange = maxValue - minValue || 1;
  const maxLabelLines = Math.max(...normalizedData.map((item) => item.labelLines.length), 1);

  const width = Math.max(980, normalizedData.length * 190);
  const height = 430;
  const paddingLeft = 74;
  const paddingRight = 24;
  const paddingTop = 30;
  const paddingBottom = 108 + maxLabelLines * 12 + (xAxisTitle ? 22 : 0);
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  const xStep = chartWidth / normalizedData.length;
  const barWidth = Math.min(62, xStep * 0.62);
  const xFor = (index: number) => paddingLeft + xStep * (index + 0.5);
  const yFor = (value: number) => paddingTop + ((maxValue - value) / valueRange) * chartHeight;
  const zeroY = yFor(0);
  const yTicks = 4;
  const yStep = valueRange / yTicks;
  const yTickValues = Array.from({ length: yTicks + 1 }, (_, index) => minValue + yStep * index);
  const xLabelStartY = height - 84 - (maxLabelLines - 1) * 12;

  return (
    <div className="chart-line-wrap chart-signed-wrap">
      <svg className="chart-line-svg chart-signed-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${yAxisTitle} graph`}>
        <line
          className="chart-line-grid"
          x1={paddingLeft}
          y1={paddingTop}
          x2={paddingLeft}
          y2={paddingTop + chartHeight}
        />

        {yTickValues.map((tickValue, index) => (
          <g key={`signed-tick-${index}`}>
            <line
              className="chart-line-grid"
              x1={paddingLeft}
              y1={yFor(tickValue)}
              x2={width - paddingRight}
              y2={yFor(tickValue)}
            />
            <text className="chart-axis-label" x={paddingLeft - 8} y={yFor(tickValue) + 4} textAnchor="end">
              {formatCompactPounds(tickValue)}
            </text>
          </g>
        ))}

        {minValue <= 0 && maxValue >= 0 ? (
          <line
            className="chart-line-zero"
            x1={paddingLeft}
            y1={zeroY}
            x2={width - paddingRight}
            y2={zeroY}
          />
        ) : null}

        {normalizedData.map((item, index) => {
          const x = xFor(index) - barWidth / 2;
          const valueY = yFor(item.value);
          const rectY = Math.min(valueY, zeroY);
          const rectHeight = Math.max(Math.abs(valueY - zeroY), item.value === 0 ? 1 : 2);

          return (
            <g key={`signed-bar-${item.label}-${index}`}>
              <rect
                className={`chart-signed-rect ${item.value >= 0 ? "positive" : "negative"}`}
                x={x}
                y={rectY}
                width={barWidth}
                height={rectHeight}
                fill={item.color}
                rx={4}
              />
              <text className="chart-axis-label chart-signed-x-label" x={xFor(index)} y={xLabelStartY} textAnchor="middle">
                {item.labelLines.map((line, lineIndex) => (
                  <tspan key={`line-${lineIndex}`} x={xFor(index)} dy={lineIndex === 0 ? 0 : 12}>
                    {line}
                  </tspan>
                ))}
              </text>
            </g>
          );
        })}

        {xAxisTitle ? (
          <text className="chart-axis-title" x={width / 2} y={height - 18} textAnchor="middle">
            {xAxisTitle}
          </text>
        ) : null}

        <text
          className="chart-axis-title"
          x={16}
          y={height / 2}
          textAnchor="middle"
          transform={`rotate(-90 16 ${height / 2})`}
        >
          {yAxisTitle}
        </text>
      </svg>

      <div className="chart-line-legend">
        {normalizedData.map((item, index) => {
          const percentage = formatSignedPercent(item.ratio ?? null);
          return (
            <span className="chart-line-pill" key={`signed-legend-${item.label}-${index}`}>
              <span className="chart-line-pill-dot" style={{ backgroundColor: item.color }} />
              <span>
                {item.label}: {valueFormatter(item.value)} ({percentage})
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

type DonutChartProps = {



  data: ChartDatum[];
  emptyMessage: string;
};

function DonutChart({ data, emptyMessage }: DonutChartProps) {
  const normalizedData = data
    .filter((item) => Number.isFinite(item.value) && item.value > 0)
    .map((item, index) => ({
      ...item,
      color: item.color ?? chartColorForIndex(index)
    }));

  const total = normalizedData.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0) {
    return <p className="formula">{emptyMessage}</p>;
  }

  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  let dashOffset = 0;
  const chartSegments = normalizedData.map((item) => {
    const dashLength = (item.value / total) * circumference;
    const segment = {
      ...item,
      dashLength,
      dashOffset
    };
    dashOffset += dashLength;
    return segment;
  });

  return (
    <div className="chart-donut-layout">
      <svg className="chart-donut-svg" viewBox="0 0 180 180" role="img" aria-label="Net worth composition chart">
        <circle className="chart-donut-track" cx="90" cy="90" r={radius} />
        {chartSegments.map((segment) => (
          <circle
            key={`${segment.label}-${segment.value}`}
            className="chart-donut-segment"
            cx="90"
            cy="90"
            r={radius}
            stroke={segment.color}
            strokeDasharray={`${segment.dashLength} ${circumference - segment.dashLength}`}
            strokeDashoffset={-segment.dashOffset}
          />
        ))}
        <text className="chart-donut-total" x="90" y="86" textAnchor="middle">
          {formatCompactPounds(total)}
        </text>
        <text className="chart-donut-label" x="90" y="106" textAnchor="middle">
          Total
        </text>
      </svg>

      <div className="chart-legend-list">
        {chartSegments.map((segment) => {
          const percentage = ((segment.value / total) * 100).toFixed(1);
          return (
            <div className="chart-legend-item" key={`legend-${segment.label}-${segment.value}`}>
              <span className="chart-legend-dot" style={{ backgroundColor: segment.color }} />
              <span>{segment.label.trim() || "Unnamed"}</span>
              <span className="chart-legend-value">
                {formatPounds(segment.value)} ({percentage}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

 type NetWorthTrendChartProps = {
  labels: string[];
  values: number[];
  emptyMessage: string;
};

function NetWorthTrendChart({ labels, values, emptyMessage }: NetWorthTrendChartProps) {
  if (labels.length === 0 || values.length === 0) {
    return <p className="formula">{emptyMessage}</p>;
  }

  const normalizedValues = values.slice(0, labels.length);
  const allValues = normalizedValues.filter((value) => Number.isFinite(value));
  if (allValues.length === 0 || allValues.every((value) => value === 0)) {
    return <p className="formula">{emptyMessage}</p>;
  }

  const minValue = Math.min(0, ...allValues);
  const maxValue = Math.max(1, ...allValues);
  const valueRange = maxValue - minValue || 1;
  const width = 820;
  const height = 340;
  const paddingX = 66;
  const paddingY = 34;
  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2;
  const pointCount = Math.max(normalizedValues.length - 1, 1);
  const xFor = (index: number) => paddingX + (index / pointCount) * chartWidth;
  const yFor = (value: number) => paddingY + ((maxValue - value) / valueRange) * chartHeight;
  const zeroY = yFor(0);
  const path = normalizedValues
    .map((value, index) => `${index === 0 ? "M" : "L"} ${xFor(index)} ${yFor(value)}`)
    .join(" ");
  const yTicks = 4;
  const yStep = valueRange / yTicks;
  const yTickValues = Array.from({ length: yTicks + 1 }, (_, index) => minValue + yStep * index);
  const xTickCount = Math.min(4, labels.length - 1);
  const xTickIndexes = xTickCount > 0 ? Array.from({ length: xTickCount + 1 }, (_, i) => Math.round((i / xTickCount) * (labels.length - 1))) : [0];

  return (
    <div className="chart-line-wrap">
      <svg className="chart-line-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Net worth growth chart">
        {yTickValues.map((tickValue, index) => (
          <g key={`tick-${index}`}>
            <line
              className="chart-line-grid"
              x1={paddingX}
              y1={yFor(tickValue)}
              x2={width - paddingX}
              y2={yFor(tickValue)}
            />
            <text className="chart-axis-label" x={paddingX - 8} y={yFor(tickValue) + 4} textAnchor="end">
              {formatCompactPounds(tickValue)}
            </text>
          </g>
        ))}
        {minValue <= 0 && maxValue >= 0 ? (
          <line className="chart-line-zero" x1={paddingX} y1={zeroY} x2={width - paddingX} y2={zeroY} />
        ) : null}
        <path className="chart-line-path" d={path} stroke="#0f8a5b" />
        {xTickIndexes.map((index) => (
          <text
            className="chart-axis-label"
            key={`x-${index}`}
            x={xFor(index)}
            y={height - 6}
            textAnchor="middle"
          >
            {labels[index]}
          </text>
        ))}
        <text className="chart-axis-title" x={width / 2} y={height - 18} textAnchor="middle">
          Months ahead
        </text>
        <text
          className="chart-axis-title"
          x={12}
          y={height / 2}
          textAnchor="middle"
          transform={`rotate(-90 12 ${height / 2})`}
        >
          Net worth
        </text>
      </svg>

      <div className="chart-line-foot">
        <span>{labels[0]}: {formatPounds(normalizedValues[0] ?? 0)}</span>
        <span>{labels[labels.length - 1]}: {formatPounds(normalizedValues[normalizedValues.length - 1] ?? 0)}</span>
      </div>
    </div>
  );
}

type SavingsBucketCardProps = {
  title: string;
  tab: SavingsSectionTab;
  bucket: SavingsBucket;
  rowPrefix: string;
  onTitleChange: (nextTitle: string) => void;
  onRemove: () => void;
  onChange: (next: SavingsBucket) => void;
};

function SavingsBucketCard({ title, tab, bucket, rowPrefix, onTitleChange, onRemove, onChange }: SavingsBucketCardProps) {
  const summary = useMemo(() => calculateSavingsSummary(bucket), [bucket]);
  const [regularSearch, setRegularSearch] = useState("");
  const [additionalSearch, setAdditionalSearch] = useState("");
  const [withdrawalSearch, setWithdrawalSearch] = useState("");
  const [marketChangeSearch, setMarketChangeSearch] = useState("");

  const normalizedRegularSearch = regularSearch.trim().toLowerCase();
  const filteredRegularDeposits = normalizedRegularSearch
    ? bucket.regularDeposits.filter((row) =>
        `${row.date} ${row.amount} ${row.target}`.toLowerCase().includes(normalizedRegularSearch)
      )
    : bucket.regularDeposits;

  const normalizedAdditionalSearch = additionalSearch.trim().toLowerCase();
  const filteredAdditionalDeposits = normalizedAdditionalSearch
    ? bucket.additionalDeposits.filter((row) =>
        `${row.date} ${row.amount} ${row.note}`.toLowerCase().includes(normalizedAdditionalSearch)
      )
    : bucket.additionalDeposits;

  const normalizedWithdrawalSearch = withdrawalSearch.trim().toLowerCase();
  const filteredWithdrawals = normalizedWithdrawalSearch
    ? bucket.withdrawals.filter((row) =>
        `${row.date} ${row.amount} ${row.reason}`.toLowerCase().includes(normalizedWithdrawalSearch)
      )
    : bucket.withdrawals;

  const normalizedMarketChangeSearch = marketChangeSearch.trim().toLowerCase();
  const filteredMarketChanges = normalizedMarketChangeSearch
    ? summary.normalizedMarketChanges.filter((row) =>
        `${row.date} ${row.currentValue ?? 0} ${row.amount} ${row.note}`
          .toLowerCase()
          .includes(normalizedMarketChangeSearch)
      )
    : summary.normalizedMarketChanges;

  const updateRegularRow = (id: string, patch: Partial<RegularDepositRow>) => {
    onChange({
      ...bucket,
      regularDeposits: bucket.regularDeposits.map((row) => (row.id === id ? { ...row, ...patch } : row))
    });
  };

  const updateAdditionalRow = (id: string, patch: Partial<AdditionalDepositRow>) => {
    onChange({
      ...bucket,
      additionalDeposits: bucket.additionalDeposits.map((row) =>
        row.id === id ? { ...row, ...patch } : row
      )
    });
  };

  const updateWithdrawalRow = (id: string, patch: Partial<WithdrawalRow>) => {
    onChange({
      ...bucket,
      withdrawals: bucket.withdrawals.map((row) => (row.id === id ? { ...row, ...patch } : row))
    });
  };

  const updateMarketChangeRow = (id: string, patch: Partial<MarketChangeRow>) => {
    const nextRows = bucket.marketChanges.map((row) => (row.id === id ? { ...row, ...patch } : row));
    onChange({
      ...bucket,
      marketChanges: normalizeSavingsMarketChanges(nextRows, summary.baseValue)
    });
  };

  return (
    <div className="bucket-card">
      <div className="bucket-title-row">
        <label className="bucket-title-field">
          Section name
          <input
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            placeholder={tab === "savings" ? "Example: Emergency savings" : "Example: ISA tracker"}
          />
        </label>
        <button className="small-button danger" onClick={onRemove} type="button">
          Remove section
        </button>
      </div>

      <div className="two-column">
        <label>
          Account location
          <input
            value={bucket.location}
            onChange={(event) => onChange({ ...bucket, location: event.target.value })}
            placeholder="Example: Gatehouse bank account"
          />
        </label>
        <label>
          Cash stash to subtract (£)
          <input
            type="number"
            step="0.01"
            value={bucket.cashStash}
            onChange={(event) => onChange({ ...bucket, cashStash: toNumber(event.target.value) })}
          />
        </label>
      </div>

      <div className="table-block">
        <h4>Regular deposits</h4>
        <label className="table-search">
          <input
            value={regularSearch}
            onChange={(event) => setRegularSearch(event.target.value)}
            placeholder="Search by date, amount or target"
          />
        </label>
        <div className="row row-regular row-head">
          <span>Date</span>
          <span>Amount (£)</span>
          <span>Target (£)</span>
          <span />
        </div>
        <div className="table-scroll">
          {filteredRegularDeposits.length > 0 ? (
            filteredRegularDeposits.map((row) => (
              <div className="row row-regular" key={row.id}>
                <DateInputCell value={row.date} onChange={(value) => updateRegularRow(row.id, { date: value })} />
                <input
                  type="number"
                  step="0.01"
                  value={row.amount}
                  onChange={(event) => updateRegularRow(row.id, { amount: toNumber(event.target.value) })}
                />
                <input
                  type="number"
                  step="0.01"
                  value={row.target}
                  onChange={(event) => updateRegularRow(row.id, { target: toNumber(event.target.value) })}
                />
                <button
                  className="small-button danger"
                  onClick={() =>
                    onChange({
                      ...bucket,
                      regularDeposits: bucket.regularDeposits.filter((current) => current.id !== row.id)
                    })
                  }
                  type="button"
                >
                  Delete
                </button>
              </div>
            ))
          ) : (
            <p className="formula">No regular deposits match your search.</p>
          )}
        </div>
        <p className="formula">
          Showing {filteredRegularDeposits.length} of {bucket.regularDeposits.length}
        </p>
        <button
          className="small-button"
          onClick={() => {
            setRegularSearch("");
            onChange({
              ...bucket,
              regularDeposits: [
                ...bucket.regularDeposits,
                { id: makeId(`${rowPrefix}-regular`), date: "", amount: 0, target: 0 }
              ]
            });
          }}
          type="button"
        >
          + Add regular deposit
        </button>
      </div>

      <div className="table-block">
        <h4>Additional deposits</h4>
        <label className="table-search">
          <input
            value={additionalSearch}
            onChange={(event) => setAdditionalSearch(event.target.value)}
            placeholder="Search by date, amount or note"
          />
        </label>
        <div className="row row-additional row-head">
          <span>Date</span>
          <span>Amount (£)</span>
          <span>Source / note</span>
          <span />
        </div>
        <div className="table-scroll">
          {filteredAdditionalDeposits.length > 0 ? (
            filteredAdditionalDeposits.map((row) => (
              <div className="row row-additional" key={row.id}>
                <DateInputCell value={row.date} onChange={(value) => updateAdditionalRow(row.id, { date: value })} />
                <input
                  type="number"
                  step="0.01"
                  value={row.amount}
                  onChange={(event) => updateAdditionalRow(row.id, { amount: toNumber(event.target.value) })}
                />
                <input
                  value={row.note}
                  onChange={(event) => updateAdditionalRow(row.id, { note: event.target.value })}
                  placeholder="Where did this money come from?"
                />
                <button
                  className="small-button danger"
                  onClick={() =>
                    onChange({
                      ...bucket,
                      additionalDeposits: bucket.additionalDeposits.filter((current) => current.id !== row.id)
                    })
                  }
                  type="button"
                >
                  Delete
                </button>
              </div>
            ))
          ) : (
            <p className="formula">No additional deposits match your search.</p>
          )}
        </div>
        <p className="formula">
          Showing {filteredAdditionalDeposits.length} of {bucket.additionalDeposits.length}
        </p>
        <button
          className="small-button"
          onClick={() => {
            setAdditionalSearch("");
            onChange({
              ...bucket,
              additionalDeposits: [
                ...bucket.additionalDeposits,
                { id: makeId(`${rowPrefix}-extra`), date: "", amount: 0, note: "" }
              ]
            });
          }}
          type="button"
        >
          + Add additional deposit
        </button>
      </div>

      <div className="table-block">
        <h4>Withdrawals</h4>
        <label className="table-search">
          <input
            value={withdrawalSearch}
            onChange={(event) => setWithdrawalSearch(event.target.value)}
            placeholder="Search by date, amount or reason"
          />
        </label>
        <div className="row row-withdraw row-head">
          <span>Date</span>
          <span>Amount (£)</span>
          <span>Reason</span>
          <span />
        </div>
        <div className="table-scroll">
          {filteredWithdrawals.length > 0 ? (
            filteredWithdrawals.map((row) => (
              <div className="row row-withdraw" key={row.id}>
                <DateInputCell value={row.date} onChange={(value) => updateWithdrawalRow(row.id, { date: value })} />
                <input
                  type="number"
                  step="0.01"
                  value={row.amount}
                  onChange={(event) => updateWithdrawalRow(row.id, { amount: toNumber(event.target.value) })}
                />
                <input
                  value={row.reason}
                  onChange={(event) => updateWithdrawalRow(row.id, { reason: event.target.value })}
                  placeholder="Why was this withdrawal made?"
                />
                <button
                  className="small-button danger"
                  onClick={() =>
                    onChange({
                      ...bucket,
                      withdrawals: bucket.withdrawals.filter((current) => current.id !== row.id)
                    })
                  }
                  type="button"
                >
                  Delete
                </button>
              </div>
            ))
          ) : (
            <p className="formula">No withdrawals match your search.</p>
          )}
        </div>
        <p className="formula">
          Showing {filteredWithdrawals.length} of {bucket.withdrawals.length}
        </p>
        <button
          className="small-button"
          onClick={() => {
            setWithdrawalSearch("");
            onChange({
              ...bucket,
              withdrawals: [...bucket.withdrawals, { id: makeId(`${rowPrefix}-withdraw`), date: "", amount: 0, reason: "" }]
            });
          }}
          type="button"
        >
          + Add withdrawal
        </button>
      </div>

      <div className="table-block">
        <h4>Growth / decline</h4>
        <label className="table-search">
          <input
            value={marketChangeSearch}
            onChange={(event) => setMarketChangeSearch(event.target.value)}
            placeholder="Search by date, current value or note"
          />
        </label>
        <div className="row row-additional row-head">
          <span>Date</span>
          <span>Current value (£)</span>
          <span>Note</span>
          <span />
        </div>
        <div className="table-scroll">
          {filteredMarketChanges.length > 0 ? (
            filteredMarketChanges.map((row) => (
              <div className="row row-additional" key={row.id}>
                <DateInputCell value={row.date} onChange={(value) => updateMarketChangeRow(row.id, { date: value })} />
                <input
                  type="number"
                  step="0.01"
                  value={row.currentValue ?? 0}
                  onChange={(event) => updateMarketChangeRow(row.id, { currentValue: toNumber(event.target.value) })}
                />
                <input
                  value={row.note}
                  onChange={(event) => updateMarketChangeRow(row.id, { note: event.target.value })}
                  placeholder="What changed in the market?"
                />
                <button
                  className="small-button danger"
                  onClick={() =>
                    onChange({
                      ...bucket,
                      marketChanges: bucket.marketChanges.filter((current) => current.id !== row.id)
                    })
                  }
                  type="button"
                >
                  Delete
                </button>
              </div>
            ))
          ) : (
            <p className="formula">No growth/decline rows match your search.</p>
          )}
        </div>
        <p className="formula">
          Showing {filteredMarketChanges.length} of {summary.normalizedMarketChanges.length}
        </p>
        <button
          className="small-button"
          onClick={() => {
            setMarketChangeSearch("");
            const nextRows = [
              ...bucket.marketChanges,
              { id: makeId(`${rowPrefix}-market`), date: "", amount: 0, currentValue: summary.finalTotal, note: "" }
            ];
            onChange({
              ...bucket,
              marketChanges: normalizeSavingsMarketChanges(nextRows, summary.baseValue)
            });
          }}
          type="button"
        >
          + Add growth/decline row
        </button>
      </div>

      <div className="summary-grid compact">
        <div className="summary-item">
          <p>Regular deposits total</p>
          <h4>{formatPounds(summary.regularTotal)}</h4>
        </div>
        <div className="summary-item">
          <p>Regular deposits target total</p>
          <h4>{formatPounds(summary.regularTargetTotal)}</h4>
        </div>
        <div className="summary-item">
          <p>Additional deposits</p>
          <h4>{formatPounds(summary.additionalTotal)}</h4>
        </div>
        <div className="summary-item">
          <p>Withdrawals</p>
          <h4>{formatPounds(summary.withdrawalTotal)}</h4>
        </div>
        <div className={`summary-item ${summary.marketChangeTotal >= 0 ? "positive" : "negative"}`}>
          <p>Growth/decline total</p>
          <h4>{formatPounds(summary.marketChangeTotal)} ({formatSignedPercent(summary.marketChangeRatio)})</h4>
        </div>
        <div className="summary-item focus">
          <p>Final total</p>
          <h4>{formatPounds(summary.finalTotal)}</h4>
          <small>= (Regular + Additional) - Withdrawals - Cash stash + Growth/decline</small>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [state, setState] = useState<AppState>(() => normalizeStateDates(buildInitialState()));
  const [budgetAudit, setBudgetAudit] = useState<BudgetAuditEntry[]>([]);
  const [budgetAuditSearch, setBudgetAuditSearch] = useState("");
  const [hasLoaded, setHasLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  const [investmentMarketSearch, setInvestmentMarketSearch] = useState("");
  const [investmentMarketHoldingFilter, setInvestmentMarketHoldingFilter] = useState("all");
  const [, setHistoryVersion] = useState(0);
  const budgetEditStartValues = useRef<Record<string, string>>({});
  const undoStack = useRef<AppState[]>([]);
  const redoStack = useRef<AppState[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AppState;
        setState(normalizeStateDates(parsed));
      }

      const rawAudit = localStorage.getItem(BUDGET_AUDIT_STORAGE_KEY);
      if (rawAudit) {
        const parsedAudit = JSON.parse(rawAudit) as BudgetAuditEntry[];
        if (Array.isArray(parsedAudit)) {
          setBudgetAudit(parsedAudit);
        }
      }
    } catch {
      // Ignore invalid local data and continue with defaults.
    } finally {
      setHasLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!hasLoaded) {
      return;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, hasLoaded]);

  useEffect(() => {
    if (!hasLoaded) {
      return;
    }

    localStorage.setItem(BUDGET_AUDIT_STORAGE_KEY, JSON.stringify(budgetAudit));
  }, [budgetAudit, hasLoaded]);

  const formatAuditValue = (value: string | number | undefined) => {
    if (value === undefined) {
      return "(blank)";
    }

    if (typeof value === "number") {
      return formatPounds(value);
    }

    const trimmed = value.trim();
    return trimmed ? trimmed : "(blank)";
  };

  const recordBudgetAudit = ({
    section,
    item,
    field,
    action,
    before,
    after
  }: {
    section: string;
    item: string;
    field: string;
    action: BudgetAuditAction;
    before?: string | number;
    after?: string | number;
  }) => {
    const entry: BudgetAuditEntry = {
      id: makeId("budget-audit"),
      at: new Date().toISOString(),
      section,
      item,
      field,
      action,
      before: formatAuditValue(before),
      after: formatAuditValue(after)
    };

    setBudgetAudit((previous) => [entry, ...previous].slice(0, 400));
  };

  const rememberBudgetEditStart = (key: string, value: string | number) => {
    budgetEditStartValues.current[key] = `${value}`;
  };

  const readBudgetEditStart = (key: string, fallbackValue: string | number) => {
    const storedValue = budgetEditStartValues.current[key];
    delete budgetEditStartValues.current[key];
    return storedValue ?? `${fallbackValue}`;
  };

  const updateAppState = (updater: (previous: AppState) => AppState) => {
    setState((previous) => {
      const next = updater(previous);
      if (areStatesEqual(previous, next)) {
        return previous;
      }

      undoStack.current.push(cloneAppState(previous));
      if (undoStack.current.length > HISTORY_LIMIT) {
        undoStack.current.shift();
      }
      redoStack.current = [];
      setHistoryVersion((value) => value + 1);
      return next;
    });
  };

  const handleUndo = () => {
    const previousSnapshot = undoStack.current.pop();
    if (!previousSnapshot) {
      return;
    }

    setState((current) => {
      redoStack.current.push(cloneAppState(current));
      if (redoStack.current.length > HISTORY_LIMIT) {
        redoStack.current.shift();
      }
      return previousSnapshot;
    });
    setHistoryVersion((value) => value + 1);
  };

  const handleRedo = () => {
    const nextSnapshot = redoStack.current.pop();
    if (!nextSnapshot) {
      return;
    }

    setState((current) => {
      undoStack.current.push(cloneAppState(current));
      if (undoStack.current.length > HISTORY_LIMIT) {
        undoStack.current.shift();
      }
      return nextSnapshot;
    });
    setHistoryVersion((value) => value + 1);
  };

  const formatAuditTimestamp = (isoValue: string) => {
    const date = new Date(isoValue);
    if (Number.isNaN(date.getTime())) {
      return isoValue;
    }

    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(date);
  };

  const auditActionText: Record<BudgetAuditAction, string> = {
    add: "Added",
    update: "Updated",
    delete: "Deleted"
  };

  const normalizedBudgetAuditSearch = budgetAuditSearch.trim().toLowerCase();
  const filteredBudgetAudit = normalizedBudgetAuditSearch
    ? budgetAudit.filter((entry) =>
        `${entry.section} ${entry.item} ${entry.field} ${entry.before} ${entry.after} ${entry.action}`
          .toLowerCase()
          .includes(normalizedBudgetAuditSearch)
      )
    : budgetAudit;
  const canUndo = undoStack.current.length > 0;
  const canRedo = redoStack.current.length > 0;
  const budgetCategoryLabel = (category: MonthlyBudgetItem["category"]) => {
    if (category === "spending") {
      return "Spending";
    }
    if (category === "saving") {
      return "Saving";
    }
    return "Investing";
  };

  const budget = state.budget;

  const totalMonthlyExpenses = sumAmounts(budget.monthlyExpenses);
  const totalYearlyExpenses = sumAmounts(budget.yearlyExpenses);
  const yearlyMonthlyExpenses = yearlyFromMonthly(totalMonthlyExpenses);
  const monthlySpendingBudgetTotal = budget.monthlyBudgetItems
    .filter((item) => item.category === "spending")
    .reduce((total, item) => total + item.monthlyAmount, 0);
  const monthlySavingBudgetTotal = budget.monthlyBudgetItems
    .filter((item) => item.category === "saving")
    .reduce((total, item) => total + item.monthlyAmount, 0);
  const monthlyInvestingBudgetTotal = budget.monthlyBudgetItems
    .filter((item) => item.category === "investing")
    .reduce((total, item) => total + item.monthlyAmount, 0);

  const yearlySpendingBudget = yearlyFromMonthly(monthlySpendingBudgetTotal);
  const totalYearlySaving = yearlyFromMonthly(monthlySavingBudgetTotal);
  const totalYearlyInvesting = yearlyFromMonthly(monthlyInvestingBudgetTotal);
  const totalYearlySavingInvesting = totalYearlySaving + totalYearlyInvesting;

  const totalYearlySpending = yearlyMonthlyExpenses + totalYearlyExpenses + yearlySpendingBudget;
  const totalYearlyExpenditure = totalYearlySpending + totalYearlySavingInvesting;

  const totalMonthlyIncome = budget.incomeStreams.reduce((total, stream) => total + stream.monthlyAmount, 0);
  const totalYearlyIncome = yearlyFromMonthly(totalMonthlyIncome);
  const incomeMinusExpenditure = totalYearlyIncome - totalYearlyExpenditure;
  const monthlySpendingOutflow = totalMonthlyExpenses + totalYearlyExpenses / 12 + monthlySpendingBudgetTotal;
  const monthlySavingInvesting = monthlySavingBudgetTotal + monthlyInvestingBudgetTotal;

  const savingsSections = state.savings.sections.filter((section) => section.tab === "savings");
  const investmentTrackerSections = state.savings.sections.filter((section) => section.tab === "investments");
  const savingsSectionSummaries = savingsSections.map((section) => ({
    section,
    summary: calculateSavingsSummary(section.bucket)
  }));
  const investmentSectionSummaries = investmentTrackerSections.map((section) => ({
    section,
    summary: calculateSavingsSummary(section.bucket)
  }));

  const totalTrackedSavings = savingsSectionSummaries.reduce((total, entry) => total + entry.summary.finalTotal, 0);
  const investmentFundsCashAccount = investmentSectionSummaries.reduce(
    (total, entry) => total + entry.summary.finalTotal,
    0
  );
  const investmentHoldingSummaries = state.investments.holdings.map((holding, index) => {
    const marketRows = state.investments.marketChanges.filter((row) => row.holdingId === holding.id);
    const latestMarketRow = marketRows.length > 0 ? marketRows[marketRows.length - 1] : null;
    const currentValue = latestMarketRow
      ? resolveInvestmentRowCurrentValue(latestMarketRow, state.investments.holdings)
      : holding.amount;
    const marketChangeTotal = currentValue - holding.amount;
    const marketChangeRatio = holding.amount !== 0 ? marketChangeTotal / holding.amount : null;

    return {
      holding,
      nameLabel: holding.name.trim() || `Holding ${index + 1}`,
      marketChangeTotal,
      marketChangeRatio,
      currentValue,
      changeCount: marketRows.length
    };
  });

  const holdingNameById = new Map(investmentHoldingSummaries.map((entry) => [entry.holding.id, entry.nameLabel]));
  const totalAmountInvested = investmentHoldingSummaries.reduce((total, entry) => total + entry.holding.amount, 0);
  const totalInvestmentMarketChange = investmentHoldingSummaries.reduce(
    (total, entry) => total + entry.marketChangeTotal,
    0
  );
  const totalInvestmentGrowthRatio =
    totalAmountInvested !== 0 ? totalInvestmentMarketChange / totalAmountInvested : null;
  const totalCurrentInvestmentsValue = investmentHoldingSummaries.reduce(
    (total, entry) => total + entry.currentValue,
    0
  );
  const unassignedInvestmentRows = state.investments.marketChanges.filter((row) => !row.holdingId).length;

  const filteredInvestmentRowsByHolding =
    investmentMarketHoldingFilter === "all"
      ? state.investments.marketChanges
      : investmentMarketHoldingFilter === "unassigned"
        ? state.investments.marketChanges.filter((row) => !row.holdingId)
        : state.investments.marketChanges.filter((row) => row.holdingId === investmentMarketHoldingFilter);

  const normalizedInvestmentMarketSearch = investmentMarketSearch.trim().toLowerCase();
  const filteredInvestmentMarketChanges = normalizedInvestmentMarketSearch
    ? filteredInvestmentRowsByHolding.filter((row) => {
        const linkedName = row.holdingId ? holdingNameById.get(row.holdingId) ?? "Unassigned" : "Unassigned";
        const currentValue = resolveInvestmentRowCurrentValue(row, state.investments.holdings);
        return `${row.date} ${currentValue} ${row.note} ${linkedName}`
          .toLowerCase()
          .includes(normalizedInvestmentMarketSearch);
      })
    : filteredInvestmentRowsByHolding;

  const totalCashStash = state.savings.sections.reduce((total, section) => total + section.bucket.cashStash, 0);
  const trackedNetWorth =
    totalTrackedSavings + investmentFundsCashAccount + totalCurrentInvestmentsValue + totalCashStash;
  const trackedSavingsBreakdown =
    savingsSectionSummaries.length > 0
      ? savingsSectionSummaries
          .map(({ section, summary }) => {
            const amountSaved = summary.finalTotal - summary.marketChangeTotal;
            return `${section.title.trim() || "Untitled"}: Amount saved: ${formatPounds(amountSaved)} + Growth/decline: ${formatPounds(summary.marketChangeTotal)} (${formatSignedPercent(summary.marketChangeRatio)})`;
          })
          .join(" + ")
      : "No savings sections added";
  const investmentFundsBreakdown =
    investmentSectionSummaries.length > 0
      ? investmentSectionSummaries
          .map(({ section, summary }) => {
            const amountInvested = summary.finalTotal - summary.marketChangeTotal;
            return `${section.title.trim() || "Untitled"}: Amount invested: ${formatPounds(amountInvested)} + Growth/decline: ${formatPounds(summary.marketChangeTotal)} (${formatSignedPercent(summary.marketChangeRatio)})`;
          })
          .join(" + ")
      : "No investment funds sections added";
  const cashStashBreakdown =
    state.savings.sections.length > 0
      ? state.savings.sections
          .map(
            (section) => `${section.title.trim() || "Untitled"} cash stash: ${formatPounds(section.bucket.cashStash)}`
          )
          .join(" + ")
      : "No cash stashes added";
  const netWorthChartData: ChartDatum[] = [
    { label: "Tracked savings", value: totalTrackedSavings, color: "#0f8a5b" },
    { label: "Investment funds cash", value: investmentFundsCashAccount, color: "#2f6fed" },
    { label: "Current investments value", value: totalCurrentInvestmentsValue, color: "#db5a2d" },
    { label: "Cash stashes", value: totalCashStash, color: "#8b5cf6" }
  ];

  const monthlyPlanChartData: ChartDatum[] = [
    { label: "Monthly income", value: totalMonthlyIncome, color: "#0f8a5b" },
    { label: "Monthly expenses", value: totalMonthlyExpenses, color: "#b33a34" },
    { label: "Spending budget", value: monthlySpendingBudgetTotal, color: "#e67e22" },
    { label: "Saving budget", value: monthlySavingBudgetTotal, color: "#2f6fed" },
    { label: "Investing budget", value: monthlyInvestingBudgetTotal, color: "#6b46c1" },
    { label: "Yearly expenses monthly equivalent", value: totalYearlyExpenses / 12, color: "#5a6470" }
  ];

  const savingsSectionsChartData: ChartDatum[] = [
    ...[...savingsSectionSummaries, ...investmentSectionSummaries].map(({ section, summary }, index) => ({
      label: section.title.trim() || `Section ${index + 1}`,
      value: summary.finalTotal
    })),
    { label: "Cash stash total", value: totalCashStash, color: "#4b5563" }
  ];

  const holdingsChartData: ChartDatum[] = investmentHoldingSummaries.map((entry) => ({
    label: entry.nameLabel,
    value: entry.currentValue
  }));

  const savingsGrowthDeclineChartData: ChartDatum[] = [
    ...savingsSectionSummaries.map(({ section, summary }, index) => ({
      label: section.title.trim() || `Savings section ${index + 1}`,
      value: summary.marketChangeTotal,
      ratio: summary.marketChangeRatio,
      color: summary.marketChangeTotal >= 0 ? "#0f8a5b" : "#b33a34"
    })),
    ...investmentSectionSummaries.map(({ section, summary }, index) => ({
      label: section.title.trim() || `Investments funds section ${index + 1}`,
      value: summary.marketChangeTotal,
      ratio: summary.marketChangeRatio,
      color: summary.marketChangeTotal >= 0 ? "#0f8a5b" : "#b33a34"
    }))
  ];

  const investmentsGrowthDeclineChartData: ChartDatum[] = investmentHoldingSummaries.map((entry) => ({
    label: entry.nameLabel,
    value: entry.marketChangeTotal,
    ratio: entry.marketChangeRatio,
    color: entry.marketChangeTotal >= 0 ? "#0f8a5b" : "#b33a34"
  }));

  const spendingVsSavingChartData: ChartDatum[] = [
    { label: "Current spending", value: monthlySpendingOutflow, color: "#b33a34" },
    { label: "Current saving/investing", value: monthlySavingInvesting, color: "#0f8a5b" }
  ];

  const netWorthTrendLabels = ["Now", ...Array.from({ length: 12 }, (_, index) => `M${index + 1}`)];
  const projectedMonthlyNetWorthChange = totalMonthlyIncome - monthlySpendingOutflow;
  const netWorthTrendValues = netWorthTrendLabels.map(
    (_, index) => trackedNetWorth + projectedMonthlyNetWorthChange * index
  );

  const updateSavingsSection = (sectionId: string, updater: (section: SavingsSection) => SavingsSection | null) => {
    updateAppState((previous) => ({
      ...previous,
      savings: {
        sections: previous.savings.sections
          .map((section) => (section.id === sectionId ? updater(section) : section))
          .filter((section): section is SavingsSection => section !== null)
      }
    }));
  };

  const updateInvestmentMarketChangeRow = (id: string, patch: Partial<MarketChangeRow>) => {
    updateAppState((previous) => ({
      ...previous,
      investments: {
        ...previous.investments,
        marketChanges: previous.investments.marketChanges.map((row) =>
          row.id === id ? { ...row, ...patch } : row
        )
      }
    }));
  };

  const addSavingsSection = (tab: SavingsSectionTab) => {
    updateAppState((previous) => ({
      ...previous,
      savings: {
        sections: [
          ...previous.savings.sections,
          {
            id: makeId("savings-section"),
            title: tab === "savings" ? "New savings section" : "New investments tracker",
            tab,
            bucket: createEmptySavingsBucket()
          }
        ]
      }
    }));
  };

  return (
    <main className="page-shell">
      <header className="hero">
        <div className="hero-copy">
          <h1>Finance Tracker</h1>
          <p className="hero-subtitle">Track savings, investments, and budgeting in one place.</p>
        </div>

        <div className="hero-actions">
          <div className="history-actions">
            <button className="small-button secondary" onClick={handleUndo} disabled={!canUndo} type="button">
              Undo
            </button>
            <button className="small-button secondary" onClick={handleRedo} disabled={!canRedo} type="button">
              Redo
            </button>
          </div>
        </div>
      </header>

      <nav className="tab-row" aria-label="App sections">
        <button
          className={`tab-button ${activeTab === "dashboard" ? "active" : ""}`}
          onClick={() => setActiveTab("dashboard")}
          type="button"
        >
          Dashboard
        </button>
        <button
          className={`tab-button ${activeTab === "budget" ? "active" : ""}`}
          onClick={() => setActiveTab("budget")}
          type="button"
        >
          Budgeting
        </button>
        <button
          className={`tab-button ${activeTab === "savings" ? "active" : ""}`}
          onClick={() => setActiveTab("savings")}
          type="button"
        >
          Savings
        </button>
        <button
          className={`tab-button ${activeTab === "investments" ? "active" : ""}`}
          onClick={() => setActiveTab("investments")}
          type="button"
        >
          Investments
        </button>
      </nav>

      {activeTab === "dashboard" ? (
        <section className="section-card">
          <h2>Overview</h2>
	          <div className="summary-grid">
            <div className="summary-item focus net-worth-highlight">
              <p>Tracked net worth</p>
              <h4>{formatPounds(trackedNetWorth)}</h4>
              <small>
                Includes total tracked savings, total cash stashes, current investments value and total investment funds cash
              </small>
            </div>
            <div className="summary-item">
              <p>Total tracked savings</p>
              <h4>{formatPounds(totalTrackedSavings)}</h4>
              <small>{trackedSavingsBreakdown}</small>
            </div>
            <div className="summary-item">
              <p>Total cash stashes</p>
              <h4>{formatPounds(totalCashStash)}</h4>
              <small>{cashStashBreakdown}</small>
            </div>
            <div className="summary-item">
              <p>Current investments value</p>
              <h4>{formatPounds(totalCurrentInvestmentsValue)}</h4>
              <small>
                Amount invested: {formatPounds(totalAmountInvested)} + Growth/decline: {formatPounds(totalInvestmentMarketChange)} ({formatSignedPercent(totalInvestmentGrowthRatio)})
              </small>
            </div>
            <div className="summary-item">
              <p>Total investment funds</p>
              <h4>{formatPounds(investmentFundsCashAccount)}</h4>
              <small>{investmentFundsBreakdown}</small>
            </div>
            <div className="summary-item">
              <p>Total yearly expenditure</p>
              <h4>{formatPounds(totalYearlyExpenditure)}</h4>
            </div>
            <div className="summary-item">
              <p>Total yearly income</p>
              <h4>{formatPounds(totalYearlyIncome)}</h4>
            </div>
	            <div className={`summary-item ${incomeMinusExpenditure >= 0 ? "positive" : "negative"}`}>
	              <p>Income - expenditure (to be kept slightly above £0)</p>
	              <h4>{formatPounds(incomeMinusExpenditure)}</h4>
	            </div>
	          </div>

	          <div className="chart-grid">
	            <div className="panel chart-card chart-card-wide">
	              <h3>Net worth composition</h3>
	              <p className="formula">How your tracked net worth is split across savings, investments and cash</p>
	              <DonutChart data={netWorthChartData} emptyMessage="Add data in other tabs to generate this chart." />
	            </div>

	            <div className="panel chart-card chart-card-wide">
	              <h3>Net worth growth</h3>
	              <p className="formula">
	                Projection based on your current net worth and monthly income minus spending (expenses + spending budget)
	              </p>
	              <NetWorthTrendChart
	                labels={netWorthTrendLabels}
	                values={netWorthTrendValues}
	                emptyMessage="Add income and spending values to generate this projection."
	              />
	            </div>

            <div className="panel chart-card">
              <h3>Monthly plan overview</h3>
              <HorizontalBarChart
                data={monthlyPlanChartData}
                emptyMessage="Add budget and income values to generate this chart."
              />
            </div>

            <div className="panel chart-card">
              <h3>Spending vs saving/investing</h3>
              <DonutChart
                data={spendingVsSavingChartData}
                emptyMessage="Add spending or saving values to generate this chart."
              />
            </div>

            <div className="panel chart-card">
              <h3>Savings and investments cash</h3>
              <HorizontalBarChart
                data={savingsSectionsChartData}
                emptyMessage="Add savings or investments sections to generate this chart."
              />
            </div>

            <div className="panel chart-card">
              <h3>Investment holdings</h3>
              <HorizontalBarChart
                data={holdingsChartData}
                emptyMessage="Add holdings in Portfolio to generate this chart."
              />
            </div>

            <div className="panel chart-card chart-card-wide">
              <h3>Savings and investments funds growth/decline</h3>
              <SignedHorizontalBarChart
                data={savingsGrowthDeclineChartData}
                emptyMessage="Add growth/decline rows in Savings or Investments funds to generate this chart."
                yAxisTitle="Growth/decline (£)"
              />
            </div>

            <div className="panel chart-card chart-card-wide">
              <h3>Investments growth/decline</h3>
              <SignedHorizontalBarChart
                data={investmentsGrowthDeclineChartData}
                emptyMessage="Add growth/decline rows in Investments to generate this chart."
                yAxisTitle="Growth/decline (£)"
              />
            </div>
          </div>
	        </section>
	      ) : null}

      {activeTab === "budget" ? (
        <section className="section-card">
          <h2>Budget tracker</h2>

          <div className="two-column">
            <div className="panel">
              <h3>Monthly expenses</h3>
              <div className="row row-amount row-head">
                <span>Expense</span>
                <span>Day (DD)</span>
                <span>Amount (£)</span>
                <span />
              </div>
              {sortByLabel(budget.monthlyExpenses).map((row) => (
                <div className="row row-amount" key={row.id}>
                  <input
                    value={row.label}
                    onFocus={() => rememberBudgetEditStart(`monthly-expense:${row.id}:label`, row.label)}
                    onChange={(event) =>
                      updateAppState((previous) => ({
                        ...previous,
                        budget: {
                          ...previous.budget,
                          monthlyExpenses: previous.budget.monthlyExpenses.map((current) =>
                            current.id === row.id ? { ...current, label: event.target.value } : current
                          )
                        }
                      }))
                    }
                    onBlur={(event) => {
                      const beforeLabel = readBudgetEditStart(`monthly-expense:${row.id}:label`, row.label);
                      const nextLabel = event.target.value;
                      if (beforeLabel === nextLabel) {
                        return;
                      }

                      recordBudgetAudit({
                        section: "Monthly expenses",
                        item: beforeLabel || "Unnamed expense",
                        field: "Name",
                        action: "update",
                        before: beforeLabel,
                        after: nextLabel
                      });
                    }}
                    placeholder="Example: Gym membership"
                  />
                  <DateInputCell
                    value={row.date}
                    mode="day"
                    onFocus={() => rememberBudgetEditStart(`monthly-expense:${row.id}:date`, row.date)}
                    onChange={(value) =>
                      updateAppState((previous) => ({
                        ...previous,
                        budget: {
                          ...previous.budget,
                          monthlyExpenses: previous.budget.monthlyExpenses.map((current) =>
                            current.id === row.id ? { ...current, date: value } : current
                          )
                        }
                      }))
                    }
                    onBlur={(value) => {
                      const beforeDate = readBudgetEditStart(`monthly-expense:${row.id}:date`, row.date);
                      if (beforeDate === value) {
                        return;
                      }

                      recordBudgetAudit({
                        section: "Monthly expenses",
                        item: row.label || "Unnamed expense",
                        field: "Date",
                        action: "update",
                        before: beforeDate,
                        after: value
                      });
                    }}
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={row.amount}
                    onFocus={() => rememberBudgetEditStart(`monthly-expense:${row.id}:amount`, row.amount)}
                    onChange={(event) =>
                      updateAppState((previous) => ({
                        ...previous,
                        budget: {
                          ...previous.budget,
                          monthlyExpenses: previous.budget.monthlyExpenses.map((current) =>
                            current.id === row.id
                              ? { ...current, amount: toNumber(event.target.value) }
                              : current
                          )
                        }
                      }))
                    }
                    onBlur={(event) => {
                      const beforeAmount = toNumber(
                        readBudgetEditStart(`monthly-expense:${row.id}:amount`, row.amount)
                      );
                      const nextAmount = toNumber(event.target.value);
                      if (beforeAmount === nextAmount) {
                        return;
                      }

                      recordBudgetAudit({
                        section: "Monthly expenses",
                        item: row.label || "Unnamed expense",
                        field: "Amount",
                        action: "update",
                        before: beforeAmount,
                        after: nextAmount
                      });
                    }}
                  />
                  <button
                    className="small-button danger"
                    onClick={() => {
                      recordBudgetAudit({
                        section: "Monthly expenses",
                        item: row.label || "Unnamed expense",
                        field: "Row",
                        action: "delete",
                        before: row.amount,
                        after: "Deleted"
                      });

                      updateAppState((previous) => ({
                        ...previous,
                        budget: {
                          ...previous.budget,
                          monthlyExpenses: previous.budget.monthlyExpenses.filter(
                            (current) => current.id !== row.id
                          )
                        }
                      }));
                    }}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              ))}
              <button
                className="small-button"
                onClick={() => {
                  recordBudgetAudit({
                    section: "Monthly expenses",
                    item: "New expense",
                    field: "Row",
                    action: "add",
                    before: "",
                    after: "Created"
                  });

                  updateAppState((previous) => ({
                    ...previous,
                    budget: {
                      ...previous.budget,
                      monthlyExpenses: [
                        ...previous.budget.monthlyExpenses,
                        { id: makeId("monthly-expense"), label: "", date: "", amount: 0 }
                      ]
                    }
                  }));
                }}
                type="button"
              >
                + Add monthly expense
              </button>

              <div className="summary-grid compact">
                <div className="summary-item">
                  <p>Total monthly expenses</p>
                  <h4>{formatPounds(totalMonthlyExpenses)}</h4>
                </div>
                <div className="summary-item">
                  <p>Total for the year (x12)</p>
                  <h4>{formatPounds(yearlyMonthlyExpenses)}</h4>
                </div>
              </div>
            </div>

            <div className="panel">
              <h3>Yearly expenses</h3>
              <div className="row row-amount row-head">
                <span>Expense</span>
                <span>Day/month (DD/MM)</span>
                <span>Amount (£)</span>
                <span />
              </div>
              {sortByLabel(budget.yearlyExpenses).map((row) => (
                <div className="row row-amount" key={row.id}>
                  <input
                    value={row.label}
                    onFocus={() => rememberBudgetEditStart(`yearly-expense:${row.id}:label`, row.label)}
                    onChange={(event) =>
                      updateAppState((previous) => ({
                        ...previous,
                        budget: {
                          ...previous.budget,
                          yearlyExpenses: previous.budget.yearlyExpenses.map((current) =>
                            current.id === row.id ? { ...current, label: event.target.value } : current
                          )
                        }
                      }))
                    }
                    onBlur={(event) => {
                      const beforeLabel = readBudgetEditStart(`yearly-expense:${row.id}:label`, row.label);
                      const nextLabel = event.target.value;
                      if (beforeLabel === nextLabel) {
                        return;
                      }

                      recordBudgetAudit({
                        section: "Yearly expenses",
                        item: beforeLabel || "Unnamed expense",
                        field: "Name",
                        action: "update",
                        before: beforeLabel,
                        after: nextLabel
                      });
                    }}
                    placeholder="Example: Domain renewal"
                  />
                  <DateInputCell
                    value={row.date}
                    mode="dayMonth"
                    onFocus={() => rememberBudgetEditStart(`yearly-expense:${row.id}:date`, row.date)}
                    onChange={(value) =>
                      updateAppState((previous) => ({
                        ...previous,
                        budget: {
                          ...previous.budget,
                          yearlyExpenses: previous.budget.yearlyExpenses.map((current) =>
                            current.id === row.id ? { ...current, date: value } : current
                          )
                        }
                      }))
                    }
                    onBlur={(value) => {
                      const beforeDate = readBudgetEditStart(`yearly-expense:${row.id}:date`, row.date);
                      if (beforeDate === value) {
                        return;
                      }

                      recordBudgetAudit({
                        section: "Yearly expenses",
                        item: row.label || "Unnamed expense",
                        field: "Date",
                        action: "update",
                        before: beforeDate,
                        after: value
                      });
                    }}
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={row.amount}
                    onFocus={() => rememberBudgetEditStart(`yearly-expense:${row.id}:amount`, row.amount)}
                    onChange={(event) =>
                      updateAppState((previous) => ({
                        ...previous,
                        budget: {
                          ...previous.budget,
                          yearlyExpenses: previous.budget.yearlyExpenses.map((current) =>
                            current.id === row.id
                              ? { ...current, amount: toNumber(event.target.value) }
                              : current
                          )
                        }
                      }))
                    }
                    onBlur={(event) => {
                      const beforeAmount = toNumber(
                        readBudgetEditStart(`yearly-expense:${row.id}:amount`, row.amount)
                      );
                      const nextAmount = toNumber(event.target.value);
                      if (beforeAmount === nextAmount) {
                        return;
                      }

                      recordBudgetAudit({
                        section: "Yearly expenses",
                        item: row.label || "Unnamed expense",
                        field: "Amount",
                        action: "update",
                        before: beforeAmount,
                        after: nextAmount
                      });
                    }}
                  />
                  <button
                    className="small-button danger"
                    onClick={() => {
                      recordBudgetAudit({
                        section: "Yearly expenses",
                        item: row.label || "Unnamed expense",
                        field: "Row",
                        action: "delete",
                        before: row.amount,
                        after: "Deleted"
                      });

                      updateAppState((previous) => ({
                        ...previous,
                        budget: {
                          ...previous.budget,
                          yearlyExpenses: previous.budget.yearlyExpenses.filter(
                            (current) => current.id !== row.id
                          )
                        }
                      }));
                    }}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              ))}
              <button
                className="small-button"
                onClick={() => {
                  recordBudgetAudit({
                    section: "Yearly expenses",
                    item: "New expense",
                    field: "Row",
                    action: "add",
                    before: "",
                    after: "Created"
                  });

                  updateAppState((previous) => ({
                    ...previous,
                    budget: {
                      ...previous.budget,
                      yearlyExpenses: [
                        ...previous.budget.yearlyExpenses,
                        { id: makeId("yearly-expense"), label: "", date: "", amount: 0 }
                      ]
                    }
                  }));
                }}
                type="button"
              >
                + Add yearly expense
              </button>

              <div className="summary-grid compact">
                <div className="summary-item">
                  <p>Total yearly expenses</p>
                  <h4>{formatPounds(totalYearlyExpenses)}</h4>
                </div>
              </div>
            </div>
          </div>

          <div className="two-column">
            <div className="panel">
              <h3>Monthly spending, savings and investment budgets</h3>
              <div className="row row-monthly-budget row-head">
                <span>Field name</span>
                <span>Category</span>
                <span>Monthly amount (£)</span>
                <span />
              </div>
              {budget.monthlyBudgetItems.map((item) => (
                <div className="monthly-budget-item" key={item.id}>
                  <div className="row row-monthly-budget">
                    <input
                      value={item.label}
                      onFocus={() => rememberBudgetEditStart(`monthly-budget:${item.id}:label`, item.label)}
                      onChange={(event) =>
                        updateAppState((previous) => ({
                          ...previous,
                          budget: {
                            ...previous.budget,
                            monthlyBudgetItems: previous.budget.monthlyBudgetItems.map((current) =>
                              current.id === item.id ? { ...current, label: event.target.value } : current
                            )
                          }
                        }))
                      }
                      onBlur={(event) => {
                        const beforeLabel = readBudgetEditStart(`monthly-budget:${item.id}:label`, item.label);
                        const nextLabel = event.target.value;
                        if (beforeLabel === nextLabel) {
                          return;
                        }

                        recordBudgetAudit({
                          section: "Monthly budgets",
                          item: beforeLabel || "Unnamed budget field",
                          field: "Name",
                          action: "update",
                          before: beforeLabel,
                          after: nextLabel
                        });
                      }}
                      placeholder="Example: Monthly emergency fund"
                    />
                    <select
                      value={item.category}
                      onFocus={() => rememberBudgetEditStart(`monthly-budget:${item.id}:category`, item.category)}
                      onChange={(event) =>
                        updateAppState((previous) => ({
                          ...previous,
                          budget: {
                            ...previous.budget,
                            monthlyBudgetItems: previous.budget.monthlyBudgetItems.map((current) =>
                              current.id === item.id
                                ? { ...current, category: event.target.value as MonthlyBudgetItem["category"] }
                                : current
                            )
                          }
                        }))
                      }
                      onBlur={(event) => {
                        const beforeCategory = readBudgetEditStart(
                          `monthly-budget:${item.id}:category`,
                          item.category
                        ) as MonthlyBudgetItem["category"];
                        const nextCategory = event.target.value as MonthlyBudgetItem["category"];
                        if (beforeCategory === nextCategory) {
                          return;
                        }

                        recordBudgetAudit({
                          section: "Monthly budgets",
                          item: item.label || "Unnamed budget field",
                          field: "Category",
                          action: "update",
                          before: budgetCategoryLabel(beforeCategory),
                          after: budgetCategoryLabel(nextCategory)
                        });
                      }}
                    >
                      <option value="spending">Spending</option>
                      <option value="saving">Saving</option>
                      <option value="investing">Investing</option>
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      value={item.monthlyAmount}
                      onFocus={() =>
                        rememberBudgetEditStart(`monthly-budget:${item.id}:monthlyAmount`, item.monthlyAmount)
                      }
                      onChange={(event) =>
                        updateAppState((previous) => ({
                          ...previous,
                          budget: {
                            ...previous.budget,
                            monthlyBudgetItems: previous.budget.monthlyBudgetItems.map((current) =>
                              current.id === item.id
                                ? { ...current, monthlyAmount: toNumber(event.target.value) }
                                : current
                            )
                          }
                        }))
                      }
                      onBlur={(event) => {
                        const beforeAmount = toNumber(
                          readBudgetEditStart(`monthly-budget:${item.id}:monthlyAmount`, item.monthlyAmount)
                        );
                        const nextAmount = toNumber(event.target.value);
                        if (beforeAmount === nextAmount) {
                          return;
                        }

                        recordBudgetAudit({
                          section: "Monthly budgets",
                          item: item.label || "Unnamed budget field",
                          field: "Amount",
                          action: "update",
                          before: beforeAmount,
                          after: nextAmount
                        });
                      }}
                    />
                    <button
                      className="small-button danger"
                      onClick={() => {
                        recordBudgetAudit({
                          section: "Monthly budgets",
                          item: item.label || "Unnamed budget field",
                          field: "Row",
                          action: "delete",
                          before: item.monthlyAmount,
                          after: "Deleted"
                        });

                        updateAppState((previous) => ({
                          ...previous,
                          budget: {
                            ...previous.budget,
                            monthlyBudgetItems: previous.budget.monthlyBudgetItems.filter(
                              (current) => current.id !== item.id
                            )
                          }
                        }));
                      }}
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                  <p className="formula monthly-budget-yearly">
                    Yearly amount: {formatPounds(yearlyFromMonthly(item.monthlyAmount))}
                  </p>
                </div>
              ))}
              <button
                className="small-button"
                onClick={() => {
                  recordBudgetAudit({
                    section: "Monthly budgets",
                    item: "New monthly budget field",
                    field: "Row",
                    action: "add",
                    before: "",
                    after: "Created"
                  });

                  updateAppState((previous) => ({
                    ...previous,
                    budget: {
                      ...previous.budget,
                      monthlyBudgetItems: [
                        ...previous.budget.monthlyBudgetItems,
                        {
                          id: makeId("monthly-budget-item"),
                          label: "",
                          category: "saving",
                          monthlyAmount: 0
                        }
                      ]
                    }
                  }));
                }}
                type="button"
              >
                + Add monthly budget field
              </button>
            </div>

            <div className="panel">
              <h3>Income streams</h3>
              <div className="row row-income row-head">
                <span>Income source</span>
                <span>Monthly income (£)</span>
                <span />
              </div>
              {sortByLabel(budget.incomeStreams).map((stream) => (
                <div className="row row-income" key={stream.id}>
                  <input
                    value={stream.label}
                    onFocus={() => rememberBudgetEditStart(`income-stream:${stream.id}:label`, stream.label)}
                    onChange={(event) =>
                      updateAppState((previous) => ({
                        ...previous,
                        budget: {
                          ...previous.budget,
                          incomeStreams: previous.budget.incomeStreams.map((current) =>
                            current.id === stream.id ? { ...current, label: event.target.value } : current
                          )
                        }
                      }))
                    }
                    onBlur={(event) => {
                      const beforeLabel = readBudgetEditStart(`income-stream:${stream.id}:label`, stream.label);
                      const nextLabel = event.target.value;
                      if (beforeLabel === nextLabel) {
                        return;
                      }

                      recordBudgetAudit({
                        section: "Income streams",
                        item: beforeLabel || "Unnamed income source",
                        field: "Name",
                        action: "update",
                        before: beforeLabel,
                        after: nextLabel
                      });
                    }}
                    placeholder="Example: Job"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={stream.monthlyAmount}
                    onFocus={() =>
                      rememberBudgetEditStart(`income-stream:${stream.id}:monthly-amount`, stream.monthlyAmount)
                    }
                    onChange={(event) =>
                      updateAppState((previous) => ({
                        ...previous,
                        budget: {
                          ...previous.budget,
                          incomeStreams: previous.budget.incomeStreams.map((current) =>
                            current.id === stream.id
                              ? { ...current, monthlyAmount: toNumber(event.target.value) }
                              : current
                          )
                        }
                      }))
                    }
                    onBlur={(event) => {
                      const beforeAmount = toNumber(
                        readBudgetEditStart(`income-stream:${stream.id}:monthly-amount`, stream.monthlyAmount)
                      );
                      const nextAmount = toNumber(event.target.value);
                      if (beforeAmount === nextAmount) {
                        return;
                      }

                      recordBudgetAudit({
                        section: "Income streams",
                        item: stream.label || "Unnamed income source",
                        field: "Monthly amount",
                        action: "update",
                        before: beforeAmount,
                        after: nextAmount
                      });
                    }}
                  />
                  <button
                    className="small-button danger"
                    onClick={() => {
                      recordBudgetAudit({
                        section: "Income streams",
                        item: stream.label || "Unnamed income source",
                        field: "Row",
                        action: "delete",
                        before: stream.monthlyAmount,
                        after: "Deleted"
                      });

                      updateAppState((previous) => ({
                        ...previous,
                        budget: {
                          ...previous.budget,
                          incomeStreams: previous.budget.incomeStreams.filter(
                            (current) => current.id !== stream.id
                          )
                        }
                      }));
                    }}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              ))}
              <button
                className="small-button"
                onClick={() => {
                  recordBudgetAudit({
                    section: "Income streams",
                    item: "New income source",
                    field: "Row",
                    action: "add",
                    before: "",
                    after: "Created"
                  });

                  updateAppState((previous) => ({
                    ...previous,
                    budget: {
                      ...previous.budget,
                      incomeStreams: [
                        ...previous.budget.incomeStreams,
                        { id: makeId("income-stream"), label: "", monthlyAmount: 0 }
                      ]
                    }
                  }));
                }}
                type="button"
              >
                + Add income stream
              </button>

              <div className="summary-grid compact">
                <div className="summary-item">
                  <p>Total monthly income</p>
                  <h4>{formatPounds(totalMonthlyIncome)}</h4>
                </div>
                <div className="summary-item">
                  <p>Total yearly income</p>
                  <h4>{formatPounds(totalYearlyIncome)}</h4>
                </div>
              </div>
            </div>
          </div>

          <div className="summary-grid">
            <div className="summary-item">
              <p>Total yearly spending</p>
              <h4>{formatPounds(totalYearlySpending)}</h4>
              <small>= Monthly expenses x 12 + yearly expenses + spending budget fields x 12</small>
            </div>
            <div className="summary-item">
              <p>Total yearly savings</p>
              <h4>{formatPounds(totalYearlySaving)}</h4>
              <small>= Sum of all monthly budget fields marked as saving x 12</small>
            </div>
            <div className="summary-item">
              <p>Total yearly investing</p>
              <h4>{formatPounds(totalYearlyInvesting)}</h4>
              <small>= Sum of all monthly budget fields marked as investing x 12</small>
            </div>
            <div className="summary-item">
              <p>Total yearly expenditure</p>
              <h4>{formatPounds(totalYearlyExpenditure)}</h4>
              <small>
                = Total yearly spending ({formatPounds(totalYearlySpending)}) + Total yearly savings (
                {formatPounds(totalYearlySaving)}) + Total yearly investing ({formatPounds(totalYearlyInvesting)})
              </small>
            </div>
            <div className="summary-item">
              <p>Total yearly income</p>
              <h4>{formatPounds(totalYearlyIncome)}</h4>
            </div>
            <div className={`summary-item ${incomeMinusExpenditure >= 0 ? "positive" : "negative"}`}>
              <p>Income - expenditure (to be kept slightly above £0)</p>
              <h4>{formatPounds(incomeMinusExpenditure)}</h4>
            </div>
          </div>

          <div className="panel audit-panel">
            <div className="audit-header">
              <h3>Budget audit trail</h3>
            </div>

            {budgetAudit.length > 0 ? (
              <>
                <label className="audit-search">
                  Search changes
                  <input
                    value={budgetAuditSearch}
                    onChange={(event) => setBudgetAuditSearch(event.target.value)}
                    placeholder="Search by section, name, amount or action"
                  />
                </label>
                <p className="formula">{filteredBudgetAudit.length} changes shown (newest first)</p>
                {filteredBudgetAudit.length > 0 ? (
                  <div className="audit-list">
                    {filteredBudgetAudit.map((entry) => (
                      <div className="audit-row" key={entry.id}>
                        <p className="audit-meta">
                          {auditActionText[entry.action]} | {entry.section} | {entry.item} | {entry.field}
                        </p>
                        <p className="audit-change">
                          {entry.before} {"->"} {entry.after}
                        </p>
                        <p className="audit-time">{formatAuditTimestamp(entry.at)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="formula">No audit entries match your search.</p>
                )}
              </>
            ) : (
              <p className="formula">No changes yet. Edit any budget value to start the audit trail.</p>
            )}
          </div>
        </section>
      ) : null}

      {activeTab === "savings" ? (
        <>
          <section className="section-card">
            <div className="quick-actions">
              <button className="small-button secondary" onClick={() => addSavingsSection("savings")} type="button">
                + Add savings section
              </button>
            </div>
          </section>

          {savingsSections.map((section) => (
            <section className="section-card" key={section.id}>
              <SavingsBucketCard
                title={section.title}
                tab="savings"
                bucket={section.bucket}
                rowPrefix={section.id}
                onTitleChange={(nextTitle) =>
                  updateSavingsSection(section.id, (current) => ({ ...current, title: nextTitle }))
                }
                onRemove={() => updateSavingsSection(section.id, () => null)}
                onChange={(nextBucket) =>
                  updateSavingsSection(section.id, (current) => ({ ...current, bucket: nextBucket }))
                }
              />
            </section>
          ))}

          {savingsSections.length === 0 ? (
            <section className="section-card">
              <p className="section-help">No savings sections yet. Use + Add savings section to create one.</p>
            </section>
          ) : null}
        </>
      ) : null}

      {activeTab === "investments" ? (
        <>
          <section className="section-card">
            <div className="quick-actions">
              <button
                className="small-button secondary"
                onClick={() => addSavingsSection("investments")}
                type="button"
              >
                + Add investments funds section
              </button>
            </div>
          </section>

          {investmentTrackerSections.map((section) => (
            <section className="section-card" key={section.id}>
              <SavingsBucketCard
                title={section.title}
                tab="investments"
                bucket={section.bucket}
                rowPrefix={section.id}
                onTitleChange={(nextTitle) =>
                  updateSavingsSection(section.id, (current) => ({ ...current, title: nextTitle }))
                }
                onRemove={() => updateSavingsSection(section.id, () => null)}
                onChange={(nextBucket) =>
                  updateSavingsSection(section.id, (current) => ({ ...current, bucket: nextBucket }))
                }
              />
            </section>
          ))}

          {investmentTrackerSections.length === 0 ? (
            <section className="section-card">
              <p className="section-help">
                No investments tracker sections yet. Use + Add investments funds section to create one.
              </p>
            </section>
          ) : null}

          <section className="section-card">
            <h2>Portfolio</h2>

            <div className="two-column">
              <label>
                Start date of investing
                <DateInputCell
                  value={state.investments.startDate}
                  onChange={(value) =>
                    updateAppState((previous) => ({
                      ...previous,
                      investments: {
                        ...previous.investments,
                        startDate: value
                      }
                    }))
                  }
                />
              </label>
              <div className="panel soft portfolio-metrics-panel">
                <div className="portfolio-metrics-grid">
                  <div className="portfolio-metric-card">
                    <p className="formula">Current investments value</p>
                    <h3 className="portfolio-metric-value">
                      <span>{formatPounds(totalCurrentInvestmentsValue)}</span>
                    </h3>
                  </div>

                  <div className="portfolio-metric-card">
                    <p className="formula">Investment growth/decline total</p>
                    <h3 className={`portfolio-metric-value ${totalInvestmentMarketChange >= 0 ? "metric-positive" : "metric-negative"}`}>
                      <span>{formatPounds(totalInvestmentMarketChange)}</span>
                      <small>({formatSignedPercent(totalInvestmentGrowthRatio)})</small>
                    </h3>
                  </div>
                </div>

                <p className="formula portfolio-metric-detail">
                  Amount invested {formatPounds(totalAmountInvested)}
                </p>
                {unassignedInvestmentRows > 0 ? (
                  <p className="formula">Unassigned rows: {unassignedInvestmentRows} (not included until linked)</p>
                ) : null}
              </div>
            </div>

            <div className="panel">
              <div className="row row-holding row-head">
                <span>Investment</span>
                <span>Location</span>
                <span>Amount invested (£)</span>
                <span>Growth/decline (£)</span>
                <span>Current value (£)</span>
                <span />
              </div>

              {investmentHoldingSummaries.map(({ holding, marketChangeTotal, marketChangeRatio, currentValue }) => (
                <div className="row row-holding" key={holding.id}>
                  <input
                    value={holding.name}
                    onChange={(event) =>
                      updateAppState((previous) => ({
                        ...previous,
                        investments: {
                          ...previous.investments,
                          holdings: previous.investments.holdings.map((current) =>
                            current.id === holding.id ? { ...current, name: event.target.value } : current
                          )
                        }
                      }))
                    }
                    placeholder="Investment name"
                  />
                  <input
                    value={holding.location}
                    onChange={(event) =>
                      updateAppState((previous) => ({
                        ...previous,
                        investments: {
                          ...previous.investments,
                          holdings: previous.investments.holdings.map((current) =>
                            current.id === holding.id
                              ? { ...current, location: event.target.value }
                              : current
                          )
                        }
                      }))
                    }
                    placeholder="Platform / URL"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={holding.amount}
                    onChange={(event) =>
                      updateAppState((previous) => ({
                        ...previous,
                        investments: {
                          ...previous.investments,
                          holdings: previous.investments.holdings.map((current) =>
                            current.id === holding.id
                              ? { ...current, amount: toNumber(event.target.value) }
                              : current
                          )
                        }
                      }))
                    }
                  />
                  <div className={`readonly-cell metric-breakdown ${marketChangeTotal >= 0 ? "positive" : "negative"}`}>
                    <span>{formatPounds(marketChangeTotal)}</span>
                    <small>({formatSignedPercent(marketChangeRatio)})</small>
                  </div>
                  <div className="readonly-cell current">{formatPounds(currentValue)}</div>
                  <button
                    className="small-button danger"
                    onClick={() =>
                      updateAppState((previous) => ({
                        ...previous,
                        investments: {
                          ...previous.investments,
                          holdings: previous.investments.holdings.filter(
                            (current) => current.id !== holding.id
                          ),
                          marketChanges: previous.investments.marketChanges.map((change) =>
                            change.holdingId === holding.id ? { ...change, holdingId: "" } : change
                          )
                        }
                      }))
                    }
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              ))}

              <button
                className="small-button"
                onClick={() =>
                  updateAppState((previous) => ({
                    ...previous,
                    investments: {
                      ...previous.investments,
                      holdings: [
                        ...previous.investments.holdings,
                        { id: makeId("holding"), name: "", location: "", amount: 0 }
                      ]
                    }
                  }))
                }
                type="button"
              >
                + Add investment row
              </button>
            </div>

            <div className="panel">
              <h3>Investment growth / decline by investment</h3>

              <div className="two-column">
                <label className="table-search">
                  Search investment changes
                  <input
                    value={investmentMarketSearch}
                    onChange={(event) => setInvestmentMarketSearch(event.target.value)}
                    placeholder="Search by date, investment, current value or note"
                  />
                </label>

                <label className="table-search">
                  Filter by investment
                  <select
                    value={investmentMarketHoldingFilter}
                    onChange={(event) => setInvestmentMarketHoldingFilter(event.target.value)}
                  >
                    <option value="all">All investments</option>
                    <option value="unassigned">Unassigned</option>
                    {state.investments.holdings.map((holding, index) => (
                      <option key={`filter-${holding.id}`} value={holding.id}>
                        {holding.name.trim() || `Holding ${index + 1}`}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="row row-investment-change row-head">
                <span>Date</span>
                <span>Investment</span>
                <span>Current value (£)</span>
                <span>Note</span>
                <span />
              </div>

              <div className="table-scroll">
                {filteredInvestmentMarketChanges.length > 0 ? (
                  filteredInvestmentMarketChanges.map((row) => (
                    <div className="row row-investment-change" key={row.id}>
                      <DateInputCell
                        value={row.date}
                        onChange={(value) => updateInvestmentMarketChangeRow(row.id, { date: value })}
                      />
                      <select
                        value={row.holdingId ?? ""}
                        onChange={(event) => {
                          const nextHoldingId = event.target.value;
                          const currentValue = resolveInvestmentRowCurrentValue(row, state.investments.holdings);
                          updateInvestmentMarketChangeRow(row.id, {
                            holdingId: nextHoldingId,
                            currentValue,
                            amount: deriveInvestmentRowDelta(currentValue, nextHoldingId, state.investments.holdings)
                          });
                        }}
                      >
                        <option value="">Select investment</option>
                        {state.investments.holdings.map((holding, index) => (
                          <option key={`row-${holding.id}`} value={holding.id}>
                            {holding.name.trim() || `Holding ${index + 1}`}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        step="0.01"
                        value={resolveInvestmentRowCurrentValue(row, state.investments.holdings)}
                        onChange={(event) => {
                          const nextCurrentValue = toNumber(event.target.value);
                          updateInvestmentMarketChangeRow(row.id, {
                            currentValue: nextCurrentValue,
                            amount: deriveInvestmentRowDelta(nextCurrentValue, row.holdingId, state.investments.holdings)
                          });
                        }}
                      />
                      <input
                        value={row.note}
                        onChange={(event) => updateInvestmentMarketChangeRow(row.id, { note: event.target.value })}
                        placeholder="What changed in the market?"
                      />
                      <button
                        className="small-button danger"
                        onClick={() =>
                          updateAppState((previous) => ({
                            ...previous,
                            investments: {
                              ...previous.investments,
                              marketChanges: previous.investments.marketChanges.filter((current) => current.id !== row.id)
                            }
                          }))
                        }
                        type="button"
                      >
                        Delete
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="formula">No investment changes match your search/filter.</p>
                )}
              </div>

              <p className="formula">
                Showing {filteredInvestmentMarketChanges.length} of {filteredInvestmentRowsByHolding.length}
              </p>

              <button
                className="small-button"
                onClick={() =>
                  updateAppState((previous) => ({
                    ...previous,
                    investments: {
                      ...previous.investments,
                      marketChanges: [
                        ...previous.investments.marketChanges,
                        {
                          id: makeId("investment-market"),
                          date: "",
                          amount: 0,
                          currentValue: previous.investments.holdings[0]?.amount ?? 0,
                          note: "",
                          holdingId: previous.investments.holdings[0]?.id ?? ""
                        }
                      ]
                    }
                  }))
                }
                type="button"
              >
                + Add investment growth/decline row
              </button>

            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}
