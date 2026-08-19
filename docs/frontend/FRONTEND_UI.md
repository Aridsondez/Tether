# Frontend UI Direction

## Product Goal

The app should feel personal, modern, visual, and distinctly mobile-first. The interface should avoid a generic SaaS/dashboard look and instead feel closer to a polished native Apple application.

The primary visual direction is **Liquid Glass**:

- translucent surfaces
- layered depth
- blurred backgrounds
- soft highlights
- subtle gradients
- floating controls
- smooth spring-based motion
- strong typography
- minimal visible borders
- contextual color rather than large flat color blocks

The design should feel premium without becoming visually noisy.

---

# Design Principles

## 1. Native-first

Every screen should feel designed for a phone rather than adapted from a website.

Prefer:

- bottom sheets
- swipe gestures
- long press actions
- haptic feedback
- floating action controls
- expandable cards
- edge-to-edge layouts
- contextual menus
- interactive transitions

Avoid:

- desktop-style sidebars
- dense tables
- excessive modal dialogs
- tiny controls
- generic boxed dashboard layouts

---

## 2. Content is the interface

The relationship itself should provide most of the visual interest.

Important content includes:

- people
- photos
- memories
- timelines
- places
- dates
- goals
- finances
- events
- progress

UI chrome should stay secondary.

---

## 3. Motion has purpose

Animations should communicate state or hierarchy rather than exist only for decoration.

Use animation for:

- cards expanding into detail screens
- timeline progress
- budget progress
- new events appearing
- map selections
- completing goals
- switching between partners
- opening sheets
- adding memories
- AI interactions
- navigation transitions

Prefer spring animations and subtle easing.

Avoid excessive bouncing, looping, or unnecessary motion.

---

# UI Stack

Recommended React Native stack:

```text
Expo
React Native
TypeScript
Expo Router

NativeWind
React Native Reusables

React Native Reanimated
React Native Gesture Handler
Expo Haptics

Lucide React Native
```

## Component strategy

Use **React Native Reusables** as the commodity component layer.

Examples:

- Button
- Input
- Sheet
- Dialog
- Tabs
- Avatar
- Progress
- Dropdown
- Toast
- Toggle

These components should then be restyled to match the app's custom design system.

Do not treat the base component library as the visual identity of the app.

---

# Liquid Glass Visual System

## Surface hierarchy

Use different glass strengths depending on hierarchy.

### Level 0: Background

The base screen should usually contain:

- dark or light neutral background
- subtle gradient
- optional blurred imagery
- large atmospheric color accents

### Level 1: Glass Card

Used for primary content containers.

Characteristics:

- translucent fill
- background blur
- subtle inner highlight
- large border radius
- faint border
- soft shadow

### Level 2: Floating Glass

Used for:

- bottom navigation
- floating buttons
- segmented controls
- compact toolbars
- contextual actions

Should appear more elevated than content cards.

### Level 3: Focused Surface

Used for active selections and important actions.

Can use:

- stronger tint
- brighter highlight
- slight scale change
- more pronounced depth

---

# Color Palette

The palette should remain mostly neutral and allow user-specific colors, photos, maps, and content to introduce personality.

## Core neutrals

```text
Background Dark      #090A0D
Background Elevated  #111318
Background Light     #F5F6F8

Glass Dark           rgba(24, 27, 34, 0.58)
Glass Light          rgba(255, 255, 255, 0.58)

Glass Border Dark    rgba(255, 255, 255, 0.10)
Glass Border Light   rgba(255, 255, 255, 0.48)

Text Primary Dark    #F7F8FA
Text Secondary Dark  #A9ADB7

Text Primary Light   #111318
Text Secondary Light #626773
```

## Accent colors

The application should support partner-specific accent colors.

Example default pairing:

```text
Partner A
Primary     #6C8CFF
Secondary   #9BAEFF

Partner B
Primary     #FF7EA8
Secondary   #FFAAC3
```

These should not be hard-coded into every component.

Instead define semantic tokens:

```text
partner.primary
partner.secondary
partner.glow
partner.surface

otherPartner.primary
otherPartner.secondary
otherPartner.glow
```

Users can eventually choose their own colors.

---

# Semantic Colors

```text
Success       #52C98B
Warning       #F5B95B
Danger        #FF6B6B
Information   #6EA8FF
```

Use these sparingly.

Do not let functional colors overpower relationship colors.

---

# Gradient Direction

Gradients should be subtle.

Examples:

```text
Blue → Violet
#6C8CFF → #997DFF

Pink → Coral
#FF7EA8 → #FF9A86

Background Glow
rgba(108,140,255,0.20)
→ transparent
```

Large radial gradients behind glass surfaces can create depth.

Avoid rainbow gradients unless tied to a specific feature.

---

# Typography

Prefer system typography where possible.

On iOS, the interface should naturally align with Apple's typography conventions.

Suggested hierarchy:

```text
Display
32-40px
Bold / Semibold

Screen Title
26-30px
Semibold

Section Title
20-22px
Semibold

Card Title
17-19px
Semibold

Body
15-17px
Regular

Metadata
12-14px
Medium / Regular
```

Keep line lengths short.

Use large typography when highlighting:

- relationship duration
- money
- dates
- milestones
- goal progress

---

# Spacing

Use a consistent 4-point system.

```text
4
8
12
16
20
24
32
40
48
64
```

Typical screen horizontal padding:

```text
16-20px
```

Typical card padding:

```text
16-20px
```

---

# Radius

Liquid glass should use relatively generous radii.

```text
Small controls     10-12
Buttons            14-18
Cards              20-28
Sheets              28-32
Floating nav       24-32
```

Avoid using the exact same radius everywhere.

Hierarchy should affect shape.

---

# Blur

Glass should use blur carefully.

Suggested conceptual levels:

```text
Subtle     12
Standard   20
Strong     32
Hero       48+
```

Blur alone does not create glass.

Combine blur with:

- transparency
- border highlight
- background variation
- shadow
- depth
- tint

---

# Shadows

Use soft shadows rather than strong black drops.

Glass surfaces should feel elevated, not boxed.

Conceptually:

```text
Low elevation
0 4 16 / low opacity

Medium elevation
0 8 30 / low opacity

Floating controls
0 12 40 / moderate opacity
```

Dark mode shadows may need to rely more on borders and highlights than black shadow.

---

# Navigation

Recommended main navigation:

```text
Home
Timeline
Map
Calendar
More
```

Finances can either live under Home or replace More depending on importance.

Use a floating glass tab bar.

The active tab should use:

- subtle scale
- stronger tint
- icon transition
- optional haptic feedback

---

# Home Screen

The home screen should act as the relationship dashboard without looking like a dashboard.

Possible structure:

```text
[ Couple Header ]

Together for
1,284 days

[ Current Shared Timeline ]

[ Next Event ]

[ This Month ]
Date spending
Shared goals
Upcoming dates

[ Recent Memory ]

[ AI Suggestion ]
```

Use large cards with distinct layouts rather than a grid of identical widgets.

---

# Timeline

The timeline is one of the signature UI elements.

It should support:

- personal timelines
- shared timelines
- milestones
- progress
- start/end dates
- status
- notes
- photos
- linked calendar events

Visual concepts:

- vertical progress path
- glowing nodes
- animated progress line
- partner-colored paths
- overlapping timelines
- milestone cards
- expandable timeline entries

Animations:

- line draws as the screen enters
- nodes scale when reached
- cards expand on tap
- completion produces subtle haptic feedback

---

# Map

The map should feel like a shared discovery layer.

Locations may represent:

- restaurants
- date ideas
- memories
- favorite places
- future trips
- activities

Pins should use categories and partner colors.

Selecting a pin should open a floating glass preview.

Example:

```text
Restaurant photo

Cosme
Saved by Partner B

Want to go
$$$$

[ Plan Date ]
```

The card may expand into a full detail screen.

---

# Calendar

The calendar should combine:

- shared events
- personal schedules
- date plans
- important dates
- timeline milestones
- reminders

Use partner colors to identify ownership.

Avoid creating a dense business-calendar appearance.

---

# Finances

Financial UI should remain simple and visual.

Primary data:

- monthly date budget
- total spent
- remaining
- upcoming planned expenses
- gifts
- trips
- shared goals

Possible visual:

```text
August

$340
spent

$160 remaining

████████████░░░░
```

Transactions should be grouped into meaningful relationship categories rather than financial accounting categories.

Examples:

```text
Dates
Food
Travel
Gifts
Activities
Shared Purchases
```

---

# Memories

Memories should be image-forward.

Potential layouts:

- stacked cards
- photo journals
- timeline memories
- location-linked memories
- date-linked memories

Tap interactions should feel immersive.

Photos can transition from a small card into full screen.

---

# AI Assistant

AI should not feel like a separate chatbot bolted onto the application.

AI should appear contextually.

Examples:

```text
Calendar
"Looks like both of you are free Saturday."

Map
"There are three saved places nearby."

Finances
"You have $120 left in your date budget."

Timeline
"You are 4 days from completing this goal."
```

A dedicated assistant screen can still exist for deeper conversations.

---

# Cards

Avoid making every piece of UI the same rounded rectangle.

Card types should include:

```text
Hero cards
Compact cards
Photo cards
Inline rows
Floating pills
Timeline nodes
Glass overlays
Expandable cards
```

This keeps the interface from looking generated or template-based.

---

# Buttons

Primary actions should be visually clear but not overly heavy.

Types:

```text
Primary Glass
Tinted Glass
Text Button
Icon Button
Floating Action
Destructive
```

Buttons should respond with:

- slight scale down
- haptic feedback when appropriate
- highlight change
- spring return

---

# Gestures

Use gestures where they make the experience faster.

Examples:

```text
Swipe timeline card
→ archive / complete

Long press memory
→ quick actions

Drag timeline progress
→ inspect dates

Swipe calendar event
→ modify

Pull map card upward
→ expand details

Swipe photo
→ next memory
```

Gestures should always have visible alternatives for discoverability.

---

# Animation Guidelines

Recommended duration ranges:

```text
Micro interaction
100-180ms

Standard transition
180-300ms

Large transition
300-500ms

Celebratory animation
500-900ms
```

Use spring physics for:

- expanding cards
- floating controls
- sheets
- draggable interactions
- selection changes

Use timing animations for:

- opacity
- gradients
- progress indicators
- subtle fades

---

# Haptics

Use haptics for meaningful actions.

Good uses:

- adding something
- completing a goal
- selecting a map location
- changing tabs
- confirming a date
- reaching timeline milestones

Avoid haptics for every tap.

---

# Dark Mode

Dark mode should be treated as a first-class design.

Liquid glass can look especially strong against dark backgrounds.

Dark surfaces should use:

- transparent charcoal
- faint white borders
- subtle blue/purple atmospheric lighting
- high contrast typography

Do not simply invert the light theme.

---

# Light Mode

Light mode should feel closer to frosted glass.

Use:

- warm/cool off-white backgrounds
- translucent white surfaces
- faint gray shadows
- subtle colored glows
- dark typography

Avoid pure white everywhere.

---

# Accessibility

Always preserve:

- readable contrast
- minimum touch targets
- reduced-motion support
- dynamic text scaling where possible
- labels for icons
- non-color indicators for important state

Glass effects must never make text difficult to read.

---

# Component Organization

Suggested project structure:

```text
src/
  components/
    ui/
      button/
      card/
      sheet/
      input/
      tabs/
      avatar/
      progress/

    glass/
      GlassSurface.tsx
      GlassCard.tsx
      GlassButton.tsx
      GlassTabBar.tsx
      GlassSheet.tsx

    timeline/
      Timeline.tsx
      TimelineNode.tsx
      TimelineProgress.tsx
      TimelineCard.tsx

    map/
      MapPin.tsx
      PlacePreview.tsx
      PlaceCard.tsx

    finances/
      BudgetCard.tsx
      SpendingProgress.tsx
      TransactionRow.tsx

    memories/
      MemoryCard.tsx
      MemoryStack.tsx

  theme/
    colors.ts
    spacing.ts
    radius.ts
    typography.ts
    shadows.ts
    motion.ts

  screens/
```

---

# Design Tokens

Avoid hard-coding visual values throughout components.

Example:

```ts
export const radius = {
  sm: 12,
  md: 18,
  lg: 24,
  xl: 30,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};
```

Do the same for:

- colors
- typography
- motion
- shadows
- glass opacity
- blur strength

---

# Signature Interactions

These interactions should help give the application its identity.

## Timeline Progress

Progress line animates toward the user's current position.

## Couple Switch

Switch between:

```text
You
Partner
Together
```

with a sliding segmented glass control.

## Map Preview

Pin transforms visually into a location card.

## Date Planning

A saved place can become a calendar event through a smooth flow rather than a separate form.

## Goal Completion

Completion triggers:

- progress animation
- subtle glow
- haptic
- milestone creation

## Memory Expansion

Photo card expands into an immersive memory view.

## AI Context

AI suggestions appear as small contextual glass surfaces attached to the relevant feature.

---

# Inspiration Direction

Useful product references:

```text
Apple
Native interaction, typography, depth, glass

Apple Music
Large imagery and immersive transitions

Apple Fitness
Progress visualization and motion

Apple Journal
Personal and emotional presentation

Airbnb
Maps, discovery, cards

Linear
Clean visual hierarchy and subtle interaction

Copilot / Monarch
Financial visualization

Notion Calendar
Time and scheduling
```

Use these as references, not templates.

---

# Rules

1. Avoid generic dashboard UI.
2. Avoid identical cards everywhere.
3. Use animation to communicate state.
4. Let photos and relationship data provide color.
5. Keep the base palette neutral.
6. Use partner colors consistently.
7. Prefer depth over borders.
8. Prefer native interactions over web conventions.
9. Use glass selectively rather than covering every surface.
10. Every major feature should have at least one visually distinctive interaction.
11. Design dark mode and light mode intentionally.
12. Keep accessibility intact even when using glass and blur.
