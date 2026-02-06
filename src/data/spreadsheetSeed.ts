export type SeedAmountRow = {
  label: string;
  amount: number;
};

export type SeedIncomeRow = {
  label: string;
  monthlyAmount: number;
};

export type SeedRegularDepositRow = {
  date: string;
  amount: number;
  target: number;
};

export type SeedAdditionalDepositRow = {
  date: string;
  amount: number;
  note: string;
};

export type SeedWithdrawalRow = {
  date: string;
  amount: number;
  reason: string;
};

export type SeedSavingsBucket = {
  location: string;
  cashStash: number;
  regularDeposits: SeedRegularDepositRow[];
  additionalDeposits: SeedAdditionalDepositRow[];
  withdrawals: SeedWithdrawalRow[];
};

export type SpreadsheetSeed = {
  budget: {
    monthlyExpenses: SeedAmountRow[];
    yearlyExpenses: SeedAmountRow[];
    monthlySpendingBudget: number;
    monthlyPrimarySavings: number;
    monthlySecondarySavings: number;
    monthlyInvestmentBudget: number;
    monthlyPensionContribution: number;
    incomeStreams: SeedIncomeRow[];
  };
  savings: {
    primary: SeedSavingsBucket;
    secondary: SeedSavingsBucket;
    investmentFund: SeedSavingsBucket;
  };
  investments: {
    startDate: string;
    holdings: Array<{
      name: string;
      location: string;
      amount: number;
    }>;
  };
};

export const spreadsheetSeed: SpreadsheetSeed = {
  "budget": {
    "monthlyExpenses": [
      {
        "label": "Apple cloud storage",
        "amount": 4.97
      },
      {
        "label": "Battersea Dogs and Cats donation",
        "amount": 10.0
      },
      {
        "label": "Cancer Research UK donation",
        "amount": 10.0
      },
      {
        "label": "Catfood",
        "amount": 63.75
      },
      {
        "label": "Chat GPT subscription",
        "amount": 18.88
      },
      {
        "label": "Codeox Agency emails",
        "amount": 16.8
      },
      {
        "label": "Google cloud storage",
        "amount": 2.49
      },
      {
        "label": "Gym membership",
        "amount": 27.99
      },
      {
        "label": "Islamic Relief donation",
        "amount": 10.0
      },
      {
        "label": "Kickboxing and Jujitsu membership",
        "amount": 120.0
      },
      {
        "label": "Microsoft 365 subscription",
        "amount": 8.49
      },
      {
        "label": "Orphan sponsorship",
        "amount": 59.0
      },
      {
        "label": "Payment to parents",
        "amount": 440.0
      },
      {
        "label": "Pet insurance",
        "amount": 68.2
      },
      {
        "label": "Phone contract",
        "amount": 22.5
      },
      {
        "label": "Ring subscription",
        "amount": 7.99
      },
      {
        "label": "Spotify subscription",
        "amount": 11.99
      }
    ],
    "yearlyExpenses": [
      {
        "label": "Buusuu subscription",
        "amount": 50.0
      },
      {
        "label": "Codeox Agency domain",
        "amount": 12.0
      },
      {
        "label": "Green Party membership",
        "amount": 13.0
      },
      {
        "label": "Ground News subscription",
        "amount": 29.49
      },
      {
        "label": "Jibreel subscription",
        "amount": 59.99
      },
      {
        "label": "Nord VPN subscription",
        "amount": 50.0
      },
      {
        "label": "Pet vaccination",
        "amount": 85.0
      },
      {
        "label": "Tractive subscription",
        "amount": 96.0
      },
      {
        "label": "Woop subscription",
        "amount": 229.0
      }
    ],
    "monthlySpendingBudget": 250.0,
    "monthlyPrimarySavings": 200.0,
    "monthlySecondarySavings": 200.0,
    "monthlyInvestmentBudget": 250.0,
    "monthlyPensionContribution": 150.0,
    "incomeStreams": [
      {
        "label": "Job - Ultramed",
        "monthlyAmount": 2000.0
      }
    ]
  },
  "savings": {
    "primary": {
      "location": "Gatehouse bank account",
      "cashStash": 500.0,
      "regularDeposits": [
        {
          "date": "45505",
          "amount": 300.0,
          "target": 300.0
        },
        {
          "date": "45536",
          "amount": 300.0,
          "target": 300.0
        },
        {
          "date": "45566",
          "amount": 300.0,
          "target": 300.0
        },
        {
          "date": "45597",
          "amount": 300.0,
          "target": 300.0
        },
        {
          "date": "45627",
          "amount": 300.0,
          "target": 300.0
        },
        {
          "date": "45658",
          "amount": 300.0,
          "target": 300.0
        },
        {
          "date": "45689",
          "amount": 300.0,
          "target": 300.0
        },
        {
          "date": "45717",
          "amount": 300.0,
          "target": 300.0
        },
        {
          "date": "45748",
          "amount": 300.0,
          "target": 300.0
        },
        {
          "date": "45778",
          "amount": 300.0,
          "target": 300.0
        },
        {
          "date": "45809",
          "amount": 300.0,
          "target": 300.0
        },
        {
          "date": "45839",
          "amount": 300.0,
          "target": 300.0
        },
        {
          "date": "45870",
          "amount": 300.0,
          "target": 300.0
        },
        {
          "date": "45901",
          "amount": 300.0,
          "target": 300.0
        },
        {
          "date": "45931",
          "amount": 300.0,
          "target": 300.0
        },
        {
          "date": "45962",
          "amount": 300.0,
          "target": 300.0
        },
        {
          "date": "45992",
          "amount": 300.0,
          "target": 300.0
        },
        {
          "date": "46023",
          "amount": 200.0,
          "target": 200.0
        },
        {
          "date": "46054",
          "amount": 200.0,
          "target": 200.0
        }
      ],
      "additionalDeposits": [
        {
          "date": "",
          "amount": 900.0,
          "note": "Built up over time"
        },
        {
          "date": "45471",
          "amount": 300.0,
          "note": "My first sallary at Ultramed"
        },
        {
          "date": "45597",
          "amount": 300.0,
          "note": "Secondary savings"
        },
        {
          "date": "45628",
          "amount": 300.0,
          "note": "Secondary savings"
        },
        {
          "date": "45660",
          "amount": 300.0,
          "note": "Secondary savings"
        },
        {
          "date": "45902",
          "amount": 100.0,
          "note": "Secondary savings"
        }
      ],
      "withdrawals": [
        {
          "date": "45577",
          "amount": 300.0,
          "reason": "To pay towards my hoilday to Japan and to have some money in the UK"
        },
        {
          "date": "45594",
          "amount": 450.0,
          "reason": "To buy a PS5 and stand"
        },
        {
          "date": "45616",
          "amount": 150.0,
          "reason": "To pay for Simba's vet bill - ear infection"
        },
        {
          "date": "45931",
          "amount": 100.0,
          "reason": "To pay back secondary savings as borrowed to bring balance to \u00a35000 to get full 3% profit rate"
        }
      ]
    },
    "secondary": {
      "location": "Santander bank account",
      "cashStash": 0,
      "regularDeposits": [
        {
          "date": "45323",
          "amount": 50.0,
          "target": 50.0
        },
        {
          "date": "45352",
          "amount": 50.0,
          "target": 50.0
        },
        {
          "date": "45383",
          "amount": 50.0,
          "target": 50.0
        },
        {
          "date": "45413",
          "amount": 50.0,
          "target": 50.0
        },
        {
          "date": "45444",
          "amount": 50.0,
          "target": 50.0
        },
        {
          "date": "45474",
          "amount": 50.0,
          "target": 50.0
        },
        {
          "date": "45505",
          "amount": 300.0,
          "target": 300.0
        },
        {
          "date": "45536",
          "amount": 300.0,
          "target": 300.0
        },
        {
          "date": "45566",
          "amount": 300.0,
          "target": 300.0
        },
        {
          "date": "45597",
          "amount": 300.0,
          "target": 300.0
        },
        {
          "date": "45627",
          "amount": 300.0,
          "target": 300.0
        },
        {
          "date": "45658",
          "amount": 300.0,
          "target": 300.0
        },
        {
          "date": "45689",
          "amount": 300.0,
          "target": 300.0
        },
        {
          "date": "45717",
          "amount": 300.0,
          "target": 300.0
        },
        {
          "date": "45748",
          "amount": 300.0,
          "target": 300.0
        },
        {
          "date": "45778",
          "amount": 300.0,
          "target": 300.0
        },
        {
          "date": "45809",
          "amount": 300.0,
          "target": 300.0
        },
        {
          "date": "45839",
          "amount": 300.0,
          "target": 300.0
        },
        {
          "date": "45870",
          "amount": 300.0,
          "target": 300.0
        },
        {
          "date": "45901",
          "amount": 300.0,
          "target": 300.0
        },
        {
          "date": "45931",
          "amount": 300.0,
          "target": 300.0
        },
        {
          "date": "45962",
          "amount": 300.0,
          "target": 300.0
        },
        {
          "date": "45992",
          "amount": 200.0,
          "target": 200.0
        },
        {
          "date": "46023",
          "amount": 200.0,
          "target": 200.0
        },
        {
          "date": "46054",
          "amount": 200.0,
          "target": 200.0
        }
      ],
      "additionalDeposits": [
        {
          "date": "45471",
          "amount": 300.0,
          "note": "My first sallary at Ultramed"
        },
        {
          "date": "45566",
          "amount": 100.0,
          "note": "Kickboxing fee for October"
        },
        {
          "date": "45566",
          "amount": 100.0,
          "note": "Investment funds"
        },
        {
          "date": "45931",
          "amount": 100.0,
          "note": "Primary savings"
        },
        {
          "date": "45992",
          "amount": 100.0,
          "note": "Investment funds"
        },
        {
          "date": "46024",
          "amount": 250.0,
          "note": "Investment funds"
        },
        {
          "date": "46024",
          "amount": 50.0,
          "note": "Main account"
        }
      ],
      "withdrawals": [
        {
          "date": "45534",
          "amount": 500.0,
          "reason": "To book flights and to get travel insurence for my hoilday to Japan"
        },
        {
          "date": "45566",
          "amount": 1500.0,
          "reason": "To pay for hotles, food, transport, activies and souvenirs for my holiday to Japan"
        },
        {
          "date": "45598",
          "amount": 450.0,
          "reason": "To pay back my primary savings for buying a PS5 and stand"
        },
        {
          "date": "45660",
          "amount": 150.0,
          "reason": "To pay back my primary savings for Simba's vet bill"
        },
        {
          "date": "45693",
          "amount": 175.0,
          "reason": "To pay my Zakat for 2025"
        },
        {
          "date": "45800",
          "amount": 150.0,
          "reason": "To pay for kurbani"
        },
        {
          "date": "45827",
          "amount": 950.0,
          "reason": "To pay for a new set of carpets for the stairs"
        },
        {
          "date": "45841",
          "amount": 225.0,
          "reason": "To pay for my monthly and yearly expenses (no income from LSC at this time)"
        },
        {
          "date": "45851",
          "amount": 150.0,
          "reason": "To buy some things I needed for the month"
        },
        {
          "date": "45857",
          "amount": 50.0,
          "reason": "To pay for my monthly and yearly expenses (no income from LSC at this time)"
        },
        {
          "date": "45864",
          "amount": 100.0,
          "reason": "To pay for my monthly and yearly expenses (no income from LSC at this time)"
        },
        {
          "date": "45885",
          "amount": 100.0,
          "reason": "To pay for Simba's yearly checkup and vaccination"
        },
        {
          "date": "45902",
          "amount": 100.0,
          "reason": "To pay primary savings to bring balance to \u00a35000 to get full 3% profit rate at Al Rayan Bank"
        },
        {
          "date": "45912",
          "amount": 100.0,
          "reason": "To pay for water bill"
        },
        {
          "date": "45925",
          "amount": 100.0,
          "reason": "To buy some things I needed for the month"
        },
        {
          "date": "45927",
          "amount": 100.0,
          "reason": "To buy some things I needed for the month"
        },
        {
          "date": "45951",
          "amount": 100.0,
          "reason": "To buy some things I needed for the month"
        },
        {
          "date": "45966",
          "amount": 400.0,
          "reason": "To borrow money to invest on Wahed"
        },
        {
          "date": "45973",
          "amount": 150.0,
          "reason": "To buy a new mattress for the small rented house room"
        },
        {
          "date": "45983",
          "amount": 40.0,
          "reason": "To buy some things I needed for the month"
        },
        {
          "date": "46003",
          "amount": 110.0,
          "reason": "To buy some things I needed for the month"
        },
        {
          "date": "46017",
          "amount": 100.0,
          "reason": "To buy some things I needed for the month"
        },
        {
          "date": "46040",
          "amount": 100.0,
          "reason": "To buy some things I needed for the month"
        },
        {
          "date": "46043",
          "amount": 100.0,
          "reason": "To buy some things I needed for the month"
        },
        {
          "date": "46044",
          "amount": 100.0,
          "reason": "To pay for service charge for the flat"
        }
      ]
    },
    "investmentFund": {
      "location": "Lloyds bank account",
      "cashStash": 0,
      "regularDeposits": [
        {
          "date": "45323",
          "amount": 50.0,
          "target": 50.0
        },
        {
          "date": "45352",
          "amount": 50.0,
          "target": 50.0
        },
        {
          "date": "45383",
          "amount": 50.0,
          "target": 50.0
        },
        {
          "date": "45413",
          "amount": 50.0,
          "target": 50.0
        },
        {
          "date": "45444",
          "amount": 50.0,
          "target": 50.0
        },
        {
          "date": "45474",
          "amount": 50.0,
          "target": 50.0
        },
        {
          "date": "45505",
          "amount": 300.0,
          "target": 100.0
        },
        {
          "date": "45536",
          "amount": 0.0,
          "target": 100.0
        },
        {
          "date": "45566",
          "amount": 0.0,
          "target": 100.0
        },
        {
          "date": "45597",
          "amount": 0.0,
          "target": 100.0
        },
        {
          "date": "45627",
          "amount": 200.0,
          "target": 100.0
        },
        {
          "date": "45658",
          "amount": 200.0,
          "target": 100.0
        },
        {
          "date": "45689",
          "amount": 200.0,
          "target": 100.0
        },
        {
          "date": "45717",
          "amount": 0.0,
          "target": 100.0
        },
        {
          "date": "45748",
          "amount": 0.0,
          "target": 100.0
        },
        {
          "date": "45778",
          "amount": 100.0,
          "target": 100.0
        },
        {
          "date": "45809",
          "amount": 100.0,
          "target": 100.0
        },
        {
          "date": "45839",
          "amount": 100.0,
          "target": 100.0
        },
        {
          "date": "45870",
          "amount": 100.0,
          "target": 100.0
        },
        {
          "date": "45901",
          "amount": 100.0,
          "target": 100.0
        },
        {
          "date": "45931",
          "amount": 100.0,
          "target": 100.0
        },
        {
          "date": "45962",
          "amount": 100.0,
          "target": 100.0
        },
        {
          "date": "45992",
          "amount": 100.0,
          "target": 100.0
        },
        {
          "date": "46023",
          "amount": 250.0,
          "target": 250.0
        },
        {
          "date": "46058",
          "amount": 250.0,
          "target": 250.0
        }
      ],
      "additionalDeposits": [
        {
          "date": "45471",
          "amount": 300.0,
          "note": "My first sallary at Ultramed"
        },
        {
          "date": "46024",
          "amount": 400.0,
          "note": "Secondary savings"
        },
        {
          "date": "46024",
          "amount": 50.0,
          "note": "Extra money from main account"
        },
        {
          "date": "46024",
          "amount": 100.0,
          "note": "Extra money from main account"
        }
      ],
      "withdrawals": [
        {
          "date": "45526",
          "amount": 200.0,
          "reason": "To donate to charity"
        },
        {
          "date": "45566",
          "amount": 100.0,
          "reason": "To pay towards my hoilday to Japan"
        },
        {
          "date": "45659",
          "amount": 200.0,
          "reason": "To invest on Wahed"
        },
        {
          "date": "45664",
          "amount": 600.0,
          "reason": "To invest on Wahed"
        },
        {
          "date": "45669",
          "amount": 200.0,
          "reason": "To invest on Wahed"
        },
        {
          "date": "45691",
          "amount": 200.0,
          "reason": "To invest on Wahed"
        },
        {
          "date": "45831",
          "amount": 100.0,
          "reason": "To invest on Wahed"
        },
        {
          "date": "45835",
          "amount": 100.0,
          "reason": "To invest on Kraken"
        },
        {
          "date": "45840",
          "amount": 100.0,
          "reason": "To invest on Kraken"
        },
        {
          "date": "45870",
          "amount": 100.0,
          "reason": "To invest on Kraken"
        },
        {
          "date": "45901",
          "amount": 100.0,
          "reason": "To invest on  Wahed"
        },
        {
          "date": "45931",
          "amount": 100.0,
          "reason": "To invest on  Wahed"
        },
        {
          "date": "45967",
          "amount": 500.0,
          "reason": "To invest on  Wahed"
        },
        {
          "date": "45992",
          "amount": 100.0,
          "reason": "To pay back secondary savings"
        },
        {
          "date": "46024",
          "amount": 300.0,
          "reason": "To pay back secondary savings"
        },
        {
          "date": "46052",
          "amount": 100.0,
          "reason": "To invest on  Wahed"
        }
      ]
    }
  },
  "investments": {
    "startDate": "45323",
    "holdings": [
      {
        "name": "Vanguard U.S. Equity Index Fund (the \"Fund\")",
        "location": "https://www.vanguardinvestor.co.uk/",
        "amount": 0.0
      },
      {
        "name": "Stocks and Shares, Gold and Properties",
        "location": "Wahed app",
        "amount": 2100.0
      },
      {
        "name": "Bitcoin",
        "location": "Kraken",
        "amount": 300.0
      }
    ]
  }
};
