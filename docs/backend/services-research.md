# Backend Services Research for Mobile Couples App
Research Date: August 2026

## Executive Summary

This document provides comprehensive research and recommendations for authentication, push notifications, media storage, and analytics services optimized for indie developers building a mobile couples app. All recommendations prioritize cost-effectiveness and ease of development.

> **Decision update (August 14, 2026):** The Supabase-first recommendations in this historical comparison are superseded. Tether uses Neon for Postgres and Railway for its backend. Use Clerk for authentication, Cloudflare R2 for media, and Expo Push for notifications. The Railway backend validates identity tokens and applies authorization; it is not delegated to the database host. See the [current architecture decision](../architecture/neon-railway-architecture.md).

---

## 1. Authentication

### Services Compared
- Supabase Auth
- Firebase Auth
- Clerk
- Auth0

### Free Tier Comparison

| Service | Free MAU | Cost After Free Tier | Notable Features |
|---------|----------|---------------------|------------------|
| **Supabase Auth** | 50,000 MAU | $0.00325/MAU | Best value at scale |
| **Firebase Auth** | 50,000 MAU | $0.0055/MAU | Strong mobile SDKs |
| **Clerk** | 10,000 MAU | $0.02/MAU | Best DX, pre-built UI |
| **Auth0** | 7,500 MAU | $0.07/MAU | Enterprise features |

### Cost at Scale (100K Users)
- **Supabase Auth**: ~$162/month
- **Firebase Auth**: ~$275/month
- **Clerk**: ~$1,800/month
- **Auth0**: ~$6,475/month

### Social Authentication Support
All services support:
- Google Sign-In
- Apple Sign-In
- Email/password authentication
- Account linking capabilities

### Account Linking for Couples App

**Supabase Auth** provides:
- **Automatic linking**: Links identities with matching verified email addresses
- **Manual linking**: API support for linking accounts that don't share the same email
- **Multi-identity support**: Single user can have multiple authentication methods
- Enable manual linking via: `GOTRUE_SECURITY_MANUAL_LINKING_ENABLED: true`

For a couples app where two partners need to link accounts, you would:
1. Use Supabase's manual linking API to connect partner accounts
2. Store relationship metadata in a separate table (e.g., `couples` table)
3. Implement custom privacy controls through Row Level Security (RLS) policies

### Superseded Recommendation: SUPABASE AUTH

> Current decision: use Clerk for application identity. Partner linking is a Tether backend workflow stored in `couples` and `couple_members`; it is not an authentication-provider identity-linking feature.

**Why:**
- **Cost**: 6x cheaper than Clerk at 100K users ($162 vs $1,000/month)
- **Free tier**: Generous 50,000 free MAU
- **Integration**: Part of complete Supabase ecosystem (storage + database + auth)
- **Account linking**: Built-in support for manual and automatic linking
- **Privacy controls**: Row Level Security (RLS) for fine-grained access control
- **Developer experience**: Excellent SDKs for mobile (React Native, Flutter, Swift, Kotlin)

**Implementation Notes:**
- Firebase Auth is comparable on price but lacks the full-stack integration
- Clerk has better pre-built UI components but becomes prohibitively expensive at scale
- For a couples app, you'll build custom linking logic regardless of provider
- Supabase's RLS policies are ideal for implementing partner-specific privacy controls

---

## 2. Push Notifications

### Services Compared
- Firebase Cloud Messaging (FCM)
- OneSignal
- Expo Push Notifications
- APNs/FCM Direct

### Free Tier Comparison

| Service | Free Tier | Cost Model | Platform Support |
|---------|-----------|------------|------------------|
| **FCM** | Unlimited | Free forever | Android, iOS, Web |
| **Expo Push** | Unlimited | Free (+ $99/yr Apple Dev) | iOS, Android via Expo |
| **OneSignal** | Unlimited mobile push | $0 (10K web subscribers) | iOS, Android, Web |
| **APNs Direct** | Unlimited | $99/yr Apple Developer | iOS only |

### Feature Comparison

**Firebase Cloud Messaging:**
- Truly unlimited free notifications
- Native push transport for Android
- Low-level transport (requires custom implementation for scheduling, segmentation)
- No built-in dashboard or analytics
- Cost is engineering time, not per-message fees

**OneSignal:**
- Free unlimited mobile push notifications
- Managed platform with dashboard, segmentation, journeys, and analytics
- Web push capped at 10,000 subscribers on free tier
- Automation features (journeys, advanced segments) limited on free tier
- Growth plan: $19/month + channel usage costs

**Expo Push Notifications:**
- Free and open-source for React Native/Expo apps
- Seamless integration with Expo framework
- Requires Firebase project for Android (free) and Apple Developer account ($99/year)
- Handles device token registration and basic delivery
- Limited advanced features compared to OneSignal

### Use Cases for Couples App

Your app needs:
- Scheduled reminders (morning check-ins, anniversary reminders)
- Partner notifications (partner posted a photo, left a note)
- Budget alerts (spending limit reached)
- Event reminders (upcoming date night)

### Recommendation: EXPO PUSH NOTIFICATIONS (if using React Native/Expo) or FCM DIRECT

**If using React Native with Expo:**
- **Use Expo Push Notifications**
- **Cost**: Free (only need Apple Developer account at $99/year)
- **Pros**: Zero per-message cost, easy implementation, built-in scheduling
- **Implementation**: Simple API, handles token management automatically

**If using native development or bare React Native:**
- **Use Firebase Cloud Messaging (FCM) directly**
- **Cost**: Free unlimited notifications
- **Pros**: Complete control, no vendor lock-in, unlimited scale
- **Cons**: Requires building scheduling logic and notification management

**Why not OneSignal:**
- While OneSignal has better features (dashboard, segmentation), the free tier is sufficient for basic needs
- For a couples app with predictable notification patterns, FCM/Expo's simplicity is preferable
- Advanced features like journeys and segmentation are limited on OneSignal's free tier anyway
- Save OneSignal for later if you need sophisticated notification campaigns

**Implementation Strategy:**
1. Start with Expo Push or FCM for free unlimited notifications
2. Build basic scheduling logic in your backend (cron jobs, scheduled cloud functions)
3. Store notification preferences in Supabase database
4. Upgrade to OneSignal Growth plan ($19/month) only if you need advanced segmentation/analytics

---

## 3. Media Storage

### Services Compared
- Cloudflare R2
- Supabase Storage
- Firebase Storage
- AWS S3
- Backblaze B2

### Pricing Comparison

| Service | Storage Cost | Egress Cost | Free Tier | CDN Included |
|---------|--------------|-------------|-----------|--------------|
| **Cloudflare R2** | $0.015/GB/mo | $0 (free egress) | 10GB storage | Yes (Cloudflare) |
| **Backblaze B2** | $0.006/GB/mo | $0.01/GB (3x free) | 10GB storage | Partner CDNs free |
| **Supabase Storage** | Included in plan | Included | 1GB free | Smart CDN (Pro only) |
| **Firebase Storage** | $0.026/GB/mo | $0.12/GB | 5GB free | Firebase CDN |
| **AWS S3** | $0.023/GB/mo | $0.085-0.09/GB | 5GB (12 months) | CloudFront separate |

### Cost Example (100GB storage + 500GB egress/month)

- **Cloudflare R2**: ~$1.50/month ($1.50 storage + $0 egress)
- **Backblaze B2**: ~$5.60/month ($0.60 storage + $5 egress)
- **Supabase Storage**: Included in Pro plan ($25/month with database/auth)
- **Firebase Storage**: ~$62.60/month ($2.60 storage + $60 egress)
- **AWS S3**: ~$47.30/month ($2.30 storage + $45 egress)

### Image/Video Optimization Features

**Supabase Storage:**
- On-the-fly image resizing and compression
- Automatic WebP conversion for supported browsers
- Dynamic transformations (width, height, quality, resize modes)
- Powered by imgproxy
- Smart CDN with 60-second cache revalidation
- **Important**: Image transformations and Smart CDN require Pro Plan ($25/month)
- **Limitation**: Video-specific optimization not well documented

**Cloudflare R2:**
- No built-in image transformation
- Integrates with Cloudflare Images (separate service)
- Free CDN through Cloudflare (when used with R2)
- Fast global delivery

**Firebase Storage:**
- No built-in image optimization
- Requires manual implementation or third-party service
- Firebase CDN included but limited optimization

### CDN Options

**Cloudflare CDN:**
- Free tier available
- Excellent performance globally
- Automatic HTTPS
- DDoS protection included
- Works natively with R2 (zero egress fees)

**BunnyCDN:**
- $1/month minimum
- $0.005/GB bandwidth (Europe/North America)
- Excellent value for high traffic
- 1TB costs ~$5 on Bunny vs $85 on AWS CloudFront
- Free egress from Backblaze B2 when using Bunny

### Recommendation: CLOUDFLARE R2 + CLOUDFLARE CDN

**Why:**
- **Best value**: $1.50/month for 100GB + 500GB egress vs $47+ on AWS/Firebase
- **Zero egress fees**: No surprise bills as your app grows
- **Free CDN**: Cloudflare CDN included at no extra cost
- **Global performance**: Fast delivery worldwide
- **S3 compatible**: Easy migration if needed later

**For a couples app with photos/videos, this could save you $500-1000/month at scale**

**Alternative: Supabase Storage (if already using Supabase)**
- Makes sense if you're using Supabase Auth + Database
- Image optimization built-in (Pro plan only, $25/month)
- All-in-one solution reduces complexity
- Trade-off: Higher cost but unified platform

**Implementation Strategy:**

**Option 1: R2 + Cloudflare Images (Recommended for heavy media use)**
1. Store original photos/videos in Cloudflare R2
2. Use Cloudflare Images ($5/month for 100K images) for on-the-fly optimization
3. Deliver through Cloudflare CDN (free)
4. Total cost: ~$6.50/month for optimized media delivery

**Option 2: Supabase Storage (Recommended if using Supabase ecosystem)**
1. Use Supabase Pro plan ($25/month)
2. Get storage + auth + database + image transformations
3. Smart CDN included
4. Simpler implementation, higher cost

**Option 3: R2 + Custom Optimization (Most cost-effective)**
1. Store in Cloudflare R2 ($1.50/month)
2. Use open-source image optimization (sharp, imgproxy) in your backend
3. Cache optimized images in R2
4. Deliver through Cloudflare CDN (free)
5. Most work but cheapest option

**Why not Backblaze B2:**
- While B2 has cheapest storage ($0.006/GB), egress costs add up
- R2's zero egress makes it cheaper once you factor in CDN delivery
- Exception: If using BunnyCDN partnership for free egress, B2 becomes competitive

---

## 4. Analytics

### Services Compared
- PostHog
- Plausible
- Mixpanel
- Amplitude
- Google Analytics

### Free Tier Comparison

| Service | Free Tier | Data Retention | Key Features |
|---------|-----------|----------------|--------------|
| **PostHog** | 1M events/mo + 5K replays + 1M flags | 1 year | All-in-one platform |
| **Mixpanel** | 1M events/mo | Unlimited | Behavioral analytics |
| **Plausible** | Self-hosted free, $9/mo cloud | Unlimited | Privacy-focused, lightweight |
| **Amplitude** | 10M events/mo (deprecated in 2024) | Variable | Product analytics |
| **Google Analytics** | Unlimited | 14 months (GA4) | Free but privacy concerns |

### Detailed Feature Comparison

**PostHog (Recommended):**
- **Free tier**: 1M analytics events, 5,000 session replays, 1M feature flag requests/month
- **Pricing after free**: $0.00005/event, $0.005/replay, $0.0001/flag request
- **Included**: Analytics, session replay, feature flags, A/B testing, surveys
- **Data retention**: 1 year on free tier
- **Team members**: Unlimited
- **Privacy**: Self-hostable, GDPR compliant
- **Special**: 90%+ of users never pay anything

**Mixpanel:**
- **Free tier**: 1M events/month
- **Data retention**: Unlimited on free tier (major advantage)
- **Focus**: Behavioral analytics, funnels, retention
- **UI**: Polished, user-friendly
- **Privacy**: GDPR compliant

**Plausible:**
- **Pricing**: Self-hosted free, cloud starts at $9/month
- **Script size**: <1KB (~45x smaller than Google Analytics)
- **Privacy**: No cookies, no personal data, no banner required
- **Focus**: Simple web analytics, not product analytics
- **Best for**: Marketing sites, blogs, privacy-focused projects

### Privacy Considerations for Couples App

A couples app handles sensitive relationship data, so privacy is critical:

**PostHog Advantages:**
- Can be self-hosted for complete data control
- GDPR compliant out of the box
- Transparent data handling
- User data stays in your infrastructure (if self-hosted)

**Plausible Advantages:**
- Cookie-less tracking
- No personal data collection
- No GDPR banner required
- Lightweight (better performance)

### Recommendation: POSTHOG

**Why:**
- **Most generous free tier**: 1M events + session replays + feature flags
- **All-in-one**: Replace 3-4 tools with one platform
- **Cost effective**: 90%+ of users stay on free tier
- **Session replay**: Critical for debugging user issues in couples app
- **Feature flags**: Essential for rolling out features to couples gradually
- **A/B testing**: Test relationship features with different couple segments
- **Privacy-friendly**: Can self-host or use EU cloud

**Cost Projection:**
- **0-1M events/month**: $0 (free tier)
- **5M events/month**: ~$250/month (still cheaper than Mixpanel + separate replay tool)
- **Session replays alone** save you from needing FullStory ($39+/month)

**Alternative: Plausible (for privacy-first approach)**
- Use if privacy is your primary selling point
- Self-host for free or pay $9/month
- Much simpler but fewer features
- Trade-off: No session replay, no feature flags

**Implementation Strategy:**

**For MVP/Early Stage:**
1. Start with PostHog free tier
2. Track essential events: sign up, partner link, photo upload, budget created
3. Use session replay to understand user friction
4. Use feature flags for gradual rollout

**For Privacy-First Approach:**
1. Use Plausible for basic analytics ($9/month or self-hosted)
2. Combine with PostHog self-hosted for session replay only
3. Emphasize privacy in marketing

**Events to Track in Couples App:**
- User registration and authentication
- Partner account linking
- Photo/video uploads
- Budget creation and updates
- Spending alerts triggered
- Event/reminder creation
- Daily check-in completions
- Feature engagement (which features couples use most)

---

## 5. Additional Services

### Error Tracking: Sentry

**Free Tier:**
- 5,000 errors/month
- 50 session replays
- 1 user
- 30-day retention
- Errors dropped (not billed) when limit exceeded

**Paid Plans:**
- Team: $26/month for 50K errors (unlimited users)
- Business: $80/month (longer retention, advanced debugging)

**Recommendation:**
- Start with Sentry free tier for error tracking
- 5,000 errors/month is sufficient for MVP and early growth
- If using PostHog, you already get 5K session replays free
- Consider: Do you need separate error tracking + session replay?

**Alternative Approach:**
- Use PostHog for session replay (5K/month free)
- Use Sentry free tier for error tracking (5K/month free)
- Combined: 10K total issues tracked for $0/month

### Performance Monitoring

**Firebase Performance Monitoring:**
- Free for iOS and Android apps
- Built into Firebase SDK
- Automatic trace collection
- Custom trace support
- Network request monitoring
- Best for: Apps already using Firebase

**New Relic:**
- 100GB data ingest free monthly
- Full-stack observability
- APM, infrastructure, logs, mobile monitoring
- One full-access user on free tier
- Best for: Complex apps needing comprehensive monitoring

**Recommendation: Firebase Performance Monitoring (if using React Native/Expo)**
- Free and sufficient for mobile app performance monitoring
- Easy integration with iOS/Android
- Automatic network and startup trace collection

**Alternative: New Relic (for full-stack monitoring)**
- Free tier is generous (100GB/month)
- Overkill for early-stage app
- Consider for later when backend performance becomes critical

### Content Delivery Network (CDN)

**Cloudflare CDN:**
- **Free tier**: Yes
- **Bandwidth**: Unlimited
- **Features**: DDoS protection, WAF, SSL, DNS
- **Best for**: Most use cases, especially with R2

**BunnyCDN:**
- **Pricing**: $1/month minimum + $0.005/GB (NA/EU)
- **Cost example**: 1TB = ~$5/month
- **Best for**: High bandwidth needs (cheaper than AWS CloudFront)
- **Integration**: Free egress from Backblaze B2

**Recommendation: Cloudflare CDN (Free)**
- Pairs perfectly with R2 storage (zero egress fees)
- Free tier includes everything you need
- Excellent performance globally
- Only upgrade to BunnyCDN if you have specific needs Cloudflare doesn't meet

---

## Complete Tech Stack Recommendation

### Option 1: Supabase-First Stack (Easiest Implementation)

**Services:**
- **Auth**: Supabase Auth (50K MAU free)
- **Database**: Supabase PostgreSQL (included)
- **Storage**: Supabase Storage (Pro plan for image optimization)
- **Push**: Expo Push Notifications (free)
- **Analytics**: PostHog (1M events free)
- **Errors**: Sentry (5K errors free)
- **Performance**: Firebase Performance (free)

**Monthly Cost (MVP):**
- Supabase Pro: $25/month (auth + database + storage with image optimization)
- All others: $0/month
- **Total: $25/month**

**When to scale up:**
- Supabase: When you exceed 50K MAU or 100GB storage
- PostHog: When you exceed 1M events/month
- Push notifications remain free

**Pros:**
- Simplest implementation
- Everything in one platform (except analytics)
- Excellent developer experience
- Built-in image optimization

**Cons:**
- Storage costs more than R2
- Locked into Supabase ecosystem
- Higher costs at scale for media-heavy apps

### Option 2: Cost-Optimized Stack (Lowest Long-term Cost)

**Services:**
- **Auth**: Supabase Auth (50K MAU free)
- **Database**: Supabase PostgreSQL (free tier or Pro)
- **Storage**: Cloudflare R2 ($0.015/GB) + Cloudflare CDN (free)
- **Image Optimization**: Cloudflare Images ($5/month for 100K images) or self-hosted
- **Push**: Expo Push Notifications (free)
- **Analytics**: PostHog (1M events free)
- **Errors**: Sentry (5K errors free)
- **Performance**: Firebase Performance (free)

**Monthly Cost (MVP):**
- Supabase: $0 (free tier database) or $25 (Pro)
- Cloudflare R2: ~$1.50/month (100GB storage + 500GB egress)
- Cloudflare Images: $5/month (optional, for optimization)
- All others: $0/month
- **Total: $6.50/month (free DB) or $31.50/month (Pro DB)**

**When to scale up:**
- R2 costs scale linearly with storage (predictable)
- Supabase: When you exceed free tier
- PostHog: When you exceed 1M events/month

**Pros:**
- Lowest storage/CDN costs at scale
- Zero egress fees (huge savings for media)
- Pay only for what you use
- Could save $500-1000/month at scale

**Cons:**
- More services to manage
- Requires custom image optimization or Cloudflare Images
- Slightly more complex implementation

### Option 3: Firebase-Centric Stack (Fastest to Market)

**Services:**
- **Auth**: Firebase Auth (50K MAU free)
- **Database**: Firestore (50K reads/20K writes daily free)
- **Storage**: Cloudflare R2 (instead of Firebase Storage to save on egress)
- **Push**: Firebase Cloud Messaging (unlimited free)
- **Analytics**: PostHog (1M events free) or Firebase Analytics (free)
- **Errors**: Sentry (5K errors free)
- **Performance**: Firebase Performance (free)

**Monthly Cost (MVP):**
- Firebase: $0/month (on free Spark plan)
- Cloudflare R2: ~$1.50/month
- **Total: $1.50/month**

**Pros:**
- Fastest implementation (integrated mobile SDKs)
- Great mobile developer experience
- Free Firebase services cover most needs
- Strong community and documentation

**Cons:**
- Firebase costs can grow unpredictably at scale
- Less flexible than Supabase for complex queries
- Vendor lock-in to Google ecosystem
- Would need to migrate from Firestore if you need complex relational data

---

## Superseded Final Recommendation: Supabase-First Stack (Option 1)

> Do not implement this Supabase-first stack. The accepted stack is Neon Postgres + Railway backend + Clerk + Cloudflare R2 + Expo Push. See the [current architecture decision](../architecture/neon-railway-architecture.md).

**For an indie developer building a couples app, go with Option 1 (Supabase-First Stack):**

### Why This Stack:

1. **Simplest to build**: One platform for auth, database, and storage
2. **Best developer experience**: Supabase has excellent TypeScript support, real-time subscriptions
3. **Privacy controls**: Built-in Row Level Security perfect for couples app
4. **Reasonable cost**: $25/month is manageable for indie developers
5. **Room to grow**: Can handle 50K users before costs increase
6. **Image optimization included**: Save development time

### Services Summary:

- **Authentication**: Supabase Auth
  - 50K MAU free, $0.00325/MAU after
  - Social auth (Google, Apple) included
  - Manual account linking for couples
  - Row Level Security for privacy

- **Push Notifications**: Expo Push Notifications (if using React Native/Expo)
  - Free unlimited notifications
  - Only cost: Apple Developer account ($99/year)
  - Alternative: FCM if not using Expo

- **Storage**: Supabase Storage
  - Pro plan: $25/month (includes 100GB)
  - Image optimization built-in
  - Smart CDN included
  - Alternative: Switch to R2 later if storage costs become significant

- **Analytics**: PostHog
  - 1M events/month free
  - Session replay included (5K/month)
  - Feature flags for gradual rollouts
  - A/B testing included

- **Error Tracking**: Sentry
  - 5K errors/month free
  - 50 replays/month
  - Sufficient for MVP

- **Performance**: Firebase Performance Monitoring
  - Free for iOS/Android
  - Easy integration

### Migration Path When You Scale:

1. **If storage costs grow** (500GB+):
   - Migrate media to Cloudflare R2
   - Keep Supabase for auth/database
   - Save significantly on egress

2. **If you exceed 50K MAU**:
   - You're making revenue at this point
   - Supabase costs $162/month at 100K users
   - Still 6x cheaper than Clerk

3. **If analytics grow**:
   - PostHog charges $0.00005/event after 1M
   - 5M events = ~$200/month
   - Still cheaper than alternatives

### Total Cost Projection:

**Month 1-12 (MVP to Early Growth):**
- Supabase Pro: $25/month
- Apple Developer: $99/year (~$8/month)
- Everything else: Free
- **Total: ~$33/month**

**At 10K users:**
- Same as above: ~$33/month

**At 50K users (free tier limit):**
- Same as above: ~$33/month

**At 100K users:**
- Supabase: $187/month ($25 base + $162 for 50K extra MAU)
- Apple Developer: $8/month
- PostHog: Likely still free (1M events)
- **Total: ~$195/month**

**At 100K users with heavy media usage (500GB egress/month):**
- Consider migrating to R2: $31.50/month (R2 + Images + Supabase Pro)
- Save: ~$163/month

---

## Key Takeaways

1. **Start simple**: Use the accepted Neon + Railway stack; this Supabase-first comparison is retained only for context
2. **Optimize later**: Migrate to R2 only when storage costs become significant
3. **Leverage free tiers**: You can build to 50K users on ~$33/month
4. **Plan for privacy**: Supabase RLS is perfect for couples app privacy controls
5. **Session replay is valuable**: PostHog's free session replay helps debug relationship-sensitive features
6. **Monitor costs**: Set up billing alerts on all services

---

## Sources

### Authentication Research
- [Clerk vs Auth0 vs Supabase: Pricing & DX Compared](https://designrevision.com/blog/auth-providers-compared)
- [FastAPI Authentication 2026: Auth0 vs Supabase vs Clerk vs Firebase](https://medium.com/@rameshkannanyt0078/fastapi-authentication-2026-auth0-vs-supabase-vs-clerk-vs-firebase-full-benchmark-cost-b8844977fff4)
- [Supabase Auth vs Clerk in 2026: Honest Verdict](https://www.iloveblogs.blog/guides/supabase-auth-vs-clerk-2026-honest-comparison)
- [Auth & Identity Comparison 2026](https://agentdeals.dev/auth-comparison-2026)
- [Identity Linking | Supabase Docs](https://supabase.com/docs/guides/auth/auth-identity-linking)
- [Supabase Auth: Identity Linking, Hooks, and HaveIBeenPwned integration](https://supabase.com/blog/supabase-auth-identity-linking-hooks)
- [Auth0 vs Clerk: Which CIAM Wins in 2026?](https://guptadeepak.com/ciam-compass/compare/auth0-vs-clerk/)
- [Clerk vs Auth0 for Solo Developers (2026)](https://solodevstack.com/blog/clerk-vs-auth0-solo-developers)

### Push Notifications Research
- [7 Best Firebase Cloud Messaging Alternatives (2026)](https://www.magicbell.com/blog/firebase-cloud-messaging-service-alternatives)
- [Firebase vs OneSignal: Which Push Service Fits Your App (2026)](https://www.suprsend.com/post/firebase-vs-onesignal)
- [Expo vs OneSignal Push: Push Provider Comparison (2026)](https://www.courier.com/integrations/compare/expo-vs-onesignal-push)
- [How to Set Up Expo Push Notifications in React Native (2026)](https://www.suprsend.com/post/expo-push-notifications)
- [Expo App Development Costs in 2026: EAS Pricing, Build Costs & Hidden Fees](https://www.metacto.com/blogs/the-true-cost-of-expo-app-development-a-comprehensive-guide)
- [OneSignal Pricing 2026](https://www.buildmvpfast.com/tools/api-pricing-estimator/onesignal)

### Storage Research
- [Cloudflare R2 vs Backblaze B2: Which Object Storage Should You Choose in 2026](https://themedev.net/blog/cloudflare-r2-vs-backblaze-b2/)
- [Cloudflare R2 vs S3 vs Backblaze B2: $0 Egress [2026]](https://tech-insider.org/cloudflare-r2-vs-s3-vs-backblaze-b2-2026/)
- [Cheapest Cloud Storage 1TB-2TB 2026: 8 Compared](https://leanopstech.com/blog/cheapest-cloud-object-storage-1tb-2tb-comparison-2026/)
- [Supabase Storage v2: Image resizing and Smart CDN](https://supabase.com/blog/storage-image-resizing-smart-cdn)
- [Storage Image Transformations | Supabase Docs](https://supabase.com/docs/guides/storage/serving/image-transformations)
- [Storage & CDN Comparison 2026](https://agentdeals.dev/storage-comparison-2026)
- [Cloudflare R2 vs AWS S3 vs Backblaze B2 for Indie Hackers in 2026](https://devtoolpicks.com/blog/cloudflare-r2-vs-aws-s3-vs-backblaze-b2-indie-hackers-2026)
- [Firebase Storage vs AWS S3 vs Cloudflare R2 alternatives](https://kitemetric.com/blogs/top-cloud-storage-alternatives-to-firebase-free-and-powerful-options)

### CDN Research
- [Bunny CDN vs Cloudflare (2026)](https://shyft.ai/tools/compare/bunny-cdn-vs-cloudflare)
- [Cloudflare vs Bunny CDN: CDN Comparison 2026](https://vigilbase.com/cloudflare/vs/bunny-cdn)
- [Bunny CDN vs Cloudflare: Speed, Pricing & Features for 2026 Sites](https://affinco.com/bunny-cdn-vs-cloudflare/)
- [Bunny.net vs Cloudflare 2026: CDN, Storage & Stream Pricing](https://www.kunalganglani.com/blog/bunnynet-vs-cloudflare-2026)

### Analytics Research
- [PostHog vs Mixpanel in-depth tool comparison](https://posthog.com/blog/posthog-vs-mixpanel)
- [Analytics & Product Analytics Free Tier Comparison 2026](https://agentdeals.dev/analytics-free-tier-comparison-2026)
- [PostHog vs Plausible vs Fathom vs Mixpanel for Solo Developers in 2026](https://devtoolpicks.com/blog/posthog-vs-plausible-vs-fathom-vs-mixpanel-2026)
- [PostHog Free Tier 2026: Limits, Pricing & What Changed](https://agentdeals.dev/vendor/posthog)
- [PostHog Pricing 2026: Free Tier, Real Costs at Scale](https://userorbit.com/blog/posthog-pricing-guide)

### Error Tracking & Performance Monitoring
- [Sentry Pricing 2026: Plans, Costs & How to Reduce Your Bill](https://last9.io/blog/sentry-pricing/)
- [Sentry Pricing 2026: Complete Cost Guide & Alternatives](https://blog.struct.ai/sentry-pricing-error-monitoring-2026/)
- [10 Best Mobile App Performance Testing Tools in 2026](https://www.getpanto.ai/blog/mobile-app-performance-testing-tools)
- [12 best application performance monitoring tools for 2026](https://www.guideflow.com/blog/application-performance-monitoring-tools)
- [The 8 Best Application Performance Monitoring (APM) Tools in 2026](https://rollbar.com/blog/best-apm-tools/)
