# Backend Infrastructure Research for Mobile Couples App

**Project Requirements:**
- Real-time sync between two users
- Complex relational data (calendars, timelines, budgets, places, memories)
- Privacy controls (separate + shared data)
- File storage (photos, videos)
- User authentication
- Push notifications
- Scalability for future growth
- Bootstrapped project prioritizing ease of development and low initial costs

---

## Executive Summary

> **Decision update (August 14, 2026):** This research compared several backend platforms. Its Supabase recommendation is superseded. Tether will use **Neon Postgres** for the database and **Railway** for the API, jobs, authorization, and real-time gateway. See the [current architecture decision](../architecture/neon-railway-architecture.md).

**Current recommended stack: Neon Postgres + Railway backend**

This split gives Tether standard PostgreSQL plus Neon branches and schema diffs for safe migrations, without coupling the database to the application runtime. Railway owns the API surface, background work, and real-time delivery. Authentication and media storage are separate services.

**Alternative for MVP/Low Budget: PocketBase**
- Zero infrastructure costs (self-hosted)
- Single binary deployment
- Built-in real-time, auth, and file storage
- Perfect for initial prototype or indie developers
- Can migrate to Supabase when scaling needs increase

---

## 1. Backend Options Comparison

### 1.1 Supabase (PostgreSQL-based BaaS)

#### Overview
Open-source Firebase alternative built on PostgreSQL, offering real-time subscriptions, authentication, storage, and edge functions.

#### Pricing
**Free Tier:**
- Database: 500 MB storage
- Bandwidth: 2 GB/month
- Monthly Active Users: 50,000
- Real-time: 200 concurrent connections + 2 GB bandwidth
- Storage: 1 GB
- Edge Functions: 500,000 invocations

**Pro Plan:** $25/month
- 8 GB database
- 50 GB bandwidth
- 100K MAU
- Daily backups
- Priority support

#### Real-time Capabilities
- WebSocket-based subscriptions to database changes
- Respects Row Level Security (RLS) policies automatically
- Clients receive only change events for rows they can SELECT
- No additional setup required for secure real-time
- Perfect for shared calendars, live budgets, and collaborative features

#### Offline Sync
- Limited native offline support (major weakness)
- Requires third-party solutions or custom implementation
- Not as robust as Firebase for offline-first mobile apps

#### Developer Experience
- **Excellent:** Auto-generated REST and GraphQL APIs
- TypeScript support: `supabase gen types typescript` generates types from schema
- Intuitive dashboard with built-in SQL editor
- Comprehensive documentation
- Local development with Docker Compose

#### Privacy & Data Ownership
- **Exceptional:** PostgreSQL Row Level Security (RLS)
- Database-level access control (not application-level)
- Perfect for couples app with separate/shared data model
- Example policies:
  ```sql
  -- User can only see their own private data
  CREATE POLICY "Users see own data" ON private_memories
    FOR SELECT USING (auth.uid() = user_id);

  -- Both partners can see shared data
  CREATE POLICY "Partners see shared data" ON shared_calendar
    FOR SELECT USING (
      auth.uid() = partner1_id OR auth.uid() = partner2_id
    );
  ```
- Self-hosting option available (Docker Compose)
- Open-source codebase

#### Scalability
- Built on PostgreSQL (proven at massive scale)
- Horizontal scaling available on paid plans
- Connection pooling with PgBouncer
- Read replicas on higher tiers
- Suitable for millions of users

#### File Storage
- S3-compatible object storage
- Image transformations built-in
- CDN delivery
- Configurable access policies
- Resumable uploads for large files

#### Authentication
- Multiple providers: Email/password, magic links, OAuth (Google, Apple, GitHub, etc.)
- Row Level Security integration
- JWT-based sessions
- Multi-factor authentication

#### Push Notifications
- Not built-in (weakness)
- Requires third-party services (OneSignal, FCM, APNs)
- Can trigger via Edge Functions or webhooks

#### Best For
- Web and mobile apps with relational data
- Projects requiring complex queries and joins
- Teams with SQL experience
- Apps needing fine-grained privacy controls
- Production-ready applications

#### Drawbacks
- Offline sync not as mature as Firebase
- Self-hosting requires ~6 Docker containers
- Push notifications require external services
- Steeper learning curve than Firebase for beginners

---

### 1.2 Firebase (Google's BaaS)

#### Overview
Google's comprehensive Backend-as-a-Service with Firestore (NoSQL), real-time sync, authentication, storage, and extensive mobile SDKs.

#### Pricing
**Spark Plan (Free):**
- Firestore storage: 1 GB
- Document reads: 50,000/day
- Document writes: 20,000/day
- Document deletes: 20,000/day
- Network egress: 10 GB/month
- Cloud Storage: 5 GB
- Authentication: Unlimited users

**Blaze Plan (Pay-as-you-go):**
- $0.18 per GB stored/month
- $0.06 per 100K document reads
- $0.18 per 100K document writes
- Can become expensive at scale

#### Real-time Capabilities
- **Industry-leading:** Firestore real-time listeners
- Automatic client synchronization
- Listener pattern for live updates
- Optimized for chat, dashboards, collaborative apps
- Low latency

#### Offline Sync
- **Best-in-class:** Automatic offline persistence
- SDKs cache documents locally
- Apps work fully offline (read, write, listen)
- Automatic sync when reconnected
- Conflict resolution handled by SDK
- Critical advantage for mobile apps

#### Developer Experience
- **Excellent for mobile:** Mature native SDKs (iOS, Android, Flutter)
- No schema design required (NoSQL)
- Powerful local emulator suite
- Great documentation and community
- Firebase Admin SDK for server operations
- Faster initial development (no schema planning)

#### Privacy & Data Ownership
- **Security Rules:** JavaScript-like rules language
- Not as robust as PostgreSQL RLS
- More application-level than database-level
- Example:
  ```javascript
  match /privateMemories/{memoryId} {
    allow read, write: if request.auth.uid == resource.data.userId;
  }
  match /sharedCalendar/{eventId} {
    allow read, write: if request.auth.uid in resource.data.partnerIds;
  }
  ```
- Closed-source, cloud-only (no self-hosting)
- Vendor lock-in with Google

#### Scalability
- Proven at Google scale (millions of users)
- Automatic scaling
- No infrastructure management
- Multi-region replication
- High availability

#### File Storage
- Cloud Storage (Google Cloud Storage)
- Resumable uploads
- Security rules integration
- Image optimization via Cloud Functions
- CDN available

#### Authentication
- Comprehensive: Email/password, phone, OAuth (Google, Apple, Facebook, GitHub, etc.)
- Anonymous authentication
- Custom auth integration
- Multi-factor authentication

#### Push Notifications
- **Built-in:** Firebase Cloud Messaging (FCM)
- Native support for iOS and Android
- Topics and device groups
- Analytics integration
- Major advantage over competitors

#### Best For
- Mobile-first applications
- Apps requiring robust offline functionality
- Teams without database design experience
- Rapid prototyping and MVP development
- Projects with Google Cloud budget

#### Drawbacks
- **Cost:** Can become very expensive at scale
- NoSQL limitations for complex relational queries
- Vendor lock-in (no self-hosting)
- Less suitable for complex data relationships
- Firestore's document model requires denormalization

---

### 1.3 Appwrite (Open-Source BaaS)

#### Overview
Open-source backend-as-a-service bundling authentication, databases, storage, functions, messaging, and real-time capabilities. Self-hostable via Docker.

#### Pricing
**Free (Self-Hosted):**
- Unlimited usage (limited only by server capacity)
- Full feature set
- Complete control

**Cloud Free Tier:**
- 75K monthly active users
- Unlimited projects
- All core features included

**Pro Plan:** $15/month per organization member
- More storage and bandwidth
- Priority support
- Advanced features

**Scale Plan:** $599/month
- Dedicated resources
- SOC 2 compliance
- Enterprise support

#### Real-time Capabilities
- WebSocket-based real-time subscriptions
- Subscribe to database changes, authentication events
- Built-in support across collections

#### Offline Sync
- Not built-in (requires custom implementation)
- Similar to Supabase in this regard

#### Developer Experience
- Good documentation
- SDKs for 13+ languages (Node.js, Python, Dart, Flutter, etc.)
- Docker-based deployment
- Web-based admin dashboard
- Self-hosted option provides full control

#### Privacy & Data Ownership
- **Excellent (Self-hosted):** Full data ownership
- Collection-level permissions
- Team-based access control
- Open-source (40K+ GitHub stars)
- Privacy score: 87/100

#### Scalability
- Depends on infrastructure (self-hosted)
- Cloud version handles scaling automatically
- Suitable for medium-scale applications
- May require DevOps expertise for large scale

#### File Storage
- Built-in file storage
- Image transformations
- File encryption
- Compression

#### Authentication
- 30+ OAuth providers
- Email/password, magic links, phone
- Team invitations
- Anonymous sessions

#### Push Notifications
- **Built-in messaging service:** Push notifications, emails, SMS
- Major advantage over Supabase
- Configured through dashboard

#### Best For
- Privacy-focused applications
- Teams wanting data ownership
- Projects with DevOps resources
- Open-source enthusiasts
- European companies (GDPR compliance)

#### Drawbacks
- Smaller community than Firebase/Supabase
- Self-hosting requires Docker expertise
- Less mature than Firebase
- Document-based database (not relational)
- Limited real-world production case studies

---

### 1.4 PocketBase (Simple, Self-Hosted)

#### Overview
Open-source backend in a single executable file. Uses SQLite, includes real-time subscriptions, authentication, file management, and admin dashboard.

#### Pricing
**Free (Always):**
- 100% open-source
- No cloud offering (self-hosted only)
- Zero recurring costs
- Limited only by server capacity

#### Real-time Capabilities
- **Built-in WebSocket subscriptions**
- Every database change broadcasts to connected clients
- Automatic REST and real-time APIs per collection
- Perfect for collaborative apps

#### Offline Sync
- Not built-in
- Requires custom implementation
- SQLite foundation makes offline-first patterns possible

#### Developer Experience
- **Exceptional for simplicity:** Single binary file
- No Docker required (though Docker supported)
- No database server setup
- No dependencies to install
- Admin dashboard included
- REST API auto-generated
- JavaScript/Dart/Go SDKs

#### Privacy & Data Ownership
- **Complete ownership:** Self-hosted only
- Zero vendor lock-in
- All data stored locally
- Collection-level rules
- Custom validation logic

#### Scalability
- **Limited:** SQLite-based (single file database)
- Suitable for small to medium apps (thousands of users)
- Not designed for millions of users
- Vertical scaling only (better server hardware)
- Perfect for MVPs, prototypes, indie projects

#### File Storage
- Built-in file management
- Local filesystem storage
- S3 integration possible via plugins

#### Authentication
- Email/password
- OAuth2 providers (Google, GitHub, etc.)
- Auth tokens and refresh tokens

#### Push Notifications
- Not built-in
- Requires external service integration

#### Best For
- MVPs and prototypes
- Hackathons and indie projects
- Small production apps (< 10K users)
- Developers wanting simplicity
- Budget-conscious projects

#### Drawbacks
- SQLite limitations (not for massive scale)
- Self-hosting only (no managed option)
- Smaller ecosystem and community
- Less suitable for enterprise applications
- No built-in push notifications

---

### 1.5 Custom Backend (Node.js/Python + PostgreSQL + Redis)

#### Overview
Build your own backend using frameworks like Express.js, NestJS, FastAPI, or Django with PostgreSQL database and Redis for caching/real-time.

#### Pricing Estimates
**Development Costs:**
- Basic project (8-12 weeks): $15,000 - $40,000
- Medium complexity (18 weeks): £85,000 (~$105,000)
- Complex microservices (32 weeks): £145,000 (~$180,000)

**Infrastructure Costs (Monthly):**
- VPS/Cloud hosting: $20-100/month (DigitalOcean, AWS Lightsail)
- Managed PostgreSQL: $15-50/month
- Redis instance: $10-30/month
- File storage (S3): $5-50/month (usage-based)
- Push notification service: $0-50/month
- **Total:** $50-280/month (scales with usage)

#### Real-time Capabilities
- **Custom implementation required:**
  - WebSockets (Socket.io, WS library)
  - PostgreSQL LISTEN/NOTIFY
  - Redis Pub/Sub for message broadcasting
  - Server-Sent Events (SSE)
- Full control over implementation
- Can optimize for specific use cases

#### Offline Sync
- **Complex custom implementation:**
  - Requires conflict resolution logic
  - Version tracking and operational transforms
  - Significant development effort (weeks/months)
  - High risk of bugs

#### Developer Experience
- **Variable:** Depends on team expertise
- Complete flexibility
- Requires DevOps knowledge
- More code to maintain
- Full debugging control

#### Privacy & Data Ownership
- **Complete control:**
  - PostgreSQL RLS available
  - Custom authorization logic
  - Self-hosted options
  - Full compliance control (GDPR, HIPAA)

#### Scalability
- **Excellent (with proper architecture):**
  - Horizontal scaling with load balancers
  - Database replication and sharding
  - Redis clustering
  - Microservices architecture
  - Requires significant DevOps expertise

#### File Storage
- **Custom integration:**
  - AWS S3, Google Cloud Storage, Cloudflare R2
  - Direct upload implementation
  - Image processing (Sharp, ImageMagick)
  - CDN setup required

#### Authentication
- **Custom implementation or libraries:**
  - Passport.js, NextAuth, Authlib
  - JWT token management
  - OAuth provider integration
  - Session management
  - Security responsibility on you

#### Push Notifications
- **External service integration:**
  - Firebase Cloud Messaging (FCM)
  - Apple Push Notification Service (APNs)
  - OneSignal, Pusher, etc.
  - BullMQ + Redis for job queuing

#### Best For
- Unique/complex requirements not met by BaaS
- Teams with strong backend expertise
- Enterprise applications
- Projects with specific compliance needs
- Long-term strategic applications

#### Drawbacks
- High development cost ($15K-$180K+)
- Long development time (2-8 months)
- Requires DevOps expertise
- Ongoing maintenance burden
- Security responsibility
- Slower time-to-market

---

## 2. Database Comparison

### 2.1 PostgreSQL

**Type:** Relational SQL database

**Strengths:**
- **Ideal for complex relational data:** Perfect for couples app with calendars, budgets, timelines, places, memories
- Strong ACID guarantees
- Powerful JOIN operations for connected data
- Row Level Security (RLS) for privacy controls
- JSONB support for flexible schema portions
- Mature ecosystem (30+ years)
- Extensions: PostGIS (location data), pgvector (AI/embeddings)
- Full-text search
- Transaction support

**Use Cases for Couples App:**
```sql
-- Shared calendar with RLS
CREATE TABLE calendar_events (
  id UUID PRIMARY KEY,
  couple_id UUID REFERENCES couples(id),
  title TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  visibility TEXT CHECK (visibility IN ('shared', 'partner1', 'partner2'))
);

-- Complex queries are natural
SELECT
  ce.title,
  ce.start_time,
  p.name as place_name,
  m.photo_url
FROM calendar_events ce
LEFT JOIN places p ON ce.place_id = p.id
LEFT JOIN memories m ON ce.memory_id = m.id
WHERE ce.couple_id = $1
  AND ce.start_time >= NOW()
ORDER BY ce.start_time;
```

**Drawbacks:**
- Requires schema design upfront
- Less flexible for rapidly changing requirements
- Steeper learning curve than NoSQL

**Best For:** Couples app with structured, relational data and complex privacy requirements

---

### 2.2 MongoDB

**Type:** Document-based NoSQL database

**Strengths:**
- Flexible schema (no migrations)
- Good for rapidly evolving data structures
- Horizontal scaling (sharding)
- Aggregation pipeline for analytics

**Drawbacks for Couples App:**
- **Poor fit for relational data:** Calendars, budgets, timelines are inherently relational
- No native JOIN support (requires application-layer logic)
- Aggregation pipeline less intuitive than SQL
- Higher costs than PostgreSQL alternatives
- Complex data modeling for interconnected entities

**Example of Complexity:**
```javascript
// Without JOINs, you need multiple queries or denormalization
const event = await events.findOne({_id: eventId});
const place = await places.findOne({_id: event.placeId}); // Separate query
const memory = await memories.findOne({_id: event.memoryId}); // Another query

// Or denormalize (duplicate data):
const event = {
  title: "Anniversary Dinner",
  place: { name: "Restaurant", coords: [...] }, // Duplicated
  memory: { photo: "...", note: "..." } // Duplicated
};
```

**Verdict:** Not recommended for couples app due to relational data nature

---

### 2.3 Firestore (Firebase)

**Type:** Document-based NoSQL with real-time sync

**Strengths:**
- **Best offline sync:** Automatic client caching
- Real-time listeners out-of-the-box
- Flexible schema
- Optimized for mobile
- Security rules for access control

**Drawbacks for Couples App:**
- **Challenging for relational data:** Requires denormalization
- No JOIN operations
- Complex queries limited (max 1 range filter, limited inequalities)
- Data duplication required
- Expensive at scale

**Data Modeling Challenges:**
```javascript
// Denormalized structure required
{
  "events": {
    "event1": {
      "title": "Date Night",
      "partners": ["user1", "user2"],
      "placeName": "Restaurant", // Duplicated from places collection
      "placeAddress": "123 Main St", // Duplicated
      "memoryPhotoUrl": "...", // Duplicated from memories
    }
  },
  "places": {
    "place1": {
      "name": "Restaurant",
      "address": "123 Main St",
      "eventsCount": 5 // Manually maintained counter
    }
  }
}
```

**Verdict:** Good for offline-first mobile apps, but relational data modeling is challenging

---

### 2.4 Graph Database (Neo4j)

**Type:** Graph database optimized for relationships

**Strengths:**
- **Exceptional for connected data:** Relationships are first-class citizens
- Fast traversal of complex relationships
- Natural modeling of social/couple connections
- Cypher query language (intuitive for graph queries)

**Use Case Example:**
```cypher
// Find shared memories at places visited together
MATCH (partner1:User)-[:PARTNER_OF]->(partner2:User)
MATCH (partner1)-[:VISITED]->(place:Place)<-[:VISITED]-(partner2)
MATCH (place)-[:HAS_MEMORY]->(memory:Memory)
WHERE memory.shared = true
RETURN place, memory
```

**Drawbacks:**
- Overkill for most couples app features
- Additional database to manage
- Smaller ecosystem than PostgreSQL
- Higher operational complexity
- Learning curve for Cypher query language

**Verdict:** Interesting but unnecessary for couples app. PostgreSQL with proper foreign keys handles relationships well.

---

## 3. Detailed Analysis for Couples App

### 3.1 Data Model Fit

#### Relational Structure (PostgreSQL/Supabase):
```sql
-- Core entities with clear relationships
couples (id, partner1_id, partner2_id, created_at)
users (id, email, name)
calendar_events (id, couple_id, title, date, visibility)
budgets (id, couple_id, month, total_amount)
expenses (id, budget_id, amount, category, paid_by)
places (id, couple_id, name, lat, lng, category)
memories (id, couple_id, place_id, title, date, visibility)
photos (id, memory_id, user_id, storage_path)
timelines (id, couple_id, milestone, date)

-- Privacy with Row Level Security
CREATE POLICY "see_shared" ON memories
  FOR SELECT USING (
    visibility = 'shared' AND
    (auth.uid() = (SELECT partner1_id FROM couples WHERE id = couple_id)
     OR auth.uid() = (SELECT partner2_id FROM couples WHERE id = couple_id))
  );
```

**Advantages:**
- Natural representation of app domain
- Efficient queries across relationships
- Data integrity with foreign keys
- Single source of truth (no duplication)

---

### 3.2 Privacy Requirements

**Requirement:** Separate data (individual) + Shared data (couple)

#### Supabase/PostgreSQL Solution:
```sql
-- Visibility column approach
CREATE TYPE visibility_type AS ENUM ('partner1', 'partner2', 'shared');

ALTER TABLE memories ADD COLUMN visibility visibility_type DEFAULT 'shared';

-- RLS policies enforce privacy at database level
CREATE POLICY "partner1_private" ON memories
  FOR ALL USING (
    visibility = 'partner1' AND
    auth.uid() = (SELECT partner1_id FROM couples WHERE id = couple_id)
  );

CREATE POLICY "partner2_private" ON memories
  FOR ALL USING (
    visibility = 'partner2' AND
    auth.uid() = (SELECT partner2_id FROM couples WHERE id = couple_id)
  );

CREATE POLICY "shared_access" ON memories
  FOR ALL USING (
    visibility = 'shared' AND
    auth.uid() IN (
      SELECT partner1_id FROM couples WHERE id = couple_id
      UNION
      SELECT partner2_id FROM couples WHERE id = couple_id
    )
  );
```

**Rating:** Excellent - Database-level enforcement, automatic with real-time

#### Firebase/Firestore Solution:
```javascript
// Security Rules
match /memories/{memoryId} {
  allow read: if request.auth.uid in resource.data.visibleTo;
  allow write: if request.auth.uid == resource.data.createdBy;
}

// Document structure
{
  "memories": {
    "mem1": {
      "title": "Secret gift planning",
      "visibleTo": ["user1"], // Only partner 1 sees this
      "createdBy": "user1"
    },
    "mem2": {
      "title": "Our anniversary",
      "visibleTo": ["user1", "user2"], // Both partners see
      "createdBy": "user2"
    }
  }
}
```

**Rating:** Good - Application-level enforcement, works but less robust

---

### 3.3 Real-time Sync Requirements

**Requirement:** Both partners see updates instantly (shared calendar, budgets)

#### Supabase:
```javascript
// Subscribe to shared calendar events
const subscription = supabase
  .channel('calendar-changes')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'calendar_events',
    filter: `couple_id=eq.${coupleId}`
  }, (payload) => {
    console.log('Change received!', payload);
    // Update UI automatically
  })
  .subscribe();

// RLS ensures users only receive events they can access
```

**Rating:** Excellent - WebSocket-based, respects RLS automatically

#### Firebase:
```javascript
// Real-time listener
db.collection('calendar_events')
  .where('coupleId', '==', coupleId)
  .onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        console.log('New event:', change.doc.data());
      }
      if (change.type === 'modified') {
        console.log('Modified event:', change.doc.data());
      }
    });
  });
```

**Rating:** Excellent - Industry-leading real-time, automatic offline support

---

### 3.4 File Storage Requirements

**Requirement:** Photos and videos for memories, profile pictures

#### Supabase Storage:
```javascript
// Upload photo
const { data, error } = await supabase.storage
  .from('memory-photos')
  .upload(`${coupleId}/${memoryId}/${photoId}.jpg`, photoFile, {
    cacheControl: '3600',
    upsert: false
  });

// Get public URL with transformations
const { data: { publicUrl } } = supabase.storage
  .from('memory-photos')
  .getPublicUrl(`${coupleId}/${memoryId}/${photoId}.jpg`, {
    transform: {
      width: 800,
      height: 600,
      resize: 'cover'
    }
  });

// Storage policies (RLS for files)
CREATE POLICY "Couple members upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'memory-photos' AND
    (auth.uid() = ... couple member check ...)
  );
```

**Rating:** Excellent - Built-in transformations, CDN, RLS integration

#### Firebase Storage:
```javascript
// Upload photo
const storageRef = ref(storage, `couples/${coupleId}/memories/${memoryId}/photo.jpg`);
await uploadBytes(storageRef, photoFile);

// Get download URL
const url = await getDownloadURL(storageRef);

// Security rules
match /couples/{coupleId}/memories/{memoryId}/{photo} {
  allow read: if request.auth.uid in getCouplePartners(coupleId);
  allow write: if request.auth.uid in getCouplePartners(coupleId);
}
```

**Rating:** Excellent - Mature, well-integrated, resumable uploads

---

## 4. Cost Analysis for Bootstrapped Project

### Scenario: Couples app with 1,000 active couples (2,000 users)

**Assumptions:**
- Each couple creates ~100 calendar events/year
- ~50 memories with photos
- ~200 budget entries
- ~10 MB storage per couple (photos)
- Real-time usage: 4 hours/day per couple

---

### 4.1 Supabase Costs

**Free Tier (sufficient for launch):**
- Database: 500 MB (plenty for 1K couples text data)
- Bandwidth: 2 GB/month (tight but manageable)
- Storage: 1 GB (100 couples with 10MB each)
- MAU: 50,000 (2,000 actual users)

**When to upgrade:** ~100-500 couples
- Bandwidth exceeds 2 GB (file downloads)
- Storage exceeds 1 GB (photos)

**Pro Plan:** $25/month
- 8 GB database
- 50 GB bandwidth
- 100 GB storage
- 100K MAU
- Supports: ~5,000 couples

**Estimated Monthly Cost:**
- 0-500 couples: **$0 (free tier)**
- 500-5,000 couples: **$25 (Pro plan)**
- 5,000+ couples: ~$100-300 (Team/custom)

---

### 4.2 Firebase Costs

**Free Tier (Spark):**
- Firestore: 1 GB storage
- Reads: 50,000/day (1.5M/month)
- Writes: 20,000/day (600K/month)
- Storage: 5 GB

**Estimated usage (1,000 couples):**
- Daily reads: ~100,000 (2x free tier) = $0.60/day = **$18/month**
- Daily writes: ~10,000 (within free tier) = $0
- Storage: 10 GB = **$1.80/month**
- **Total: ~$20-30/month at 1,000 couples**

**Scaling costs (5,000 couples):**
- Reads: 500K/day = **$90/month**
- Writes: 50K/day = **$16/month**
- Storage: 50 GB = **$9/month**
- **Total: ~$115/month**

**At 10,000 couples:**
- Reads: 1M/day = **$180/month**
- Writes: 100K/day = **$32/month**
- Storage: 100 GB = **$18/month**
- **Total: ~$230/month**

**Verdict:** Competitive with Supabase initially, but costs can escalate with heavy real-time usage

---

### 4.3 Appwrite Costs

**Self-Hosted (DigitalOcean Droplet):**
- 2GB RAM, 1 vCPU: **$12/month**
- 4GB RAM, 2 vCPU: **$24/month**
- Storage: Included in droplet

**Cloud Free Tier:**
- 75K MAU (plenty for startup)
- **$0/month** until significant scale

**Cloud Pro:** $15/month per member
- For team of 2 developers: **$30/month**

**Verdict:** Self-hosted is cheapest ($12-24/month), Cloud Free is generous

---

### 4.4 PocketBase Costs

**Self-Hosted Only:**
- VPS (2GB RAM): **$5-12/month** (Hetzner, DigitalOcean)
- Domain: **$10-15/year**
- **Total: ~$6-13/month**

**Cheapest option for indie developers**

**Limitations:**
- Must handle deployments
- SQLite limits at ~10K couples
- No managed backups (DIY)

---

### 4.5 Custom Backend Costs

**Development:** $15,000 - $180,000

**Monthly Infrastructure:**
- VPS/Cloud: $20-100
- Managed PostgreSQL: $15-50
- Redis: $10-30
- S3 storage: $5-50
- Push notifications: $0-50
- **Total: $50-280/month**

**Total First Year:** $15,600 - $183,360 (dev + infrastructure)

**Verdict:** Only for well-funded projects or unique requirements

---

## 5. Recommendation Matrix

### For Your Couples App (Relational Data + Privacy + Real-time)

#### Best Choice: Supabase

**Why:**
1. **PostgreSQL perfect for relational data:** Calendars, budgets, timelines, places naturally modeled with tables and relationships
2. **Row Level Security ideal for privacy:** Database-level enforcement of separate/shared data
3. **Real-time built-in:** WebSocket subscriptions respect RLS automatically
4. **Generous free tier:** Launch with 0-500 couples for free
5. **Excellent DX:** Auto-generated TypeScript types, SQL editor, great docs
6. **Scalability:** PostgreSQL proven at massive scale
7. **File storage included:** Built-in transformations and CDN
8. **Low cost:** $0-25/month for first 5,000 couples

**Drawbacks to Accept:**
- Offline sync requires custom work (use local SQLite + sync library)
- Push notifications need external service (OneSignal free tier: 10K subscribers)

**Implementation Path:**
```
1. Start with Supabase free tier
2. Design PostgreSQL schema with RLS policies
3. Build React Native app with Supabase client
4. Use @supabase/realtime for live updates
5. Integrate OneSignal for push notifications
6. Implement offline support with WatermelonDB or similar
7. Upgrade to Pro ($25/mo) when exceeding free tier limits
```

---

#### Alternative: PocketBase (For MVP/Budget Constraints)

**Why:**
1. **Zero recurring costs:** Self-host on $5/month VPS
2. **Incredibly simple:** Single binary, no DevOps needed
3. **Real-time built-in:** WebSocket subscriptions included
4. **Fast development:** Auto-generated APIs and admin panel
5. **SQLite = offline-friendly:** Can use same database format on client

**When to Choose:**
- Solo developer or very small team
- Extreme budget constraints
- MVP/prototype phase
- Comfortable with self-hosting
- Under 10K couples

**Migration Path:**
```
1. Launch with PocketBase on cheap VPS
2. Validate product-market fit
3. When scaling beyond SQLite limits, migrate to Supabase
4. Data migration script: PocketBase (SQLite) → Supabase (PostgreSQL)
```

---

#### When to Choose Firebase:

**Only if:**
1. Offline-first is absolutely critical (no compromise)
2. Team has zero SQL experience
3. Rapid prototyping speed is priority #1
4. Budget allows for Firebase costs at scale
5. NoSQL data model acceptable

**Drawbacks for Your App:**
- Relational data modeling is awkward
- Costs escalate quickly with heavy real-time usage
- Vendor lock-in with Google
- Data duplication required

---

## 6. Implementation Recommendations

### Historical Stack: Supabase + React Native

**Architecture:**
```
Mobile App (React Native)
  ↓
Supabase Client SDK
  ↓
Supabase Platform
  ├─ PostgreSQL (data with RLS)
  ├─ Realtime (WebSocket subscriptions)
  ├─ Auth (email, OAuth)
  ├─ Storage (photos/videos)
  └─ Edge Functions (serverless logic)

External Services:
  ├─ OneSignal (push notifications)
  └─ WatermelonDB (offline sync)
```

---

### Database Schema Example

```sql
-- Users table (managed by Supabase Auth)
-- Couples relationship
CREATE TABLE couples (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner1_id UUID REFERENCES auth.users(id),
  partner2_id UUID REFERENCES auth.users(id),
  relationship_start_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT different_partners CHECK (partner1_id != partner2_id)
);

-- Calendar events with privacy
CREATE TYPE visibility_enum AS ENUM ('partner1_only', 'partner2_only', 'shared');

CREATE TABLE calendar_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  couple_id UUID REFERENCES couples(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  visibility visibility_enum DEFAULT 'shared',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS policies
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "partner1_private_events" ON calendar_events
  FOR ALL USING (
    visibility = 'partner1_only' AND
    auth.uid() = (SELECT partner1_id FROM couples WHERE id = couple_id)
  );

CREATE POLICY "partner2_private_events" ON calendar_events
  FOR ALL USING (
    visibility = 'partner2_only' AND
    auth.uid() = (SELECT partner2_id FROM couples WHERE id = couple_id)
  );

CREATE POLICY "shared_events" ON calendar_events
  FOR ALL USING (
    visibility = 'shared' AND
    auth.uid() IN (
      SELECT partner1_id FROM couples WHERE id = couple_id
      UNION
      SELECT partner2_id FROM couples WHERE id = couple_id
    )
  );

-- Budget tracking
CREATE TABLE budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  couple_id UUID REFERENCES couples(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  total_budget DECIMAL(10, 2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  budget_id UUID REFERENCES budgets(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  paid_by UUID REFERENCES auth.users(id),
  date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Places
CREATE TABLE places (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  couple_id UUID REFERENCES couples(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  category TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Memories
CREATE TABLE memories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  couple_id UUID REFERENCES couples(id) ON DELETE CASCADE,
  place_id UUID REFERENCES places(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  memory_date DATE,
  visibility visibility_enum DEFAULT 'shared',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE memory_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  memory_id UUID REFERENCES memories(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Timeline milestones
CREATE TABLE timeline_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  couple_id UUID REFERENCES couples(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  icon TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### React Native Integration

```typescript
// supabase.ts
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = 'https://your-project.supabase.co';
const supabaseAnonKey = 'your-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Real-time calendar subscription
const subscribeToCalendar = (coupleId: string, callback: Function) => {
  const subscription = supabase
    .channel('calendar-changes')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'calendar_events',
      filter: `couple_id=eq.${coupleId}`
    }, (payload) => {
      callback(payload);
    })
    .subscribe();

  return () => {
    supabase.removeChannel(subscription);
  };
};

// Fetch shared events (RLS automatically filters)
const fetchCalendarEvents = async (coupleId: string) => {
  const { data, error } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('couple_id', coupleId)
    .order('start_time', { ascending: true });

  return data;
};

// Upload memory photo
const uploadMemoryPhoto = async (memoryId: string, photoFile: File) => {
  const fileExt = photoFile.name.split('.').pop();
  const fileName = `${memoryId}-${Date.now()}.${fileExt}`;

  const { data, error } = await supabase.storage
    .from('memory-photos')
    .upload(fileName, photoFile);

  if (!error) {
    // Save reference in database
    await supabase.from('memory_photos').insert({
      memory_id: memoryId,
      storage_path: data.path
    });
  }

  return data;
};
```

---

### Offline Sync Strategy (For Supabase)

Since Supabase doesn't have automatic offline sync like Firebase:

**Option 1: WatermelonDB (Recommended)**
```typescript
import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { synchronize } from '@nozbe/watermelondb/sync';

const adapter = new SQLiteAdapter({
  schema: schema,
  dbName: 'couples_app',
});

const database = new Database({
  adapter,
  modelClasses: [CalendarEvent, Memory, Place],
});

// Sync with Supabase
const sync = async () => {
  await synchronize({
    database,
    pullChanges: async ({ lastPulledAt }) => {
      const { data } = await supabase
        .from('calendar_events')
        .select('*')
        .gte('updated_at', lastPulledAt);

      return {
        changes: { calendar_events: data },
        timestamp: Date.now(),
      };
    },
    pushChanges: async ({ changes }) => {
      // Push local changes to Supabase
      for (const event of changes.calendar_events.created) {
        await supabase.from('calendar_events').insert(event);
      }
      // Handle updated and deleted...
    },
  });
};
```

**Option 2: Redux Persist + Queue**
- Store data locally with Redux Persist
- Queue mutations when offline
- Sync queue when connection restored

---

### Push Notifications with OneSignal

**Free Tier:** 10,000 subscribers, unlimited notifications

```typescript
// Install: npm install react-native-onesignal
import OneSignal from 'react-native-onesignal';

// Initialize
OneSignal.setAppId('your-onesignal-app-id');

// Set user tag (couple ID)
OneSignal.setExternalUserId(userId);
OneSignal.sendTag('couple_id', coupleId);

// Trigger from Supabase Edge Function
// supabase/functions/send-notification/index.ts
import { createClient } from '@supabase/supabase-js';

Deno.serve(async (req) => {
  const { userId, title, message } = await req.json();

  // Send via OneSignal API
  const response = await fetch('https://onesignal.com/api/v1/notifications', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Deno.env.get('ONESIGNAL_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      app_id: Deno.env.get('ONESIGNAL_APP_ID'),
      filters: [{ field: 'tag', key: 'user_id', relation: '=', value: userId }],
      headings: { en: title },
      contents: { en: message },
    }),
  });

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

---

## 7. Migration Path (Scaling Strategy)

### Phase 1: Launch (0-500 couples)
- **Platform:** Supabase Free Tier
- **Cost:** $0/month
- **Features:** Full app functionality, real-time, auth, storage
- **Notifications:** OneSignal Free (10K subscribers)

### Phase 2: Growth (500-5,000 couples)
- **Platform:** Supabase Pro ($25/month)
- **Cost:** $25-50/month (including OneSignal if needed)
- **Optimizations:**
  - Enable connection pooling
  - Optimize queries (add indexes)
  - Implement caching for read-heavy data

### Phase 3: Scale (5,000-50,000 couples)
- **Platform:** Supabase Team/Custom
- **Cost:** $100-500/month
- **Infrastructure:**
  - Read replicas for query distribution
  - CDN for media delivery (Cloudflare R2)
  - Redis for caching (Upstash free tier → paid)
  - Database indexing optimization

### Phase 4: Enterprise (50,000+ couples)
- **Platform:** Supabase Enterprise or Custom
- **Cost:** $500-2,000+/month
- **Considerations:**
  - Multi-region deployment
  - Dedicated resources
  - Advanced monitoring and analytics
  - Potential microservices architecture

---

## 8. Superseded Final Recommendation

> Do not implement this section's Supabase-first stack. Use the [Neon + Railway architecture decision](../architecture/neon-railway-architecture.md) instead. The platform comparisons below are retained for research context.

### For Your Bootstrapped Couples App:

**Historical conclusion: go with Supabase for production launch. This is superseded by Neon + Railway.**

**Reasoning:**
1. **Perfect data model fit:** PostgreSQL excels at relational data (calendars, budgets, timelines, places, memories)
2. **Privacy-first:** Row Level Security provides database-level privacy enforcement for separate/shared data
3. **Cost-effective:** Free for first 500 couples, then only $25/month
4. **Real-time built-in:** No additional setup for live updates
5. **Excellent DX:** TypeScript types, SQL editor, great documentation
6. **Scalable:** PostgreSQL proven at massive scale
7. **Complete BaaS:** Auth, storage, functions all included
8. **No vendor lock-in:** Self-hosting option available, standard PostgreSQL

**Address Weaknesses:**
- **Offline sync:** Implement with WatermelonDB (~2-3 days development)
- **Push notifications:** OneSignal free tier (10K subscribers, ~1 day integration)

**Total Development Time:**
- Supabase setup: 1 day
- Schema design: 2 days
- RLS policies: 1 day
- React Native integration: 3-5 days
- Offline sync: 2-3 days
- Push notifications: 1 day
- **Total: ~2 weeks** for complete backend integration

**Alternative for Extreme Budget Constraints:**
- Start with **PocketBase** for MVP ($5-12/month VPS)
- Migrate to Supabase when reaching ~5,000 couples or needing PostgreSQL features
- Migration effort: ~1 week (schema conversion + data migration)

**Avoid:**
- Firebase: Poor fit for relational data, higher costs at scale
- Custom backend: $15K-180K development cost, too expensive for bootstrapped project
- MongoDB/Appwrite: Not optimized for relational data model

---

## Sources

- [Supabase vs Firebase Pricing and Real-Time 2026](https://designrevision.com/blog/supabase-vs-firebase)
- [MongoDB vs Firebase vs Supabase for AI Apps 2026](https://www.groovyweb.co/blog/mongodb-vs-firebase-vs-supabase-ai-apps-2026)
- [Appwrite Pricing 2026 Full Breakdown](https://shipsquad.ai/pricing/appwrite)
- [Appwrite Review 2026 Features](https://www.saascompared.com/product/appwrite)
- [PocketBase Open Source Backend Features](https://betterstack.com/community/guides/database-platforms/pocketbase-backend/)
- [PocketBase Review 2026](https://saaslens.app/tools/pocketbase)
- [PostgreSQL vs MongoDB 2026 Comparison](https://tech-insider.org/mongodb-vs-postgresql-2026/)
- [Supabase vs Firebase Developer Experience 2026](https://www.weweb.io/blog/supabase-vs-firebase-comparison-for-web-apps)
- [Firebase vs Supabase for iOS Development 2026](https://medium.com/@bhumibhuva18/firebase-vs-supabase-for-ios-apps-which-backend-should-you-choose-in-2026-26f0e957c1c1)
- [Neo4j Graph Database for Connected Data](https://neo4j.com/blog/graph-data-science/why-graph-data-relationships-matter/)
- [Offline Sync Comparison 2026](https://aunimeda.com/blog/supabase-vs-firebase-vs-pocketbase-2026)
- [Supabase vs Firebase vs PocketBase Production Comparison](https://www.devtoolreviews.com/reviews/supabase-vs-firebase-vs-appwrite-vs-pocketbase-2026)
- [Custom Backend Cost Guide 2026](https://www.mplabs.co.uk/insights/wellness-tech/wellness-app-development-cost-guide)
- [Real-Time Notification System with Node.js and Redis](https://oneuptime.com/blog/post/2026-03-31-redis-how-to-build-a-real-time-notification-system-in-nodejs-with/view)
- [Supabase Row Level Security Guide 2026](https://designrevision.com/blog/supabase-row-level-security)
- [Supabase RLS Best Practices](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices)
- [Best Shared Calendar Apps for Couples 2026](https://cupla.app/blog/the-5-best-shared-calendar-apps-for-couples/)
