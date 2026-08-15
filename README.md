# Tether - Shared Relationship Operating System

A comprehensive app for couples to organize schedules, goals, finances, dates, locations, preferences, gifts, memories, and future plans in one connected place.

## Overview

Tether helps both partners maintain individual identities while creating a shared relationship profile. The app makes it easier to understand each other, plan together, stay accountable, manage spending, and preserve important moments without making the relationship feel monitored or overly structured.

## Key Features

### MVP (Version 1.0)
- **Personal & Relationship Profiles** - Individual and shared profiles with preferences, interests, and goals
- **Shared Calendar** - Combined schedules with mutual free time detection and conflict resolution
- **Timeline Management** - Track personal and shared goals, habits, and major life events
- **Map & Saved Places** - Save and discover locations both partners want to visit
- **Date Planning** - AI-assisted and manual date planning with budget tracking
- **Finance & Budgeting** - Personal and shared budgets with expense tracking and split management
- **Wishlist & Gift Management** - Personal wishlists with surprise mode for gift planning
- **Embedded AI System** - Context-aware AI assistant accessible from any screen
- **Privacy & Permissions** - Granular controls for data visibility and sharing
- **Notifications** - Smart reminders for events, budgets, and relationship milestones
- **AI Memory Controls** - Transparency and control over AI data usage
- **Data Ownership** - Clear separation and export capabilities

### Future Features
- Memories & relationship history tracking
- Tasks & responsibilities management
- Relationship check-ins
- Shared decision-making tools
- Advanced integrations (banking, reservations, travel)

## Product Principles

1. **Connected Data** - Calendars, timelines, places, finances, and preferences continuously inform one another
2. **Privacy First** - Each partner maintains personal autonomy with granular privacy controls
3. **AI-Augmented** - AI embedded throughout the app to reduce effort and connect information
4. **Relationship-Focused** - Designed to help couples remember, plan, understand, support, and enjoy each other

## Project Structure

- `docs/product/overview.md` - Complete product specification and feature descriptions
- `docs/product/epics.md` - Epic breakdown with user stories and technical subtasks
- `docs/backend/` - Backend infrastructure, services, and backend feature integrations
- `docs/ai/` - AI and LLM architecture research

## Documentation

Browse the [documentation index](./docs/README.md) for every document, grouped by product, architecture, backend, backend features, and AI.

The current backend decision is [Neon Postgres + Railway](./docs/architecture/neon-railway-architecture.md), with schema migrations versioned in the repository.

For detailed feature specifications, see [Product overview](./docs/product/overview.md).

For development planning and epic breakdown, see [Epic plan](./docs/product/epics.md).

## Development Status

This project is in the initial planning phase. The epic structure includes 18 comprehensive epics with 85+ user stories and 500+ technical subtasks organized into MVP and future version phases.

---

Built to strengthen relationships through better organization, understanding, and shared experiences.
