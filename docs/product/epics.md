# Tether App - Epic Structure

## Overview
This document outlines the complete epic structure for the Tether relationship tracker app, organized by feature area. Each epic includes user stories and technical subtasks. Epics are marked as either **MVP** (Minimum Viable Product - First Version) or **Later Version**.

---

## Epic 1: User Authentication & Account Setup
**Status: MVP**

### Description
Enable users to create accounts, authenticate securely, and establish their relationship connection within the app.

### User Stories

#### US-1.1: Individual Account Creation
**As a** new user
**I want** to create my own individual account
**So that** I can maintain my personal identity and data separate from my partner

**Subtasks:**
- Implement user registration form with email/password
- Add email verification flow
- Create user authentication service with JWT tokens
- Set up secure password hashing (bcrypt/argon2)
- Build user profile creation flow
- Implement session management
- Add password reset functionality

#### US-1.2: Relationship Connection
**As a** registered user
**I want** to connect my account with my partner's account
**So that** we can share relationship data while maintaining individual profiles

**Subtasks:**
- Create relationship invitation system (send/receive)
- Implement relationship code/link generation
- Build relationship acceptance workflow
- Create relationship entity in database linking two users
- Add relationship status (pending, active, paused, disconnected)
- Implement notification for relationship requests
- Add relationship profile creation on acceptance

#### US-1.3: Secure Login
**As a** returning user
**I want** to securely log into my account
**So that** I can access my personal and shared relationship data

**Subtasks:**
- Build login form with validation
- Implement authentication middleware
- Add "Remember Me" functionality
- Implement session timeout and refresh
- Add multi-device session management
- Build logout functionality
- Implement security alerts for new device logins

---

## Epic 2: Personal & Relationship Profiles
**Status: MVP**

### Description
Allow users to create detailed personal profiles and shared relationship profiles that store preferences, interests, and important information.

### User Stories

#### US-2.1: Personal Profile Creation
**As a** user
**I want** to create and maintain a detailed personal profile
**So that** my partner can better understand my preferences and interests

**Subtasks:**
- Design personal profile data schema
- Build profile editing interface
- Implement fields for interests, hobbies, favorites
- Add fields for clothing/shoe/jewelry sizes
- Create allergies and dislikes section
- Add important personal dates section
- Implement profile photo upload
- Add love languages selection
- Build communication preferences section
- Create validation for profile fields

#### US-2.2: Natural Language Profile Input
**As a** user
**I want** to describe my preferences in natural language
**So that** I can quickly populate my profile without filling out many forms

**Subtasks:**
- Integrate AI service for natural language processing
- Build conversational profile input interface
- Implement entity extraction from natural language
- Create profile field mapping from extracted data
- Add confirmation/review step for extracted information
- Implement edit capability for AI-extracted data
- Build fallback to manual entry

#### US-2.3: Relationship Profile
**As a** couple
**I want** to create a shared relationship profile
**So that** we can document our shared preferences, goals, and important dates

**Subtasks:**
- Design relationship profile data schema
- Build relationship profile interface
- Add anniversary date field
- Implement shared goals section
- Create favorite activities list
- Add date preferences section
- Build traditions tracker
- Implement important places list
- Add communication preferences
- Create relationship boundaries section
- Implement mutual availability tracking

#### US-2.4: Profile Privacy Controls
**As a** user
**I want** to control what personal information is visible to my partner
**So that** I can maintain appropriate privacy boundaries

**Subtasks:**
- Implement field-level privacy settings
- Add visibility toggle (private/shared/summary only)
- Create privacy UI indicators
- Build privacy validation in data access layer
- Implement surprise mode for gift-related fields
- Add temporary privacy (hidden until date)

---

## Epic 3: Calendar System
**Status: MVP**

### Description
Provide a comprehensive calendar that combines both partners' schedules, shared events, dates, and responsibilities.

### User Stories

#### US-3.1: Personal Calendar Management
**As a** user
**I want** to add and manage my personal schedule
**So that** my partner can see when I'm available and busy

**Subtasks:**
- Design event data schema
- Build calendar UI component (month/week/day views)
- Implement event creation form
- Add event editing and deletion
- Create recurring event functionality
- Implement event categories
- Add event visibility controls (private/shared)
- Build event color-coding system
- Implement event search and filtering

#### US-3.2: Shared Events
**As a** user
**I want** to create events that appear on both my and my partner's calendars
**So that** we can coordinate shared activities and dates

**Subtasks:**
- Implement shared event creation
- Add participant selection (individual/shared)
- Build shared event notification system
- Create shared event editing permissions
- Implement conflict detection for shared events
- Add shared event color-coding
- Build shared event filtering view

#### US-3.3: Event Details and Metadata
**As a** user
**I want** to add detailed information to calendar events
**So that** I can track locations, budgets, and other important details

**Subtasks:**
- Add location field with map integration
- Implement notes/description field
- Add budget estimation field
- Create actual spending tracking field
- Build reservation information section
- Add travel time calculation
- Implement reminder settings
- Create linked timeline/task/place functionality
- Add participant list

#### US-3.4: Mutual Free Time Finder
**As a** user
**I want** to easily identify when both my partner and I are free
**So that** we can schedule dates and activities together

**Subtasks:**
- Implement availability analysis algorithm
- Build free time visualization on calendar
- Create mutual availability query function
- Add duration-based free time search
- Implement filters for minimum duration
- Build date-range availability view
- Create AI integration for free time suggestions

#### US-3.5: Calendar Insights
**As a** user
**I want** to see upcoming events, conflicts, and important dates highlighted
**So that** I can stay organized and prepared

**Subtasks:**
- Implement schedule conflict detection
- Build upcoming events dashboard widget
- Create important dates reminder system
- Add busy periods visualization
- Implement financial obligation warnings
- Build missed milestone alerts
- Create calendar summary views

---

## Epic 4: Timeline Management
**Status: MVP**

### Description
Enable users to create and track personal goals, shared goals, habits, and major life events through structured timelines.

### User Stories

#### US-4.1: Personal Timeline Creation
**As a** user
**I want** to create timelines for my personal goals and projects
**So that** I can track my progress and share it with my partner if desired

**Subtasks:**
- Design timeline data schema
- Build timeline creation form
- Implement timeline types (goal, habit, phase, life event)
- Add start/end date fields
- Create progress tracking (percentage)
- Build milestone system
- Implement timeline privacy controls
- Add timeline color-coding
- Create timeline categories

#### US-4.2: Shared Timelines
**As a** couple
**I want** to create shared timelines for our joint goals
**So that** we can track our progress together on shared objectives

**Subtasks:**
- Implement shared timeline creation
- Build collaborative editing permissions
- Add dual progress tracking (individual contributions)
- Create shared milestone system
- Implement shared timeline notifications
- Build celebration triggers for milestones

#### US-4.3: Timeline Progress Tracking
**As a** user
**I want** to update my timeline progress and add check-ins
**So that** I can document my journey and stay accountable

**Subtasks:**
- Build progress update interface
- Implement check-in creation (notes, photos)
- Add progress percentage calculation
- Create milestone completion tracking
- Build progress history view
- Implement progress charts/visualization
- Add photo/note attachments to check-ins

#### US-4.4: Timeline Connections
**As a** user
**I want** to link my timelines to calendar events, expenses, and tasks
**So that** I can see all related information in one place

**Subtasks:**
- Implement timeline-to-calendar linking
- Add timeline-to-expense linking
- Create timeline-to-task linking
- Build linked items view on timeline detail
- Implement bidirectional linking updates
- Create linked item summary cards

#### US-4.5: Timeline Encouragement
**As a** user
**I want** to encourage my partner on their timelines
**So that** I can support their goals without being intrusive

**Subtasks:**
- Build reaction system for timeline updates
- Implement optional encouragement messages
- Add gentle accountability reminders
- Create celebration animations for milestones
- Implement partner notification for timeline updates
- Build opt-out controls for accountability features

---

## Epic 5: Map & Saved Places
**Status: MVP**

### Description
Provide a map-based system for saving, organizing, and discovering places that partners want to visit or remember.

### User Stories

#### US-5.1: Save Places to Map
**As a** user
**I want** to save locations on a map
**So that** I can remember places I want to visit with my partner

**Subtasks:**
- Integrate mapping service (Google Maps/Mapbox)
- Build place search functionality
- Implement place saving interface
- Create custom place addition (manual pin)
- Add place categories (restaurant, bar, park, etc.)
- Implement place photos upload
- Build place notes field
- Add price range indicator
- Create priority/rating system

#### US-5.2: Place Ownership and Interest
**As a** user
**I want** to indicate which places I'm interested in
**So that** we can identify places both partners want to visit

**Subtasks:**
- Implement place ownership tracking (who added)
- Build interest indicator system
- Create color-coding for ownership (Partner A, Partner B, Both)
- Add "like" functionality for partner's places
- Implement filter by interest level
- Build "both partners like" view
- Create visual indicators on map

#### US-5.3: Place Details and Metadata
**As a** user
**I want** to add detailed information to saved places
**So that** I can make informed decisions about visiting them

**Subtasks:**
- Implement estimated date cost field
- Add visit status tracking (visited/unvisited)
- Create visit history log
- Build reservation details section
- Add distance calculation from current location
- Implement travel time estimation
- Create privacy settings for places
- Add category tags
- Build custom notes field

#### US-5.4: Map Filtering and Discovery
**As a** user
**I want** to filter saved places by various criteria
**So that** I can find the perfect location for our current situation

**Subtasks:**
- Build filter by category
- Implement filter by price range
- Create filter by distance/proximity
- Add filter by visit status
- Implement filter by mutual interest
- Build filter by budget compatibility
- Create "within time available" filter
- Add filter by rating/priority

#### US-5.5: Place to Calendar Integration
**As a** user
**I want** to convert saved places into calendar events
**So that** I can plan and schedule visits to locations we've saved

**Subtasks:**
- Implement "add to calendar" from place detail
- Build calendar event pre-population with place data
- Create location linking between calendar and map
- Add reverse linking (calendar event shows on map)
- Implement multi-stop date route creation
- Build travel time integration with calendar

---

## Epic 6: Date Planning
**Status: MVP**

### Description
Provide comprehensive date planning tools that integrate schedules, locations, finances, and preferences to help couples plan meaningful experiences.

### User Stories

#### US-6.1: Manual Date Planning
**As a** user
**I want** to manually plan a date with all details
**So that** I can organize and prepare for quality time with my partner

**Subtasks:**
- Build date plan creation form
- Implement date/time selection
- Add location selection (from saved places or custom)
- Create multi-stop itinerary builder
- Add budget estimation field
- Implement travel time calculation
- Build reservation information section
- Add notes/dress code field
- Create reminder settings
- Implement participant selection

#### US-6.2: AI-Assisted Date Planning
**As a** user
**I want** the AI to suggest date plans based on our constraints
**So that** I can quickly find suitable date options without manual research

**Subtasks:**
- Build AI date planning service
- Implement constraint collection (budget, time, location)
- Create date suggestion algorithm considering:
  - Mutual availability
  - Current location
  - Saved places (unvisited priority)
  - Budget constraints
  - Interests from profiles
  - Weather conditions
  - Past date history
  - Travel time
- Build date plan presentation UI
- Add date plan customization
- Implement date plan confirmation

#### US-6.3: Date Expense Tracking
**As a** user
**I want** to track estimated and actual costs for dates
**So that** I can stay within budget and understand our spending

**Subtasks:**
- Implement estimated cost breakdown (food, activity, transport)
- Add actual cost entry post-date
- Create spending allowance field
- Build payment tracking (who paid)
- Implement cost splitting options
- Add budget impact visualization
- Create expense categorization
- Link expenses to finance system

#### US-6.4: Post-Date Review
**As a** user
**I want** to record feedback and memories after a date
**So that** we can remember what we enjoyed and improve future dates

**Subtasks:**
- Build post-date review prompt
- Implement rating system
- Add "would return" indicator
- Create actual spending entry
- Build photo upload for date memories
- Implement note/journal entry
- Add "both enjoyed" indicator
- Create memory saving functionality
- Link to saved place rating update

#### US-6.5: Date History and Patterns
**As a** user
**I want** to view our date history and patterns
**So that** I can understand what we enjoy and plan better dates

**Subtasks:**
- Build date history list view
- Implement date calendar view
- Create date statistics (frequency, spending)
- Build favorite date types analysis
- Implement location visit tracking
- Add spending trends visualization
- Create date suggestions based on history

---

## Epic 7: Finance & Budgeting
**Status: MVP**

### Description
Provide budgeting and expense tracking tools for personal and shared finances, with special focus on dates, gifts, and relationship expenses.

### User Stories

#### US-7.1: Budget Creation
**As a** user
**I want** to create different types of budgets
**So that** I can manage spending across various categories

**Subtasks:**
- Design budget data schema
- Build budget creation form
- Implement budget types (monthly dates, trips, gifts, bills)
- Add budget amount and time period fields
- Create budget owner/sharing settings
- Implement spending categories within budgets
- Add budget alerts and thresholds
- Build recurring budget functionality

#### US-7.2: Manual Expense Tracking
**As a** user
**I want** to manually log expenses
**So that** I can track spending without connecting my bank account

**Subtasks:**
- Build expense entry form
- Implement expense categorization
- Add date and amount fields
- Create expense description/notes
- Implement budget association
- Add payment method tracking
- Build receipt photo upload
- Create expense editing/deletion

#### US-7.3: Date Budget Management
**As a** user
**I want** to manage a monthly date budget
**So that** I can ensure we spend quality time together within our means

**Subtasks:**
- Create date budget type
- Build date budget tracker widget
- Implement spent/remaining visualization
- Add estimated future spending calculation
- Create date plan budget validation
- Build overspending warnings
- Implement budget period reset (monthly)
- Add budget adjustment functionality

#### US-7.4: Shared Expense Splitting
**As a** user
**I want** to split shared expenses with my partner
**So that** we can fairly manage joint costs

**Subtasks:**
- Implement split type selection (equal, percentage, custom)
- Add contribution tracking per partner
- Build "one partner pays" option
- Create alternating payment tracking
- Implement balance calculation
- Add contribution history view
- Create non-competitive display option

#### US-7.5: Budget Insights and Queries
**As a** user
**I want** to ask questions about our spending
**So that** I can make informed financial decisions

**Subtasks:**
- Build budget query AI integration
- Implement spending summary by category
- Create spending comparison (current vs previous periods)
- Add remaining budget calculations
- Build "can we afford" query handler
- Implement spending by partner analysis
- Create budget forecast based on current spending
- Add budget alert generation

#### US-7.6: Financial Privacy Controls
**As a** user
**I want** to control what financial information my partner can see
**So that** I can maintain appropriate financial privacy

**Subtasks:**
- Implement financial data visibility settings
- Add privacy levels (private, total only, by category, full)
- Create temporary privacy (hidden until date)
- Build privacy UI indicators
- Implement privacy validation in queries
- Add privacy controls per budget

---

## Epic 8: Wishlist & Gift Management
**Status: MVP**

### Description
Enable partners to maintain wishlists and manage gift-giving with surprise protection and budget integration.

### User Stories

#### US-8.1: Personal Wishlist Creation
**As a** user
**I want** to maintain a wishlist of items I want
**So that** my partner can find gift ideas that I'll truly enjoy

**Subtasks:**
- Design wishlist item data schema
- Build wishlist item creation form
- Implement product name and link fields
- Add price field
- Create photo upload functionality
- Add size/color/variant fields
- Implement priority/want level indicator
- Create occasion tagging (birthday, anniversary, etc.)
- Add notes field
- Build preferred store field
- Implement alternative options list

#### US-8.2: Wishlist Browsing
**As a** user
**I want** to browse my partner's wishlist
**So that** I can find gift ideas they'll love

**Subtasks:**
- Build wishlist view interface
- Implement filtering by price
- Add filtering by occasion
- Create filtering by priority
- Implement sort by want level
- Add sort by price
- Build search functionality
- Create category filtering

#### US-8.3: Surprise Mode
**As a** user
**I want** to secretly mark items as purchased
**So that** I can surprise my partner without them knowing

**Subtasks:**
- Implement purchase status field (private to purchaser)
- Create "mark as purchased" action
- Build surprise mode visibility rules
- Hide purchase status from wishlist owner
- Implement duplicate purchase prevention
- Add gift planning notes (private)
- Create delivery tracking (private)
- Build surprise location saving

#### US-8.4: Gift Budget Integration
**As a** user
**I want** to connect wishlist items to gift budgets
**So that** I can plan gift purchases within my means

**Subtasks:**
- Link wishlist items to gift budgets
- Implement budget-based filtering
- Create "within budget" indicator
- Add budget impact preview
- Build gift budget tracking
- Implement occasion-based budget allocation

#### US-8.5: Wishlist to Calendar Integration
**As a** user
**I want** to connect wishlist items to important dates
**So that** I can plan gift purchases ahead of time

**Subtasks:**
- Implement wishlist-to-occasion linking
- Add calendar reminder generation
- Create upcoming occasion warnings
- Build gift deadline tracking
- Implement purchase timeline suggestions

---

## Epic 9: Embedded AI System
**Status: MVP**

### Description
Provide a contextual AI assistant accessible throughout the entire app that can understand user intent and perform actions across all features.

### User Stories

#### US-9.1: Universal AI Access
**As a** user
**I want** to access the AI assistant from any screen
**So that** I can quickly accomplish tasks without navigating through menus

**Subtasks:**
- Design persistent AI input interface
- Build text input component
- Implement voice input functionality
- Create contextual action menu integration
- Add floating AI button
- Build AI input modal/drawer
- Implement keyboard shortcuts for AI access

#### US-9.2: Context-Aware AI
**As a** user
**I want** the AI to understand which screen I'm on
**So that** my requests are interpreted correctly based on context

**Subtasks:**
- Implement context detection system
- Build screen/feature context passing
- Create context-specific AI prompts
- Add relevant data injection based on context
- Implement context switching
- Build context clarification dialogs

#### US-9.3: Natural Language Actions
**As a** user
**I want** to perform app actions using natural language
**So that** I can work faster and more intuitively

**Subtasks:**
- Build NLP intent classification
- Implement action mapping from intents
- Create entity extraction for parameters
- Build action handlers for:
  - Calendar event creation/modification
  - Timeline updates
  - Place saving
  - Expense logging
  - Budget queries
  - Date planning
  - Wishlist additions
  - Preference updates
  - Profile modifications
- Implement action confirmation UI
- Add error handling and clarification requests

#### US-9.4: AI Information Retrieval
**As a** user
**I want** to ask the AI questions about my data
**So that** I can quickly get insights without manual searching

**Subtasks:**
- Implement query understanding
- Build data retrieval services
- Create response generation
- Add support for queries about:
  - Spending/budgets
  - Schedule/availability
  - Saved places
  - Timeline progress
  - Wishlist items
  - Upcoming events
  - Date history
  - Profile preferences
- Implement multi-step queries
- Build clarifying question system

#### US-9.5: AI Suggestions and Proactive Help
**As a** user
**I want** the AI to make helpful suggestions
**So that** I can discover opportunities and stay organized

**Subtasks:**
- Build suggestion engine
- Implement suggestion types:
  - Date suggestions
  - Budget warnings
  - Free time identification
  - Nearby place recommendations
  - Timeline milestone reminders
  - Gift ideas
  - Cost-saving opportunities
  - Schedule conflict warnings
- Create suggestion presentation UI
- Add suggestion dismissal/action
- Implement suggestion preferences

#### US-9.6: AI Safety and Confirmation
**As a** user
**I want** the AI to ask for confirmation on important actions
**So that** I don't accidentally perform irreversible or sensitive operations

**Subtasks:**
- Define high-risk action categories
- Build confirmation dialog system
- Implement confirmation for:
  - Purchases
  - Sending messages
  - Creating reservations
  - Moving shared events
  - Changing shared budgets
  - Deleting information
  - Sharing private information
  - Modifying partner's data
- Create clear action preview
- Add cancel/modify options

---

## Epic 10: Privacy & Permissions
**Status: MVP**

### Description
Provide comprehensive privacy controls and permission systems to ensure users maintain autonomy and control over their data.

### User Stories

#### US-10.1: Item-Level Privacy Controls
**As a** user
**I want** to set privacy levels on individual items
**So that** I can control what my partner sees

**Subtasks:**
- Implement privacy field on all entities
- Build privacy selection UI component
- Create privacy levels:
  - Private
  - Shared
  - Summary only
  - Hidden until date
  - Surprise mode
  - Ask before sharing
- Add privacy validation in data access layer
- Create privacy indicators in UI
- Build privacy override system for emergencies

#### US-10.2: Category-Level Privacy
**As a** user
**I want** to set default privacy levels for categories
**So that** I don't have to manually set privacy on every item

**Subtasks:**
- Build privacy settings page
- Implement category privacy defaults
- Create privacy presets/templates
- Add privacy inheritance for new items
- Build privacy rule management
- Implement privacy quick-change actions

#### US-10.3: Shared Action Permissions
**As a** user
**I want** to control what actions my partner can take on shared items
**So that** we can collaborate while maintaining appropriate boundaries

**Subtasks:**
- Design permission levels:
  - No approval required
  - Partner notified
  - Partner approval required
  - Explicit confirmation required
- Implement permission checking system
- Build approval request workflow
- Create notification for permission requests
- Add approval/denial interface
- Implement permission history log

#### US-10.4: Location Privacy
**As a** user
**I want** to control whether my location is shared
**So that** I can maintain privacy when needed

**Subtasks:**
- Implement location sharing toggle
- Build real-time location sharing
- Create location history privacy controls
- Add temporary location sharing (time-limited)
- Implement location-based notification controls

#### US-10.5: AI Data Usage Controls
**As a** user
**I want** to control what information the AI can use
**So that** I can limit AI access to sensitive data

**Subtasks:**
- Build AI data access controls
- Implement data restriction flags
- Create AI context limitation system
- Add AI usage audit log
- Build AI data preference interface

#### US-10.6: Notification Controls
**As a** user
**I want** to control what notifications I receive from my partner
**So that** I can avoid feeling monitored or pressured

**Subtasks:**
- Build notification preferences interface
- Implement notification type toggles
- Add quiet hours configuration
- Create urgency level filtering
- Implement partner reminder controls
- Add AI suggestion notification settings
- Build notification frequency limits

---

## Epic 11: Notifications
**Status: MVP**

### Description
Provide a comprehensive notification system for events, reminders, milestones, and partner actions while respecting user preferences.

### User Stories

#### US-11.1: Event and Reminder Notifications
**As a** user
**I want** to receive notifications for upcoming events and reminders
**So that** I don't forget important activities and commitments

**Subtasks:**
- Build notification service
- Implement notification scheduling
- Create notification types:
  - Upcoming events (customizable lead time)
  - Calendar reminders
  - Timeline milestones
  - Bills/financial deadlines
  - Important dates (anniversaries, birthdays)
  - Reservations
  - Shared tasks due
- Build notification delivery system (push, in-app)
- Implement notification snooze functionality
- Add notification history

#### US-11.2: Progress and Accountability Notifications
**As a** user
**I want** to receive gentle reminders about my timelines
**So that** I can stay on track with my goals

**Subtasks:**
- Implement timeline progress reminders
- Build missed update notifications
- Create milestone celebration notifications
- Add optional partner encouragement notifications
- Implement smart notification timing
- Build notification opt-out controls

#### US-11.3: Budget and Spending Notifications
**As a** user
**I want** to receive alerts when approaching budget limits
**So that** I can manage spending effectively

**Subtasks:**
- Implement budget threshold alerts
- Create overspending warnings
- Build upcoming bill reminders
- Add large purchase notifications
- Implement budget period ending reminders

#### US-11.4: Location-Based Notifications
**As a** user
**I want** to be notified when near saved places
**So that** I can take advantage of nearby opportunities

**Subtasks:**
- Implement geofencing for saved places
- Build proximity notification system
- Add "both partners like" nearby alerts
- Create "unvisited place nearby" notifications
- Implement notification radius configuration

#### US-11.5: Relationship Event Notifications
**As a** user
**I want** to be notified of partner actions and changes
**So that** I can stay informed about shared activities

**Subtasks:**
- Implement partner action notifications:
  - Wishlist updates
  - Shared event creation/modification
  - Timeline updates (if shared)
  - Date plan suggestions
  - Schedule changes
  - Budget updates
- Build notification grouping/batching
- Create digest notifications option
- Add selective notification enablement

---

## Epic 12: AI Memory & Data Controls
**Status: MVP**

### Description
Provide transparency and control over what information the AI remembers and how it uses user data.

### User Stories

#### US-12.1: AI Memory Transparency
**As a** user
**I want** to view everything the AI has remembered about me
**So that** I can understand what data it's using

**Subtasks:**
- Build AI memory dashboard
- Implement memory categorization
- Create memory source tracking (where it came from)
- Add memory timestamp
- Build memory search functionality
- Implement memory filtering by category
- Create memory detail view

#### US-12.2: AI Memory Management
**As a** user
**I want** to edit or delete AI memories
**So that** I can correct errors and remove unwanted information

**Subtasks:**
- Implement memory editing interface
- Build memory deletion functionality
- Create bulk memory deletion
- Add memory correction workflow
- Implement memory merge/consolidation
- Build memory version history

#### US-12.3: AI Memory Restrictions
**As a** user
**I want** to mark certain information as off-limits to AI
**So that** I can keep sensitive data private from AI processing

**Subtasks:**
- Implement "restrict from AI" flag
- Build AI context filtering based on restrictions
- Create restricted data indicator
- Add category-level AI restrictions
- Implement temporary restrictions
- Build AI restriction management interface

#### US-12.4: AI Memory Configuration
**As a** user
**I want** to control how the AI creates memories
**So that** I can prevent unwanted automatic data collection

**Subtasks:**
- Build memory creation preferences
- Implement manual-only memory mode
- Create automatic memory with confirmation
- Add temporary vs permanent memory settings
- Build memory retention period controls
- Implement memory creation audit log

#### US-12.5: Data Export
**As a** user
**I want** to export all my data including AI memories
**So that** I can have a backup and portability

**Subtasks:**
- Build data export functionality
- Implement export format selection (JSON, PDF, CSV)
- Create comprehensive export including:
  - Profile data
  - Calendar events
  - Timelines
  - Places
  - Finances
  - Wishlists
  - AI memories
  - Preferences
- Add export scheduling
- Build export download interface

---

## Epic 13: Data Controls & Ownership
**Status: MVP**

### Description
Provide clear controls for relationship changes, data ownership, and account management including separation scenarios.

### User Stories

#### US-13.1: Relationship Status Management
**As a** user
**I want** to pause or disconnect my relationship connection
**So that** I can manage relationship changes appropriately

**Subtasks:**
- Implement relationship pause functionality
- Build relationship disconnection workflow
- Create relationship status states
- Add reactivation process
- Implement status change notifications
- Build status change confirmation dialogs

#### US-13.2: Data Ownership and Export
**As a** user
**I want** to clearly understand data ownership
**So that** I know what happens to shared data in case of separation

**Subtasks:**
- Define data ownership rules
- Build personal data export
- Implement shared data export
- Create joint data ownership UI
- Add data ownership documentation
- Build separation data handling workflow

#### US-13.3: Data Deletion Controls
**As a** user
**I want** to delete my personal data
**So that** I can remove my information if needed

**Subtasks:**
- Implement personal data deletion
- Build confirmation workflow for deletion
- Create data deletion impact preview
- Add selective deletion options
- Implement deletion audit log
- Build account deletion functionality

#### US-13.4: Shared Data Management on Separation
**As a** couple separating
**I want** to decide what happens to our shared data
**So that** we can fairly manage our shared memories and information

**Subtasks:**
- Build shared data negotiation interface
- Implement shared memory ownership transfer
- Create shared data duplication option
- Add shared place ownership transfer
- Build shared finance record splitting
- Implement shared timeline archiving
- Create mutual agreement workflow

#### US-13.5: Permission Revocation
**As a** user
**I want** to revoke permissions and access
**So that** I can protect my privacy when ending a relationship

**Subtasks:**
- Implement permission revocation
- Build location access removal
- Create notification disabling
- Add data sharing revocation
- Implement immediate access termination
- Build revocation audit log

---

## Epic 14: Memories (Photo/Video Management)
**Status: Later Version**

### Description
Preserve meaningful moments through photos, videos, notes, and automatically generated relationship summaries.

### User Stories

#### US-14.1: Memory Creation
**As a** user
**I want** to save photos, videos, and notes as memories
**So that** I can preserve important moments with my partner

**Subtasks:**
- Design memory data schema
- Build memory creation interface
- Implement photo upload (single and batch)
- Add video upload functionality
- Create note/journal entry
- Implement voice recording upload
- Add memory date/timestamp
- Build memory location tagging
- Create memory categorization

#### US-14.2: Automatic Memory Linking
**As a** user
**I want** memories to automatically connect to related events
**So that** I can see memories in context

**Subtasks:**
- Implement auto-linking to calendar events
- Build auto-linking to map locations
- Create auto-linking to timelines
- Add auto-linking to date plans
- Implement auto-linking to purchases
- Build memory suggestion on event completion

#### US-14.3: Memory Collections
**As a** user
**I want** to organize memories into collections
**So that** I can group related moments together

**Subtasks:**
- Build memory collection creation
- Implement memory tagging
- Create collection types (trip, event, period)
- Add collection cover photo
- Build collection sharing
- Implement collection slideshow

#### US-14.4: Relationship Summaries
**As a** user
**I want** to view automatically generated relationship summaries
**So that** I can reflect on our time together

**Subtasks:**
- Build summary generation service
- Implement monthly recap generation
- Create annual summary
- Add relationship timeline view
- Build favorite places summary
- Create activity frequency analysis
- Implement accomplishment highlights
- Add opt-in/opt-out controls for auto-summaries

#### US-14.5: Memory Search and Discovery
**As a** user
**I want** to search and browse our memories
**So that** I can easily find and relive specific moments

**Subtasks:**
- Build memory search functionality
- Implement filtering by date range
- Add filtering by location
- Create filtering by people
- Implement filtering by category
- Build timeline view of memories
- Create map view of memories
- Add random memory feature

---

## Epic 15: Tasks & Responsibilities
**Status: Later Version**

### Description
Enable couples to manage personal and shared tasks, chores, and responsibilities with optional accountability.

### User Stories

#### US-15.1: Personal Task Management
**As a** user
**I want** to create and track my personal tasks
**So that** I can stay organized and my partner can see my commitments

**Subtasks:**
- Design task data schema
- Build task creation form
- Implement task categories
- Add deadline field
- Create priority levels
- Build task status (todo, in progress, done)
- Implement task notes
- Add recurring task functionality
- Create task reminders

#### US-15.2: Shared Task Management
**As a** user
**I want** to create shared tasks
**So that** we can coordinate household and relationship responsibilities

**Subtasks:**
- Implement shared task creation
- Build task assignment
- Create task ownership
- Add collaborative task completion
- Implement task status sharing
- Build task handoff functionality

#### US-15.3: Task Integration
**As a** user
**I want** tasks to connect with timelines, events, and finances
**So that** I can see all related information together

**Subtasks:**
- Implement task-to-timeline linking
- Build task-to-calendar linking
- Create task-to-expense linking
- Add task dependency system
- Implement task milestone connections

#### US-15.4: Task Lists and Views
**As a** user
**I want** to view tasks in different ways
**So that** I can organize my work effectively

**Subtasks:**
- Build task list view
- Implement task board (kanban)
- Create task calendar view
- Add task filtering (mine, partner's, shared)
- Build task sorting options
- Implement task search

#### US-15.5: Responsibility Requests
**As a** user
**I want** to request help without automatically assigning tasks
**So that** we can communicate needs respectfully

**Subtasks:**
- Build help request functionality
- Implement request notification
- Create request acceptance/decline
- Add request discussion thread
- Build request conversion to task

---

## Epic 16: Check-ins & Emotional Tracking
**Status: Later Version**

### Description
Support optional structured check-ins to help couples communicate about their relationship, mood, and priorities.

### User Stories

#### US-16.1: Relationship Check-ins
**As a** user
**I want** to participate in structured relationship check-ins
**So that** we can regularly communicate about our relationship health

**Subtasks:**
- Design check-in data schema
- Build check-in templates
- Implement check-in scheduling
- Create check-in question sets:
  - Weekly relationship check-in
  - Monthly planning session
  - Mood check
  - Stress level
  - Appreciation prompts
  - Needs attention prompts
  - Upcoming priorities
  - Date satisfaction
  - Financial concerns
- Build check-in response interface
- Add skip/postpone functionality

#### US-16.2: Check-in Privacy Controls
**As a** user
**I want** to control when my check-in responses are shared
**So that** I can be honest while maintaining appropriate privacy

**Subtasks:**
- Implement check-in visibility settings:
  - Private
  - Shared immediately
  - Revealed after both respond
  - Temporary (auto-delete)
- Build reveal mechanism
- Create waiting status indicator
- Add privacy selection per question

#### US-16.3: Check-in Insights
**As a** user
**I want** to see summaries of our check-ins over time
**So that** we can identify patterns and improvements

**Subtasks:**
- Build check-in history view
- Implement trend analysis
- Create mood/satisfaction visualization
- Add pattern identification
- Build comparison views (month over month)
- Implement AI summary generation

#### US-16.4: AI Check-in Support
**As a** user
**I want** the AI to help facilitate check-ins
**So that** we can have productive conversations

**Subtasks:**
- Implement AI check-in facilitation
- Build neutral summarization
- Create follow-up question generation
- Add conflict detection (without taking sides)
- Implement resource suggestions
- Build AI guardrails (no judgment/blame)

---

## Epic 17: Shared Decisions
**Status: Later Version**

### Description
Help couples organize and make larger decisions together through structured decision-making tools.

### User Stories

#### US-17.1: Decision Creation
**As a** user
**I want** to create a structured decision with options
**So that** we can organize our thinking on important choices

**Subtasks:**
- Design decision data schema
- Build decision creation form
- Implement decision title/description
- Create option management (add/edit/remove)
- Add decision category
- Build decision deadline
- Implement decision status

#### US-17.2: Option Analysis
**As a** user
**I want** to add pros, cons, and details to each option
**So that** we can thoroughly evaluate our choices

**Subtasks:**
- Build pros/cons list per option
- Implement cost field per option
- Add photo/attachment support
- Create custom criteria fields
- Build notes section per option
- Implement scoring system (optional)

#### US-17.3: Preference Expression
**As a** user
**I want** to indicate my preference for options
**So that** we can see where we agree and disagree

**Subtasks:**
- Build voting/ranking system
- Implement preference strength indicator
- Create deal-breaker marking
- Add preference explanation notes
- Build preference comparison view
- Implement private preference option

#### US-17.4: Decision Documentation
**As a** user
**I want** to document the final decision and reasoning
**So that** we can remember why we chose what we did

**Subtasks:**
- Build final decision recording
- Implement decision rationale notes
- Create decision date/timestamp
- Add implementation plan
- Build decision history
- Implement decision review/revisit

#### US-17.5: AI Decision Support
**As a** user
**I want** the AI to help organize decision information
**So that** we can make more informed choices

**Subtasks:**
- Implement AI information organization
- Build pro/con generation from notes
- Create cost analysis
- Add constraint checking
- Implement AI research assistance
- Build AI guardrails (no making decisions for couple)

---

## Epic 18: Advanced Integrations (Future)
**Status: Later Version**

### Description
Add advanced integrations with external services for banking, reservations, purchasing, and travel.

### User Stories

#### US-18.1: Bank Account Integration
**As a** user
**I want** to connect my bank account
**So that** expenses are automatically tracked

**Subtasks:**
- Research banking API providers (Plaid, etc.)
- Implement OAuth bank connection
- Build transaction sync service
- Create transaction categorization
- Implement privacy controls for bank data
- Add automatic budget tracking
- Build transaction review/approval
- Implement security measures

#### US-18.2: Reservation Integration
**As a** user
**I want** the app to make reservations for me
**So that** I can book dates without leaving the app

**Subtasks:**
- Research reservation API providers (OpenTable, Resy, etc.)
- Implement reservation booking
- Build availability checking
- Create reservation confirmation
- Add reservation modification
- Implement reservation reminders
- Build reservation to calendar sync

#### US-18.3: Purchase Integration
**As a** user
**I want** to purchase wishlist items through the app
**So that** I can easily buy gifts

**Subtasks:**
- Implement affiliate link integration
- Build in-app purchase flow (if feasible)
- Create order tracking
- Add delivery notification
- Implement purchase confirmation
- Build order history

#### US-18.4: Travel Planning Integration
**As a** user
**I want** to plan trips with integrated flight and hotel booking
**So that** I can organize travel in one place

**Subtasks:**
- Research travel API providers
- Implement flight search
- Build hotel search
- Create trip itinerary builder
- Add booking integration
- Implement trip budget tracking
- Build travel document storage

---

## Implementation Priority

### Phase 1: MVP - Core Foundation
1. User Authentication & Account Setup
2. Personal & Relationship Profiles
3. Privacy & Permissions (basic)
4. AI Memory & Data Controls (basic)

### Phase 2: MVP - Primary Features
5. Calendar System
6. Timeline Management
7. Map & Saved Places
8. Finance & Budgeting

### Phase 3: MVP - Enhanced Experience
9. Date Planning
10. Wishlist & Gift Management
11. Embedded AI System
12. Notifications
13. Data Controls & Ownership

### Phase 4: Later Versions
14. Memories
15. Tasks & Responsibilities
16. Check-ins & Emotional Tracking
17. Shared Decisions
18. Advanced Integrations

---

## Technical Notes

### Data Model Connectivity
All features should be built with interconnected data models to support the app's core principle of connected information:
- Events can link to places, timelines, tasks, and budgets
- Places can link to events, date plans, and memories
- Timelines can link to events, tasks, expenses, and memories
- Budgets can link to events, date plans, and purchases
- Wishlists can link to budgets, events, and gift plans

### AI Integration Points
The embedded AI system should have hooks into all major features:
- Calendar (event creation, availability finding)
- Timelines (progress updates, milestone tracking)
- Map (place saving, discovery)
- Finances (expense logging, budget queries)
- Date Planning (suggestion generation)
- Wishlists (item addition)
- Profiles (preference extraction)

### Privacy Architecture
Privacy controls should be built into the data access layer from the beginning:
- Field-level privacy flags
- Privacy validation middleware
- Visibility filtering in queries
- Privacy UI indicators
- Audit logging for privacy-sensitive actions

### Mobile-First Design
All features should be designed mobile-first with consideration for:
- Touch-friendly interfaces
- Location services integration
- Camera access for photos
- Voice input for AI
- Push notifications
- Offline functionality where appropriate

