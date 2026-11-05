// Sample payslips published on Indian payroll / HR websites (all figures
// and names are the sites' own illustrative examples). Text is laid out
// the way it arrives from copy-paste or OCR: table cells joined by " | ",
// one row per line. `expected` holds what a correct decode must produce.
export const WEB_SAMPLES = [
  {
    name: 'taggd — corporate two-column slip',
    source: 'https://taggd.in/blogs/salary-slip-format/',
    text: `Employee details | Information
Employer name | Example Pvt Ltd
Employee name / ID | Rakesh Mehta / EMP1042
Designation / Department | Senior Analyst / Finance
Pay period | 1–30 April 2026
Days paid / Loss of pay | 30 / 0
UAN | XXXXXXXX1234
PAN | XXXXX1234X
Bank account | XXXXXXXX5678
Earnings | Amount (₹) | Deductions | Amount (₹)
Basic salary | 37,500 | Employee PF | 4,500
House Rent Allowance (HRA) | 15,000 | Professional tax | 200
Conveyance allowance | 1,600 | TDS | 3,000
Special allowance | 18,900 |  |
Leave Travel Allowance (LTA) | 2,000 |  |
Gross salary | 75,000 | Total deductions | 7,700
 |  | Net salary | 67,300`,
    expected: {
      takeHome: 67300,
      components: {
        'Basic Salary': 37500, 'HRA (House Rent Allowance)': 15000, 'Special Allowance': 18900,
        'LTA (Leave Travel Allowance)': 2000, 'Conveyance Allowance': 1600,
        'Provident Fund (PF)': 4500, 'TDS (Income Tax)': 3000, 'Professional Tax': 200,
      },
    },
  },
  {
    name: 'kredily — filled-in text template',
    source: 'https://kredily.com/hr-templates/salary-slip-format/',
    text: `PAYSLIP FOR THE MONTH OF April, 2026
Employee Name: Asha Rao
Employee ID: KR-2231
Date of Joining: 12/06/2024
PAN: XXXXX1234X
PF UAN: 100987654321
Bank Account: Account ending in 4421
Days Worked: 28 / 30
Leave Without Pay (if any): 2 Days

Earnings
Basic Salary: 25,000
House Rent Allowance (HRA): 10,000
Conveyance Allowance: 1,600
Special Allowance: 12,150
Other Allowances: 1,250
Gross Earnings: 50,000

Deductions
Provident Fund (PF): 3,000
Employee State Insurance (ESI, if applicable): 375
Professional Tax: 200
Tax Deducted at Source (TDS): 2,500
Other Deductions: 0
Total Deductions: 6,075

Net Pay: 43,925 (Rupees Forty-Three Thousand Nine Hundred Twenty-Five only)`,
    expected: {
      takeHome: 43925,
      components: {
        'Basic Salary': 25000, 'HRA (House Rent Allowance)': 10000, 'Special Allowance': 12150,
        'Conveyance Allowance': 1600, 'Other Allowance': 1250,
        'Provident Fund (PF)': 3000, 'TDS (Income Tax)': 2500, 'ESI': 375, 'Professional Tax': 200,
        'Other Deductions': 0,
      },
    },
  },
  {
    name: 'hirist — IT company slip with header block',
    source: 'https://www.hirist.tech/blog/monthly-salary-slip-format-and-samples-for-employees-and-employers/',
    text: `Tech Innovators Pvt. Ltd.
Salary Slip for the Month of June 2026
Employee Details |
Name: | Priya Singh
Employee ID: | 67890
Department: | Software Development
Designation: | Software Engineer
UAN: | UAN123456
PF No: | PF78910
Bank Details: | HDFC Bank, A/C No: 1234567890
DOJ: | 01.01.2023
Earnings |
Basic Salary | ₹50,000
House Rent Allowance (HRA) | ₹20,000
Dearness Allowance (DA) | ₹15,000
Conveyance | ₹3,000
Medical Allowance | ₹2,500
Special Allowance | ₹5,000
Other Allowances | ₹4,000
Total Earnings | ₹99,500
Deductions |
Employee Provident Fund (EPF) | ₹6,000
Professional Tax | ₹250
Tax Deducted at Source (TDS) | ₹8,500
Other Deductions | ₹1,750
Total Deductions | ₹16,500
Date: | 30th June 2026`,
    expected: {
      takeHome: 83000,
      components: {
        'Basic Salary': 50000, 'DA (Dearness Allowance)': 15000, 'HRA (House Rent Allowance)': 20000,
        'Special Allowance': 5000, 'Conveyance Allowance': 3000, 'Medical Allowance': 2500, 'Other Allowance': 4000,
        'Provident Fund (PF)': 6000, 'TDS (Income Tax)': 8500, 'Professional Tax': 250,
        'Other Deductions': 1750,
      },
    },
  },
  {
    name: 'hirist — monthly + annual columns',
    source: 'https://www.hirist.tech/blog/monthly-salary-slip-format-and-samples-for-employees-and-employers/',
    text: `Compensation & Benefits | Monthly (₹) | Annually (₹)
Earnings | 1,10,850 | 13,30,200
Basic | 50,000 | 6,00,000
Dearness Allowance (DA) | 2,000 | 24,000
Bonus | 8,500 | 1,02,000
House Rent Allowance (HRA) | 20,000 | 2,40,000
Conveyance | 1,200 | 14,400
Special Allowance | 18,150 | 2,17,800
Medical Allowance | 1,000 | 12,000
Variable Pay | 16,500 | 1,98,000
Gross Salary | 1,27,350 | 15,28,200
Deductions | Monthly (₹) | Annually (₹)
Employer Share of PF | 6,000 | 72,000
TDS | 9,000 | 1,08,000
Net Salary | 1,12,350 | 13,48,200`,
    expected: {
      takeHome: 112350,
      components: {
        'Basic Salary': 50000, 'DA (Dearness Allowance)': 2000, 'HRA (House Rent Allowance)': 20000,
        'Special Allowance': 18150, 'Conveyance Allowance': 1200, 'Medical Allowance': 1000, 'Bonus / Incentive': 8500,
        'Variable Pay': 16500, 'TDS (Income Tax)': 9000,
      },
      // The yearly column shows the bonus every month, so it is regular pay here, not one-off
      annual: { 'Basic Salary': 600000, 'TDS (Income Tax)': 108000, 'Bonus / Incentive': 102000 },
    },
  },
  {
    name: 'sum.money — central govt slip, label and amount on separate lines',
    source: 'https://sum.money/in/central-govt-salary-slip-calculator/',
    text: `BASIC PAY
₹56,100
DEARNESS ALLOWANCE (60%)
₹33,660
HOUSE RENT ALLOWANCE (30% OF BASIC)
₹16,830
TRANSPORT ALLOWANCE (₹7,200 + 60% DA)
₹11,520
GROSS EARNINGS
₹1,18,110
DEDUCTIONS
NPS (10% OF BASIC+DA)
- ₹8,976
CGHS CONTRIBUTION
- ₹450
CGEGIS
- ₹60
PROFESSIONAL TAX
- ₹200
TOTAL DEDUCTIONS
₹9,686
NET PAY
NET MONTHLY PAY (IN-HAND)
₹1,08,424
NET ANNUAL PAY
₹13.01 L`,
    expected: {
      takeHome: 108424,
      components: {
        'Basic Salary': 56100, 'DA (Dearness Allowance)': 33660, 'HRA (House Rent Allowance)': 16830,
        'Transport Allowance': 11520,
        'NPS (National Pension Scheme)': 8976, 'Professional Tax': 200,
        'CGHS Contribution': 450, 'Insurance Premium': 60,
      },
    },
  },
  {
    name: 'indianpaycalculator — central govt slip with explanatory sub-labels',
    source: 'https://www.indianpaycalculator.in/articles/how-to-read-government-payslip',
    text: `Basic Pay
Level 8 — 7th CPC pay matrix | ₹47,600
Dearness Allowance (63%)
63% of Basic Pay — effective July 2026 | ₹29,988
House Rent Allowance (20% — Y-class)
20% of Basic — Y-class city | ₹9,520
Transport Allowance
Fixed rate — other city | ₹1,800
DA on Transport Allowance
63% of TA base rate | ₹1,134
Gross Earnings | ₹90,042
NPS — Employee Contribution
10% of (Basic + DA) — Tier-1 mandatory | ₹7,759
Income Tax (TDS) — Est.
New regime, ₹75K std deduction | ₹0
CGHS Subscription
Slab rate for Level 8 | ₹650
CGEGIS Premium
Group Insurance, Group B | ₹60
Total Deductions | ₹8,469`,
    expected: {
      takeHome: 81573,
      components: {
        'Basic Salary': 47600, 'DA (Dearness Allowance)': 29988, 'HRA (House Rent Allowance)': 9520,
        'Transport Allowance': 1800, 'DA on Transport Allowance': 1134,
        'NPS (National Pension Scheme)': 7759, 'TDS (Income Tax)': 0,
        'CGHS Contribution': 650, 'Insurance Premium': 60,
      },
    },
  },
]
