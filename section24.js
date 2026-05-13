// ─── Bricklio Section 24 Calculation Engine ──────────────────────────────────
//
// Calculates after-tax cashflow for individual BTL landlords under Section 24
// (Finance Act 2015), which restricts mortgage interest relief to a flat 20%
// tax credit rather than full deduction at the marginal rate.
//
// Included in both index.html and section24.html.
// Depends on nothing — no framework, no imports.
// ─────────────────────────────────────────────────────────────────────────────

const S24 = (() => {

  const PERSONAL_ALLOWANCE = 12570;

  const TAX_RATES = {
    basic:      0.20,
    higher:     0.40,
    additional: 0.45,
  };

  // Band boundaries for range calculations.
  // The DB stores the midpoint; we infer boundaries from it.
  // Shape: { min, max } of other annual income.
  const BAND_BOUNDARIES = {
    25000:  { min: 0,       max: 50000  },   // under £50k
    75000:  { min: 50000,   max: 100000 },   // £50k–£100k
    150000: { min: 100000,  max: 200000 },   // over £100k
  };

  // ─── Core single-point calculation ─────────────────────────────────────────
  //
  // params:
  //   rent              {number}  Monthly rent (£)
  //   monthlyCosts      {number}  Monthly allowable costs excl. mortgage interest
  //                               (agent fee + void allowance + other costs)
  //   monthlyInterest   {number}  Monthly mortgage interest only (loan × rate/12)
  //   preTaxMonthly     {number}  Pre-tax monthly cashflow from main calculator
  //   taxBand           {string}  'basic' | 'higher' | 'additional'
  //   otherAnnualIncome {number}  Other income (salary etc.) per year (£)
  //
  // returns: S24Result object (see shape below)

  function calcSingle({ rent, monthlyCosts, monthlyInterest, preTaxMonthly, taxBand, otherAnnualIncome }) {
    const rate = TAX_RATES[taxBand] || TAX_RATES.basic;

    // ── Annual figures ──────────────────────────────────────────────────────
    const annualRent            = rent * 12;
    const annualAllowableCosts  = monthlyCosts * 12;   // excludes finance costs
    const annualFinanceCosts    = monthlyInterest * 12;

    // Property profit is calculated WITHOUT deducting finance costs (S24 rule).
    // This is also the figure used for gross/net yield — consistent by design.
    const annualPropertyProfit  = annualRent - annualAllowableCosts;

    // ── Three-way cap on creditable finance costs ───────────────────────────
    // The 20% credit applies to the LOWEST of:
    //   1. Total finance costs (mortgage interest)
    //   2. Property business profit (excl. finance costs) — cannot go below 0
    //   3. Adjusted total income above the personal allowance
    //
    // Cap 3 ensures no one claims a credit exceeding their taxable income.
    const adjustedTotalIncome    = otherAnnualIncome + annualPropertyProfit;
    const abovePersonalAllowance = Math.max(0, adjustedTotalIncome - PERSONAL_ALLOWANCE);

    const creditableAmount = Math.max(0, Math.min(
      annualFinanceCosts,
      Math.max(0, annualPropertyProfit),
      abovePersonalAllowance
    ));

    // ── Tax calculation ─────────────────────────────────────────────────────
    // Tax is charged on property profit at the marginal rate (no finance cost
    // deduction under S24), then the 20% credit is subtracted.
    const taxOnProfit  = Math.max(0, annualPropertyProfit) * rate;
    const taxCredit    = creditableAmount * 0.20;
    const annualTax    = Math.max(0, taxOnProfit - taxCredit);
    const monthlyTax   = annualTax / 12;

    // ── After-tax cashflow ──────────────────────────────────────────────────
    const afterTaxMonthly = preTaxMonthly - monthlyTax;
    const afterTaxAnnual  = afterTaxMonthly * 12;

    // ── S24 impact vs hypothetical pre-S24 ─────────────────────────────────
    // Pre-S24: finance costs were fully deductible before applying tax.
    // This shows how much worse off the landlord is under S24.
    const preS24Profit  = Math.max(0, annualPropertyProfit - annualFinanceCosts);
    const preS24Tax     = preS24Profit * rate;
    const s24ExtraTax   = annualTax - preS24Tax;  // additional tax burden from S24

    return {
      isRange:              false,
      taxBand,
      rate,
      isNeutral:            taxBand === 'basic',  // S24 is mathematically neutral for basic rate

      // Inputs (annual)
      annualRent,
      annualAllowableCosts,
      annualFinanceCosts,
      annualPropertyProfit,

      // Tax workings
      adjustedTotalIncome,
      creditableAmount,
      taxOnProfit,
      taxCredit,
      annualTax,
      monthlyTax,

      // Results
      afterTaxMonthly,
      afterTaxAnnual,

      // S24 impact
      preS24Tax,
      s24ExtraTax,          // extra annual tax burden caused by S24
      s24ExtraMonthly: s24ExtraTax / 12,
    };
  }


  // ─── Band range calculation ─────────────────────────────────────────────────
  //
  // When the user selected an income band rather than a precise figure, we
  // calculate at both ends of the band and return a range.
  //
  // Higher other income → larger adjusted total income → less restrictive third
  // cap → potentially larger credit → LESS tax. So the worst case (highest tax,
  // lowest after-tax cashflow) is the LOWER bound of the income band.

  function calcRange({ rent, monthlyCosts, monthlyInterest, preTaxMonthly, taxBand, otherAnnualIncome }) {
    const bounds = BAND_BOUNDARIES[otherAnnualIncome];

    // Fallback to single calc if midpoint not recognised (shouldn't happen)
    if (!bounds) {
      const result = calcSingle({ rent, monthlyCosts, monthlyInterest, preTaxMonthly, taxBand, otherAnnualIncome });
      return { ...result, isRange: false };
    }

    const worstCase = calcSingle({ rent, monthlyCosts, monthlyInterest, preTaxMonthly, taxBand, otherAnnualIncome: bounds.min });
    const bestCase  = calcSingle({ rent, monthlyCosts, monthlyInterest, preTaxMonthly, taxBand, otherAnnualIncome: bounds.max });

    return {
      isRange:              true,
      taxBand,
      rate:                 worstCase.rate,
      isNeutral:            taxBand === 'basic',

      // Worst and best case results for display
      worstCase,
      bestCase,

      // Convenience range values for display
      afterTaxMonthlyLow:   worstCase.afterTaxMonthly,
      afterTaxMonthlyHigh:  bestCase.afterTaxMonthly,
      afterTaxAnnualLow:    worstCase.afterTaxAnnual,
      afterTaxAnnualHigh:   bestCase.afterTaxAnnual,
      annualTaxLow:         bestCase.annualTax,    // best case = lowest tax
      annualTaxHigh:        worstCase.annualTax,   // worst case = highest tax
      s24ExtraTaxLow:       bestCase.s24ExtraTax,
      s24ExtraTaxHigh:      worstCase.s24ExtraTax,
    };
  }


  // ─── Public entry point ─────────────────────────────────────────────────────
  //
  // Accepts a profile object (from DB or the S24 page form) and a calc object
  // (lastCalc from the main calculator, extended with monthlyInterest and
  // monthlyCosts).
  //
  // profile:
  //   tax_band             {string}  'basic' | 'higher' | 'additional'
  //   other_annual_income  {number}  Precise figure or band midpoint
  //   income_is_band       {boolean}
  //   ownership_structure  {string}  'individual' | 'ltd' (ltd returns null — not modelled)
  //
  // calc (from lastCalc, extended):
  //   rent                 {number}
  //   monthlyInterest      {number}  loan × (rate/100/12) — always, regardless of type
  //   monthlyCosts         {number}  agentAmt + voidAmt + costs (excl. mortgage)
  //   monthly              {number}  pre-tax monthly cashflow

  function calculate(profile, calc) {
    if (!profile || !calc) return null;

    // Ltd companies are not subject to S24 — flag but don't model yet
    if (profile.ownership_structure === 'ltd') {
      return { notApplicable: true, reason: 'ltd' };
    }

    const params = {
      rent:               calc.rent,
      monthlyCosts:       calc.monthlyCosts,
      monthlyInterest:    calc.monthlyInterest,
      preTaxMonthly:      calc.monthly,
      taxBand:            profile.tax_band,
      otherAnnualIncome:  profile.other_annual_income ?? 0,
    };

    return profile.income_is_band
      ? calcRange(params)
      : calcSingle(params);
  }


  // ─── Band label helper ──────────────────────────────────────────────────────
  // Maps stored midpoint → human-readable band label for the UI.

  function bandLabel(midpoint) {
    if (midpoint === 25000)  return 'Under £50,000';
    if (midpoint === 75000)  return '£50,000 – £100,000';
    if (midpoint === 150000) return 'Over £100,000';
    return '£' + Math.round(midpoint).toLocaleString('en-GB');
  }

  // ─── Tax band label helper ──────────────────────────────────────────────────

  function taxBandLabel(band) {
    if (band === 'basic')      return 'Basic rate (20%)';
    if (band === 'higher')     return 'Higher rate (40%)';
    if (band === 'additional') return 'Additional rate (45%)';
    return band;
  }


  // ─── Public API ────────────────────────────────────────────────────────────
  return { calculate, calcSingle, calcRange, bandLabel, taxBandLabel, BAND_BOUNDARIES, TAX_RATES };

})();
