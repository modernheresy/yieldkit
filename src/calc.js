// ─── Bricklio Shared Calculation Module ──────────────────────────────────────
// Pure functions with no DOM dependencies.
// Imported by both main.js (calculator page) and stress.js (stress test page).

// ─── SDLT (Stamp Duty Land Tax) ──────────────────────────────────────────────
// BTL / additional dwelling rates — current as of 1 April 2025.
// Standard residential bands (0%, 2%, 5%, 10%, 12%) + 5% surcharge on every
// slice. Nil-rate band reverted to £125,000 on 1 April 2025 (was £250,000).
// Effective BTL rates: 5% / 7% / 10% / 15% / 17%.
export function calcSDLT(price) {
  if (!price) return 0
  let sdlt = 0
  if (price <= 125000)       sdlt = price * 0.05
  else if (price <= 250000)  sdlt = 125000*0.05 + (price-125000)*0.07
  else if (price <= 925000)  sdlt = 125000*0.05 + 125000*0.07 + (price-250000)*0.10
  else if (price <= 1500000) sdlt = 125000*0.05 + 125000*0.07 + 675000*0.10 + (price-925000)*0.15
  else                       sdlt = 125000*0.05 + 125000*0.07 + 675000*0.10 + 575000*0.15 + (price-1500000)*0.17
  return sdlt
}

// ─── Core deal calculation (pure) ────────────────────────────────────────────
// Takes raw input params, returns a result object.
// Used by calc() on the main page and stress.js at many rate/rent points.
// `term` = mortgage term in years (default 25). Ignored for interest-only.
export function calcFromInputs({ price, deposit, rate, rent, agent, voidWks, costs, type, addSDLT, term = 25 }) {
  if (!price || !rent) return null

  const sdlt       = calcSDLT(price)
  const depositAmt = price * deposit / 100
  const baseLoan   = price - depositAmt
  const loan       = addSDLT ? baseLoan + sdlt : baseLoan
  const mr         = rate / 100 / 12
  const n          = (term || 25) * 12
  const mtg        = type === 'interest'
    ? loan * mr
    : loan * (mr * Math.pow(1+mr, n)) / (Math.pow(1+mr, n) - 1)

  const agentAmt  = rent * agent / 100
  const voidAmt   = rent * voidWks / 52
  const monthly   = rent - (mtg + agentAmt + voidAmt + costs)
  const annual    = monthly * 12
  const gross     = rent * 12 / price * 100
  const net       = (rent*12 - (agentAmt+voidAmt+costs)*12) / price * 100
  const cashIn    = depositAmt + (addSDLT ? 0 : sdlt)
  const monthlyInterest = loan * mr
  const monthlyCosts    = agentAmt + voidAmt + costs

  return {
    price, deposit, rate, rent, agent, voidWks, costs, type, addSDLT, term,
    sdlt, loan, mtg, monthly, annual, gross, net, cashIn,
    monthlyInterest, monthlyCosts,
  }
}
