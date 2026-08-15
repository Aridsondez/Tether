# Banking & Financial APIs Research for Mobile Expense Tracking App
## Research Date: August 14, 2026

This document provides comprehensive research on financial/banking APIs suitable for a bootstrapped mobile app focused on:
- Connecting to users' bank accounts and fetching transactions
- Tracking spending and categorizing purchases
- Supporting manual expense entry as fallback
- Working with couples/shared accounts

---

## Executive Summary for Indie Developers

**Best Options for Bootstrapped Projects:**

1. **Teller** - Best for US indie developers (100 free live connections)
2. **SimpleFIN Bridge** - Best for personal finance apps ($15/year)
3. **Plaid** - Best when you need comprehensive coverage (200 free API calls, then paid)
4. **Stripe Financial Connections** - Best if already using Stripe ($1.50/verification)
5. **Manual tracking fallback** - Essential for all apps regardless of API choice

**Critical Insight:** All production-ready banking APIs require paid plans for real usage. Plan for API costs from day one or start with manual-only tracking and add bank connections later.

---

## 1. Plaid

### Overview
Industry leader in financial data connectivity, connecting to 10,000+ institutions in the US/Canada.

### Pricing Model

**Free Tier Options:**
- **Sandbox:** Unlimited free access with fake data for development
- **Trial Plan (new teams after April 15, 2026):** Up to 10 Production Items free with real data, supporting OAuth institutions
- **Limited Production:** First 200 API calls free with live data

**Production Pricing:**
- Pay-per-use: $0.10-$0.60 per successful API call (varies by product and volume)
- Median contract: $9,000/year (based on verified purchases)
- Most products charge per API call, not per user
- Volume discounts available for scale

**Reality Check for Indie Devs:** Free tier is very limited. You'll need to budget for production costs early. The 200 API call limit can be exhausted quickly with just a few active users.

### Features Available
- Account linking and authentication
- Transaction history retrieval
- Balance checking
- Identity verification
- Income verification
- Asset reports
- Investment data
- Payment initiation
- Auth (account/routing numbers for ACH)

### Coverage
- 10,000+ financial institutions (US/Canada)
- ~95%+ of US consumer banks
- Major credit unions
- Investment accounts
- Credit cards

### Developer Experience
- **Documentation:** Industry-leading, comprehensive
- **Integration:** Well-documented SDKs for iOS, Android, React Native, Web
- **Plaid Link:** Pre-built UI component simplifies bank connection flow
- **Learning curve:** Moderate - good docs but complex for beginners
- **Support:** Extensive documentation, community support, sales-led for production

### Integration Complexity
- **Ease:** Medium - well-supported but sales process required for production
- **Time to integrate:** 2-4 weeks for basic implementation
- **Maintenance:** Low once integrated, but API changes require updates

### Best For
- Apps needing comprehensive US/Canada bank coverage
- Teams with budget for API costs ($500+/month minimum)
- Products requiring identity/income verification
- Apps already processing payments where bank data is secondary

### Not Ideal For
- Pure bootstrapped projects with zero budget
- Apps with <100 active users (economics don't work)
- International/non-US focus
- Side projects and MVPs

---

## 2. Teller

### Overview
Developer-first alternative to Plaid with cleaner API design and transparent pricing.

### Pricing Model

**Free Tier:**
- **Developer Tier:** 100 free live bank connections
- **Production:** Per-connection monthly fee (public pricing on website)
- **No minimum contract** (unlike Plaid's sales-led approach)

**Key Advantage:** This is the BEST free tier for indie developers building real apps with real users.

### Features Available
- Account data retrieval
- Transaction history
- Balance checking
- ACH-related workflows
- Account and routing numbers
- Identity data

### Coverage
- **Limited but strategic:** Defined list of major US banks
- Does NOT cover 10,000+ institutions like Plaid
- Covers most common consumer banks (Chase, Bank of America, Wells Fargo, etc.)
- Long-tail credit unions NOT well supported

**Critical Consideration:** Test your target user base's banks against Teller's coverage list before committing.

### Developer Experience
- **Documentation:** Clean, developer-friendly
- **Integration:** Simple REST API, easier than Plaid
- **Speed:** Noticeably faster than Plaid (no screen scraping, native sessions)
- **Learning curve:** Lower than Plaid
- **Support:** Developer-focused community

### Integration Complexity
- **Ease:** Easy - cleaner API than Plaid
- **Time to integrate:** 1-2 weeks
- **Maintenance:** Low

### Best For
- US indie developers and bootstrapped startups
- Apps serving users with major banks (not credit unions)
- Developer-led teams wanting simplicity
- Projects needing 100 live connections to validate product-market fit
- Teams that value speed and developer experience

### Not Ideal For
- Apps requiring coverage of 1,000+ regional credit unions
- International users
- Enterprise compliance requirements

---

## 3. Stripe Financial Connections

### Overview
Stripe's banking data API, ideal if you're already using Stripe for payments.

### Pricing Model
- **Bank account verification:** $1.50 per API call
- **Balance retrieval:** $0.10 per API call
- **Transaction data:** Pricing varies (feature still developing)
- **No free tier** for production use
- **Sandbox:** Free for testing

### Features Available
- Instant bank account verification for ACH payments
- Balance checking (fraud reduction)
- Account ownership verification
- Transaction data (limited, in development)
- Built-in with Stripe ACH Direct Debit

### Coverage
- 5,000+ US financial institutions
- Works with 90%+ of US bank accounts

### Developer Experience
- **Documentation:** Excellent (Stripe quality)
- **Integration:** Seamless if already using Stripe
- **Learning curve:** Low for Stripe users, moderate for new users
- **Support:** Stripe's standard excellent support

### Integration Complexity
- **Ease:** Very easy if using Stripe ecosystem
- **Time to integrate:** 1 week (if familiar with Stripe)
- **Maintenance:** Very low

### Best For
- Apps already using Stripe for payments
- Projects needing bank verification for ACH/transfers
- Teams valuing Stripe's ecosystem and support
- Apps with payment flows where bank data is secondary

### Not Ideal For
- Apps not using Stripe (ecosystem lock-in)
- Primary focus on transaction categorization and budgeting
- Projects needing deep financial data beyond verification

---

## 4. SimpleFIN Bridge

### Overview
Ultra-affordable banking API designed for personal finance apps.

### Pricing Model
- **$15/year per user** (or $1.50/month)
- Extremely affordable for bootstrapped projects
- No enterprise contracts or sales calls

### Features Available
- Connect up to 25 institutions per user
- Transaction data retrieval
- Balance checking
- Daily updates (24 requests or fewer per day)
- Token-based authentication

### Coverage
- 12,000+ financial institutions
- US focus but some international coverage

### Developer Experience
- **Documentation:** Simple, straightforward
- **Integration:** Clean API, demo tokens available
- **Learning curve:** Low
- **Support:** Community-driven

### Integration Complexity
- **Ease:** Very easy
- **Time to integrate:** 3-7 days
- **Maintenance:** Very low

### Best For
- **Personal finance apps** (budgeting, expense tracking)
- **Indie developers with zero budget**
- Read-only access needs
- Daily sync frequency is acceptable
- Side projects and MVPs

### Not Ideal For
- Real-time transaction tracking
- Payment initiation
- High-frequency data updates (more than daily)
- Enterprise compliance requirements
- Production fintech products requiring instant updates

---

## 5. MX (formerly MX Technologies)

### Overview
Enterprise-focused financial data platform with data enhancement capabilities.

### Pricing Model
- **Custom quotes only** (not publicly listed)
- Sales-led process
- Volume-based pricing
- Typically expensive for small startups

### Features Available
- Account aggregation
- Transaction categorization with ML
- Data enhancement and enrichment
- Financial insights
- Cash flow analysis
- Spending analytics

### Coverage
- Broad US coverage
- Similar to Plaid in institution support

### Developer Experience
- **Documentation:** Professional, enterprise-focused
- **Integration:** Robust SDKs
- **Learning curve:** Moderate to high
- **Support:** Enterprise support packages

### Integration Complexity
- **Ease:** Medium
- **Time to integrate:** 3-6 weeks
- **Maintenance:** Medium

### Best For
- VC-backed startups with funding
- Enterprise fintech applications
- Apps needing transaction categorization ML
- Teams requiring data enrichment features

### Not Ideal For
- Bootstrapped indie developers (pricing prohibitive)
- MVP/early validation stage
- Small user bases (<1,000 users)

---

## 6. Yodlee (Envestnet)

### Overview
One of the oldest financial data aggregation providers, enterprise-focused.

### Pricing Model
- **Base platform fee:** $1,000-$2,000/month minimum
- **Per-item ACH fee:** $0.25-$0.55 per transaction
- **Annual contracts with minimums required**
- **At 5K users:** $8,000-$15,000/month ($100K-$200K annually)

**Reality Check:** Prohibitively expensive for indie developers and early-stage startups.

### Features Available
- Comprehensive account aggregation
- Transaction history
- Data categorization
- Financial insights
- Investment tracking
- Credit monitoring

### Coverage
- 10,000+ institutions globally
- Extensive international coverage
- Deep feature set

### Developer Experience
- **Documentation:** Comprehensive but complex
- **Integration:** Enterprise-grade, complex setup
- **Learning curve:** High
- **Support:** Dedicated account management for large contracts

### Integration Complexity
- **Ease:** Complex
- **Time to integrate:** 6-12 weeks
- **Maintenance:** Medium to high

### Best For
- Well-funded fintech companies
- Enterprise applications
- Apps with rapid scaling certainty
- International coverage requirements

### Not Ideal For
- Indie developers (cost prohibitive)
- Bootstrapped startups
- MVP validation stage
- Apps with <10,000 active users

---

## 7. Finicity (Mastercard Open Banking)

### Overview
Mastercard's open banking platform, enterprise-focused competitor to Plaid and Yodlee.

### Pricing Model
- **Custom quotes** (not publicly listed)
- Enterprise pricing
- Sales-led process
- Similar tier to MX and Yodlee

### Features Available
- Open banking data access
- Transaction history
- Account verification
- Cash flow analytics
- Financial reports
- Credit decisioning data

### Coverage
- Extensive US coverage
- International expansion
- Similar to Plaid

### Developer Experience
- **Documentation:** Professional, detailed
- **Integration:** Enterprise SDKs
- **Learning curve:** Moderate to high
- **Support:** Enterprise support

### Integration Complexity
- **Ease:** Medium
- **Time to integrate:** 4-8 weeks
- **Maintenance:** Medium

### Best For
- Funded fintech startups
- Enterprise lending/credit applications
- Apps requiring Mastercard ecosystem integration
- Companies needing credit decisioning features

### Not Ideal For
- Indie developers (pricing)
- Bootstrapped projects
- Simple expense tracking apps

---

## 8. TrueLayer

### Overview
European-focused open banking API provider with strong UK presence.

### Pricing Model
- **Free sandbox** for testing
- **No free production tier**
- **Usage-based pricing** (sales-negotiated)
- Three tiers: Development (free testing), Scale (monthly + per-use), Enterprise (custom)

### Features Available
- Open banking data access (EU/UK)
- Payment initiation
- Transaction data
- Account verification
- Data categorization

### Coverage
- UK: Excellent coverage
- Europe: Growing coverage (EU countries)
- US: Limited/none

### Developer Experience
- **Documentation:** Developer-friendly
- **Integration:** Modern REST API
- **Learning curve:** Low to moderate
- **Support:** Sales-driven for production

### Integration Complexity
- **Ease:** Medium
- **Time to integrate:** 2-4 weeks
- **Maintenance:** Low to medium

### Best For
- EU/UK-focused applications
- Open banking compliance requirements
- Payment initiation needs in Europe
- UK startups with funding

### Not Ideal For
- US-focused applications (no coverage)
- Bootstrapped projects without budget
- Apps needing free production tier

---

## 9. Akoya

### Overview
Industry-owned data access network for secure financial data sharing.

### Pricing Model
- **Standard plan:** Up to 10,000 unique connections/month
- **Enterprise plan:** 10,000+ connections/month
- **Free self-service sandbox**
- **Setup/implementation fees may apply**
- Specific pricing not publicly disclosed (contact sales)

### Features Available
- Consumer-permissioned financial data
- Direct connection to financial institutions
- Secure data sharing network
- API-based access

### Coverage
- Thousands of financial institutions
- US-focused
- Industry consortium backing

### Developer Experience
- **Documentation:** Professional
- **Integration:** API v3 (v2 deprecated Feb 2026)
- **Learning curve:** Medium
- **Support:** Enterprise support

### Integration Complexity
- **Ease:** Medium
- **Time to integrate:** 3-6 weeks
- **Maintenance:** Low to medium

### Best For
- Mid-sized to large fintech apps
- Apps valuing industry consortium approach
- Security-focused implementations

### Not Ideal For
- Early-stage MVPs
- Indie developers without funding
- International applications

---

## 10. Dwolla

### Overview
ACH payment infrastructure with bank verification capabilities.

### Pricing Model
- **Monthly platform fee:** $100-$500+/month (depending on tier)
- **Per-item ACH fee:** $0.25-$0.55 per transaction
- **Same-day ACH:** Additional surcharge
- **Return fees:** $0-$5 per returned item
- **Custom pricing** for volume

**Warning:** Monthly minimums make this expensive at moderate transaction volumes.

### Features Available
- ACH payment processing
- Bank account verification (Open Banking Services)
- Instant verification via open banking
- Micro-deposit verification
- Same Day ACH
- Real-time payment rails
- Unified API for multiple payment types

### Coverage
- US financial institutions
- ACH network access

### Developer Experience
- **Documentation:** Good, developer-focused
- **Integration:** Unified API approach
- **Learning curve:** Medium
- **Support:** Volume-based support tiers

### Integration Complexity
- **Ease:** Medium
- **Time to integrate:** 2-4 weeks
- **Maintenance:** Low to medium

### Best For
- Apps with payment processing needs
- ACH transfer functionality
- Apps with consistent transaction volume
- Payment platforms

### Not Ideal For
- Read-only expense tracking (overkill and expensive)
- Low transaction volume apps
- Apps without payment features
- Early-stage MVPs

---

## 11. Basiq (Australia/NZ)

### Overview
Australian open banking platform with CDR (Consumer Data Right) compliance.

### Pricing Model
- **Per-user pricing** (charged once user is created, regardless of connections)
- **12-month minimum contract** for production
- **Free sandbox** with instant access
- Specific pricing not disclosed (contact sales)

### Features Available
- Bank account data access
- 180+ Australian and New Zealand banks
- CDR-compliant connections
- Third-party connectors
- 4,500+ data attributes
- Data enrichment

### Coverage
- Australia: Excellent
- New Zealand: Good
- Other regions: Limited

### Developer Experience
- **Documentation:** Developer-friendly
- **Integration:** Modern API
- **Learning curve:** Low to medium
- **Support:** Regional support

### Integration Complexity
- **Ease:** Medium
- **Time to integrate:** 2-3 weeks
- **Maintenance:** Low

### Best For
- Australian/NZ applications
- CDR compliance requirements
- Regional fintech in APAC

### Not Ideal For
- US/European apps (no coverage)
- Month-to-month testing (12-month minimum)
- Global applications

---

## 12. Flinks (Canada)

### Overview
Canadian open banking leader with North American coverage.

### Pricing Model
- **Free developer sandbox**
- **Production pricing:** Sales-gated (contact for quotes)
- Custom enterprise pricing

### Features Available
- Connect to 15,000+ banks (North America)
- Real-time onboarding (KYC)
- Income verification
- Underwriting data
- 4,500+ data attributes
- 95%+ success rates
- Interac/EFT payments (Canada)

### Coverage
- Canada: Excellent (live data sharing with major banks)
- US: Good
- 15,000+ North American institutions

### Developer Experience
- **Documentation:** Good
- **Integration:** Modern SDKs
- **Learning curve:** Medium
- **Support:** Sales-driven

### Integration Complexity
- **Ease:** Medium
- **Time to integrate:** 2-4 weeks
- **Maintenance:** Low to medium

### Best For
- Canadian fintech applications
- North American coverage needs
- Apps requiring Canadian bank integration
- Interac/EFT payment needs

### Not Ideal For
- US-only applications (Teller/Plaid better)
- Bootstrapped developers (pricing not transparent)
- Non-North American markets

---

## 13. GoCardless (UK/Europe)

### Overview
European payment and open banking provider with Instant Bank Pay feature.

### Pricing Model
- **UK Standard:** 1% + £0.20 per transaction
- **EU:** 1% + €0.20 per transaction (capped at €2)
- **Focus:** Payment processing, not just data access

### Features Available
- Instant Bank Pay (open banking payments)
- Direct Debit (recurring)
- Transaction collection
- Account verification
- GBP and EUR support

### Coverage
- UK: 100+ banks
- Europe: 2,500+ banks (30+ countries)
- Focus: GBP, EUR transactions

### Developer Experience
- **Documentation:** Good
- **Integration:** Straightforward API
- **Learning curve:** Low to medium
- **Support:** Standard support

### Integration Complexity
- **Ease:** Easy to medium
- **Time to integrate:** 1-2 weeks
- **Maintenance:** Low

### Best For
- UK/EU payment collection
- Subscription apps with recurring payments
- One-off payment needs in Europe

### Not Ideal For
- US applications (no coverage)
- Read-only expense tracking (payment-focused)
- Free/low-cost bootstrapped projects

---

## 14. Salt Edge

### Overview
Global open banking platform with 5,000+ bank connections.

### Pricing Model
- **Volume-based:** Based on API call frequency and number
- **Custom pricing:** Negotiated based on needs
- **No clear free tier** in public documentation
- Additional fees for: data enrichment, bulk payments, variable recurring payments

### Features Available
- Account information (AISP - EU PSD2)
- Payment initiation
- Data enrichment
- Global coverage (EU and beyond)
- 5,000+ worldwide banks

### Coverage
- Europe: Excellent
- Global: Good (5,000+ institutions)
- Multi-region support

### Developer Experience
- **Documentation:** Comprehensive API docs
- **Integration:** Modern REST API
- **Learning curve:** Medium
- **Support:** Tiered support based on plan

### Integration Complexity
- **Ease:** Medium
- **Time to integrate:** 2-4 weeks
- **Maintenance:** Medium

### Best For
- European applications
- Global multi-region apps
- PSD2 compliance needs
- Enterprise fintech

### Not Ideal For
- Bootstrapped indie developers (no free tier)
- US-only applications
- Early-stage MVPs

---

## Alternative Approaches & Manual Tracking

### Why Manual Entry Matters

Regardless of which API you choose, **manual transaction entry is essential**:
1. **API coverage gaps:** No API covers 100% of banks
2. **Cash transactions:** APIs can't track cash spending
3. **Shared expenses:** Couples often split purchases across different payment methods
4. **API failures:** Banking APIs have downtime and connection issues
5. **User preference:** Some users don't trust bank connections
6. **International:** Users with international accounts may not be supported

### Manual Transaction Entry Best Practices

**Essential Features:**
- Quick-add transaction button (persistent, accessible)
- Recent/frequent merchants for fast entry
- Smart defaults (time, common amounts)
- Photo receipt capture
- Split transaction support (crucial for couples)
- Bulk import (CSV upload)
- Recurring transaction templates

**Open Source Libraries for Manual Tracking (React Native):**

1. **Transy** ([GitHub - IamHamzaAziz/transy-react-native](https://github.com/IamHamzaAziz/transy-react-native))
   - React Native + Expo + Firebase
   - TypeScript support
   - Income/expense tracking
   - CRUD operations

2. **Expense Tracker React Native** ([GitHub - kirankumargonti/expense-tracker-react-native](https://github.com/kirankumargonti/expense-tracker-react-native))
   - Full CRUD functionality
   - Transaction management
   - Additional features built-in

3. **Open Source React Native Apps Collection** ([GitHub - numandev1/open-source-react-native-apps](https://github.com/numandev1/open-source-react-native-apps))
   - Curated list including Data@Hand and various tracking apps
   - Perfi: Expense and income tracking

**Local Database Options:**
- **WatermelonDB** - Fast, scalable local database for React Native
- **Realm** - Mobile database with sync capabilities
- **SQLite** - Traditional relational database (react-native-sqlite-storage)
- **AsyncStorage** - Simple key-value storage (for small datasets)

### Transaction Categorization (ML/AI)

Even with manual entry, automatic categorization improves UX:

**Third-Party Categorization APIs:**
- **Plaid:** Includes transaction categorization
- **MX:** Advanced ML categorization
- **Yodlee:** Data enrichment with categories
- **Salt Edge:** Data enrichment services
- **Tink:** European provider with categorization

**Free/Open Source Options:**
- **Free public categorization API:** JSON-based transaction name → category
- **Build your own ML model:**
  - Train on transaction description patterns
  - Use merchant name matching
  - Implement rule-based fallbacks
  - Learn from user corrections

**How ML Categorization Works:**
- Analyzes merchant names, transaction descriptions
- Pattern matching on amounts and frequency
- Historical user behavior
- Natural language processing
- Gets smarter over time with user feedback

**Popular Commercial Tools with APIs:**
- **Ramp:** AI categorization, anomaly detection
- **Expensify:** SmartScan AI for receipts
- **QuickBooks:** ML categorization and learning

---

## Special Consideration: Couples & Shared Accounts

### Apps Built for Couples

**Dedicated Couple Finance Apps:**
1. **Honeydue**
   - Supports 20,000+ institutions across 5 countries
   - Account-level privacy controls
   - Choose what to share: all data, balances only, or nothing
   - Free to use

2. **Monarch Money** (Recommended)
   - Built for households from day one
   - Both partners see same data
   - Joint goal setting
   - Real-time spending tracking
   - Comment on transactions together
   - Individual account visibility maintained
   - Premium service (~$100/year)

3. **Zeta**
   - Shared banking for couples/families
   - Joint account features

4. **Crush**
   - AI-powered shared finances
   - No bank switching required
   - Track spend, habits, trends together

**Traditional Apps with Couple Features:**
- **YNAB (You Need A Budget):** Zero-based budgeting, shared budgets
- **Rocket Money:** Automation-focused, shared view
- **Goodbudget:** Digital envelope method
- **PocketGuard:** Spending boundaries

### Technical Implementation for Couples

**Architecture Options:**

1. **Shared Account Model:**
   - One shared "household" account
   - Multiple user logins
   - All transactions visible to both
   - Simpler technically

2. **Individual + Shared Model:**
   - Each person has individual account
   - Shared "household" view
   - Privacy controls per account
   - More complex but flexible

3. **Link Multiple Bank Accounts:**
   - Connect both partners' accounts
   - Aggregate into household view
   - Tag transactions as personal/shared
   - Most flexible

**Key Features for Couples:**
- **Split transactions:** Mark who paid and who owes
- **Shared categories:** Joint budget categories
- **Individual categories:** Personal spending tracking
- **Comments/notes:** Discuss transactions
- **Notifications:** Alert partner on large purchases
- **Privacy controls:** Hide specific accounts if needed
- **Joint goals:** Savings targets together

**Banking API Considerations:**
- Most APIs charge per user or per connection
- Couples = 2x the API costs in most cases
- SimpleFIN: Still $15/year (supports 25 connections)
- Teller: Each person's banks count toward connection limit
- Plaid: Each account link = separate item (costs add up)

---

## Recommendations by Use Case

### 1. Bootstrapped Indie Developer (Zero Budget)

**Recommended Stack:**
- **Phase 1 (MVP):** Manual entry only with local database
  - Use WatermelonDB or Realm for data storage
  - Build simple manual transaction entry
  - Implement basic categorization (rule-based)
  - Cost: $0

- **Phase 2 (Early Users):** Add SimpleFIN Bridge
  - $15/year per user (users pay for their own)
  - 12,000+ institutions
  - Daily sync acceptable
  - Cost: $0 upfront (pass cost to users)

- **Phase 3 (Traction):** Upgrade to Teller
  - Use 100 free connections to validate
  - Transparent pricing for growth
  - Better UX than SimpleFIN
  - Cost: $0 for first 100 users

**Why This Works:**
- Zero upfront costs
- Validate product-market fit before paying
- Users understand paying $15/year for bank sync
- Teller's free tier handles early traction

---

### 2. Side Project / Personal Finance Tool

**Recommended:**
- **SimpleFIN Bridge** ($15/year)
- **Manual entry with local storage**

**Why:**
- Affordable for personal use
- Good coverage for major banks
- Daily sync sufficient for budgeting
- No enterprise overhead

**Alternative:**
- Build entirely manual with no API (many successful apps do this)

---

### 3. Funded Startup (Seed Round+)

**Recommended:**
- **Plaid** (if US-focused, need comprehensive coverage)
- **TrueLayer** (if EU/UK-focused)
- **Flinks** (if Canada-focused)

**Why:**
- Comprehensive coverage matters at scale
- Can afford $500-$2K+/month
- Enterprise support valuable
- Investor-backed = can subsidize API costs

**Budget:**
- Allocate $1,000-$5,000/month for banking API
- Plan for scale (costs grow with users)

---

### 4. Couples-Focused App

**Recommended Stack:**
- **Backend API:** Teller (100 free connections) or SimpleFIN
- **Inspiration:** Study Honeydue and Monarch Money UX
- **Key features:**
  - Shared household view
  - Individual privacy controls
  - Split transaction tracking
  - Joint goals and budgets

**Why:**
- Couples = 2x connections = 2x cost (plan accordingly)
- SimpleFIN's 25 institutions/user handles both partners
- Privacy controls are critical for adoption
- Manual entry essential (cash, Venmo, split payments)

---

### 5. International / Multi-Region App

**Recommended:**
- **Europe:** TrueLayer or Salt Edge
- **Australia/NZ:** Basiq
- **Canada:** Flinks
- **US:** Plaid or Teller
- **Global:** Salt Edge (5,000+ banks worldwide)

**Why:**
- Regional APIs have better coverage in their markets
- Compliance (PSD2 in EU, CDR in Australia)
- May need multiple API providers for true global coverage

**Budget:**
- Plan for multiple API subscriptions
- Regional pricing varies significantly

---

## Cost Comparison Table

| API | Free Tier | Minimum Monthly Cost | Best For | Coverage |
|-----|-----------|---------------------|----------|----------|
| **SimpleFIN** | No | $1.25/user | Personal finance, indie devs | 12,000+ (US) |
| **Teller** | 100 live connections | $0 (then per-connection) | Indie devs, US startups | Major US banks |
| **Plaid** | 200 API calls | ~$500 | Funded startups, comprehensive needs | 10,000+ (US/CA) |
| **Stripe Financial Connections** | Sandbox only | Pay-per-use ($1.50/verification) | Stripe users | 5,000+ (US) |
| **MX** | No | Custom (high) | Enterprise, ML categorization | Broad US |
| **Yodlee** | No | $1,000-$2,000 | Enterprise only | 10,000+ (global) |
| **Finicity** | No | Custom (high) | Enterprise | Broad US |
| **TrueLayer** | Sandbox | Custom (usage-based) | EU/UK apps | UK/EU excellent |
| **Akoya** | Sandbox | Custom | Mid-sized fintechs | US |
| **Dwolla** | No | $100-$500+ | Payment processing | US (ACH focus) |
| **Basiq** | Sandbox | Custom (12-mo minimum) | Australia/NZ | AU/NZ: 180+ banks |
| **Flinks** | Sandbox | Custom | Canada | 15,000+ (North America) |
| **GoCardless** | No | 1% + £0.20/transaction | UK/EU payments | UK/EU |
| **Salt Edge** | No | Custom | Europe, global | 5,000+ (global) |

---

## Integration Complexity Comparison

| API | Time to Integrate | Ease of Integration | Documentation Quality | Developer Experience |
|-----|-------------------|---------------------|----------------------|---------------------|
| **SimpleFIN** | 3-7 days | Very Easy | Good | Excellent (indie-friendly) |
| **Teller** | 1-2 weeks | Easy | Excellent | Excellent (dev-first) |
| **Stripe Financial Connections** | 1 week | Very Easy (if using Stripe) | Excellent | Excellent |
| **Plaid** | 2-4 weeks | Medium | Excellent | Good (sales-heavy) |
| **MX** | 3-6 weeks | Medium | Good | Medium |
| **Yodlee** | 6-12 weeks | Complex | Comprehensive | Medium (enterprise) |
| **Finicity** | 4-8 weeks | Medium | Good | Medium |
| **TrueLayer** | 2-4 weeks | Medium | Good | Good |
| **Akoya** | 3-6 weeks | Medium | Professional | Medium |
| **Dwolla** | 2-4 weeks | Medium | Good | Good |
| **Basiq** | 2-3 weeks | Medium | Good | Good |
| **Flinks** | 2-4 weeks | Medium | Good | Medium |
| **GoCardless** | 1-2 weeks | Easy to Medium | Good | Good |
| **Salt Edge** | 2-4 weeks | Medium | Comprehensive | Medium |

---

## Final Recommendations for Your Mobile App

### Start Here (Phase 1 - MVP):
1. **Build manual transaction entry first**
   - Validate your UX and core value prop
   - Zero API costs while finding product-market fit
   - Use WatermelonDB or Realm for local storage
   - Implement basic rule-based categorization

2. **Add CSV import**
   - Users can download from their bank and upload
   - Free feature that adds major value

### Early Validation (Phase 2 - First 100 Users):
3. **Add SimpleFIN Bridge integration** ($15/year per user)
   - Let users opt-in and pay for themselves
   - Daily sync is fine for expense tracking
   - Covers 12,000+ institutions
   - OR

4. **Add Teller** (100 free live connections)
   - Better UX than SimpleFIN
   - Faster sync
   - Free for validation phase
   - Transparent pricing to scale

### Growth Phase (Phase 3 - Funding or Revenue):
5. **Upgrade to Plaid** (if you raise funding or have revenue)
   - Comprehensive coverage
   - Better for investor conversations
   - Enterprise features
   - Budget $1K-$5K/month

### For Couples Features:
- Study Monarch Money and Honeydue UX patterns
- Implement shared household views
- Privacy controls are critical
- Split transaction tracking
- Manual entry is essential (Venmo, cash, etc.)

### Open Source Components to Leverage:
- **Manual tracking:** Fork Transy or expense-tracker-react-native
- **Local database:** WatermelonDB (fast, scalable)
- **CSV import:** Build custom or use Papa Parse
- **Receipt scanning:** React Native Camera + OCR
- **Categorization:** Start rule-based, add ML later

---

## Key Takeaways

1. **No truly free production option exists** - Budget for API costs or start manual-only
2. **SimpleFIN is the cheapest** ($15/year) but daily sync only
3. **Teller is the best free tier for indie devs** (100 live connections)
4. **Plaid is the industry standard** but expensive for bootstrapped projects
5. **Manual entry is non-negotiable** - APIs don't cover everything
6. **Couples features** require thoughtful privacy controls and shared views
7. **Start simple** - Manual entry MVP, add bank sync after validation
8. **Regional matters** - Different APIs excel in different markets
9. **Transaction categorization** - Build rule-based first, ML later
10. **Pass costs to users** - $15/year for bank sync is reasonable

---

## Additional Resources

### Documentation Links
- **Plaid:** https://plaid.com/docs/
- **Teller:** https://teller.io/docs
- **Stripe Financial Connections:** https://docs.stripe.com/financial-connections
- **SimpleFIN:** https://beta-bridge.simplefin.org/info/developers
- **MX:** https://www.mx.com/products/
- **Yodlee:** https://developer.yodlee.com/
- **TrueLayer:** https://docs.truelayer.com/
- **Flinks:** https://www.flinks.com/go/bank-data-api

### Community & Support
- **Reddit:** r/plaid, r/fintech
- **Discord:** Fintech developer communities
- **GitHub:** Search for "banking API" or "expense tracker"

### Comparable Apps for Research
- **Monarch Money** - Best couples UX
- **YNAB** - Manual-first approach with bank sync optional
- **Actual Budget** - Open source, SimpleFIN integration
- **Honeydue** - Couples-focused
- **Copilot Money** - iOS premium budgeting

---

## Sources & References

### Plaid
- [Plaid Pricing - Official](https://plaid.com/pricing/)
- [Can I use Plaid for free? – Plaid Customer Help Center](https://support.plaid.com/hc/en-us/articles/16194695660311-Can-I-use-Plaid-for-free)
- [Plaid Software Pricing & Plans 2026: See Your Cost](https://www.vendr.com/marketplace/plaid)
- [Plaid Pricing 2026: Plans, Costs & Free Options | AISO Tools](https://aisotools.com/pricing/plaid)

### Teller & Alternatives
- [Best Open Banking API Providers for Developers in 2026](https://www.openbankingtracker.com/blog/best-open-banking-api-providers-developers-2026)
- [Free & Indie Open Banking APIs (2026): What Is Actually Free?](https://www.openbankingtracker.com/guides/free-open-banking-apis)
- [7 Best Plaid Alternatives in 2026 (Free & Paid) - SoftVerdict](https://softverdict.com/plaid-alternatives-2026/)
- [15 Best Plaid Alternatives (2026): Tink, TrueLayer, MX &...](https://www.openbankingtracker.com/api-aggregators/plaid/alternatives)
- [Plaid vs Teller API: Speed, Coverage & Developer Experience Breakdown](https://www.fintegrationfs.com/post/plaid-vs-teller-api-speed-coverage-developer-experience-breakdown)

### Yodlee & Finicity
- [Yodlee Pricing Guide for UK Startups in 2026](https://blog.finexer.com/yodlee-pricing/)
- [Plaid vs Yodlee: How Much Will Financial Data APIs Cost Your Fintech?](https://www.getmonetizely.com/articles/plaid-vs-yodlee-how-much-will-financial-data-apis-cost-your-fintech)
- [Finicity vs Plaid vs Yodlee: Best Fintech APIs Comparision](https://www.protonbits.com/finicity-vs-plaid-vs-yodlee/)

### TrueLayer
- [TrueLayer Pricing 2026: Best Alternative for UK Startups](https://blog.finexer.com/truelayer-pricing-uk/)
- [TrueLayer: Open Banking API, Pay-by-Bank & Bank Coverage](https://www.openbankingtracker.com/truelayer)

### Akoya
- [Pricing | Akoya Open Finance Data Access and Sharing Solutions](https://akoya.com/pricing)
- [Akoya Software Pricing, Alternatives & More 2026 | Capterra](https://www.capterra.com/p/10031062/Akoya/)

### SimpleFIN
- [SimpleFIN](https://www.simplefin.org/ecosystem.html)
- [Developer Guide - SimpleFIN Bridge](https://beta-bridge.simplefin.org/info/developers)
- [SimpleFIN Setup | Actual Budget](https://actualbudget.org/docs/advanced/bank-sync/simplefin/)

### Stripe Financial Connections
- [Stripe Financial Connections | Secure Open Banking Platform](https://stripe.com/financial-connections)
- [Financial Connections fundamentals | Stripe Documentation](https://docs.stripe.com/financial-connections/fundamentals)

### Basiq
- [Basiq API Platform](https://www.basiq.io/)
- [Pricing | Basiq](https://www.basiq.io/pricing.html)
- [GitHub - api-evangelist/basiq](https://github.com/api-evangelist/basiq)

### Flinks
- [Real-Time Banking API for Secure Bank Data Access | Flinks](https://www.flinks.com/go/bank-data-api)
- [Open Banking in Canada: What the 2026 Launch Means for Fintechs](https://www.flinks.com/blog/open-banking-canada-2026-launch-fintech-institutions)

### Dwolla
- [Payment API Pricing | Dwolla](https://www.dwolla.com/pricing)
- [ACH Payment API Integration | Dwolla](https://www.dwolla.com/features/integration)
- [Cheaper Dwolla Alternatives for Large ACH and Bank Transfers in 2026](https://www.coastalpay.com/cheaper-dwolla-alternatives-for-large-ach-and-bank-transfers-in-2026/)

### GoCardless
- [GoCardless Instant Bank Pay guide | GoCardless](https://gocardless.com/guides/posts/en-gb-six-key-things-you-need-to-know-about-instant-bank-pay/)
- [Pricing EU | GoCardless](https://gocardless.com/pricing-eu)

### Salt Edge
- [Data Aggregation | Financial data aggregation | AISP | Salt Edge](https://www.saltedge.com/products/account_information)
- [Salt Edge Pricing: Guide for UK Startups in 2025](https://blog.finexer.com/salt-edge-pricing/)

### Manual Tracking & Open Source
- [GitHub - IamHamzaAziz/transy-react-native](https://github.com/IamHamzaAziz/transy-react-native)
- [Building a Personal Finance Tracker Mobile App with React Native - DEV Community](https://dev.to/nadim_ch0wdhury/building-a-personal-finance-tracker-mobile-app-with-react-native-4jjn)
- [GitHub - numandev1/open-source-react-native-apps](https://github.com/numandev1/open-source-react-native-apps)

### Transaction Categorization
- [Bank Transaction Categorization with Machine Learning](https://neontri.com/blog/ai-transaction-categorization/)
- [Effortless Expense Categorization with AI Technology | SparkReceipt](https://sparkreceipt.com/blog/ai-categorize-expenses/)
- [Complete Guide to AI Expense Categorization - SpendifiAI](https://www.spendifiai.com/blog/ai-expense-categorization-guide)

### Couples Apps
- [10 Best Budgeting Apps for Couples in 2026](https://useorigin.com/resources/blog/10-best-budgeting-apps-for-couples-in-2026)
- [Best Budgeting Apps for Couples (2026 Guide)](https://www.thepennyhoarder.com/budgeting/best-budgeting-apps-couples/)
- [Top 6 apps specifically for couples working on finance, banking, investing together - Tearsheet](https://tearsheet.co/designing-new-products/top-6-apps-specifically-for-couples-working-on-finance-banking-investing-together/)

### General Banking API Resources
- [9 Best Fintech API Companies for Embedded Finance (2026)](https://connectpay.com/blog/best-fintech-api-companies/)
- [Best Open Banking API Providers in 2026: Platform Comparison & Buyer Checklist](https://itexus.com/best-open-banking-api-providers/)
- [Best Open Banking API Providers for Developers (2026)](https://www.openbankingcompare.com/blog/best-open-banking-api-providers-for-developers-2026)

---

**Document Version:** 1.0
**Last Updated:** August 14, 2026
**Research Conducted By:** Claude Code (Anthropic)
