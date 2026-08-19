import Constants from 'expo-constants';

export type Relationship = {
  couple_id?: string;
  id?: string;
  status: 'pending' | 'active';
  relationship_status?: 'pending' | 'active';
  role?: 'owner' | 'partner';
  connected_at?: string | null;
  partner_display_name?: string | null;
  partner_birthday?: string | null;
  partner_color?: string | null;
};

export const RELATIONSHIP_STAGES = [
  { value: 'friends', label: 'Friends' },
  { value: 'together', label: 'Together' },
  { value: 'not_together', label: 'Not together' },
  { value: 'partners', label: 'Partners' },
  { value: 'engaged', label: 'Engaged' },
  { value: 'married', label: 'Married' },
] as const;

export type RelationshipStage = (typeof RELATIONSHIP_STAGES)[number]['value'];

export type RelationshipProfile = {
  relationship_stage: RelationshipStage;
  met_on: string | null;
  anniversary_on: string | null;
};

export type RelationshipProfileUpdateDraft = Partial<RelationshipProfile>;

export const USER_COLOR_PALETTE = [
  '#6C8CFF', // indigo
  '#FF7EA8', // rose
  '#4ECDC4', // teal
  '#FFD166', // amber
  '#7BC67E', // green
  '#F4A261', // orange
  '#B39DDB', // purple
  '#5AC8FA', // sky
] as const;

export type UserColor = (typeof USER_COLOR_PALETTE)[number];

export type UserProfile = {
  first_name: string | null;
  last_name: string | null;
  bio: string | null;
  birthday: string | null;
  pronouns: string | null;
};

export type MeResponse = {
  user: {
    id: string;
    email: string | null;
    display_name: string | null;
    color: string | null;
  };
  profile: UserProfile | null;
  relationship: Relationship | null;
  relationship_profile: RelationshipProfile | null;
  onboarding_complete: boolean;
};

export type ProfileUpdateDraft = {
  display_name: string;
  timezone?: string;
  first_name?: string | null;
  last_name?: string | null;
  bio?: string | null;
  birthday?: string | null;
  pronouns?: string | null;
};

export type InvitationResponse = {
  invitation: {
    id: string;
    invitee_email: string;
    expires_at: string;
  };
  invite_token: string;
};

export type PendingInvitation = {
  id: string;
  invitee_email: string;
  expires_at: string;
};

export const PREFERENCE_CATEGORIES = [
  { value: 'like', label: 'Likes' },
  { value: 'dislike', label: 'Dislikes' },
  { value: 'gift_idea', label: 'Gift ideas' },
] as const;

export type PreferenceCategory = (typeof PREFERENCE_CATEGORIES)[number]['value'];

export type Preference = {
  id: string;
  category: PreferenceCategory;
  label: string;
  note: string | null;
  visibility: 'shared' | 'private' | 'summary_only' | 'hidden_until';
  is_mine: boolean;
  created_at: string;
};

export type PreferenceDraft = {
  category: PreferenceCategory;
  label: string;
  note?: string | null;
};

export type PreferenceUpdateDraft = Partial<{
  label: string;
  note: string | null;
}>;

export const PARTNER_NOTE_CATEGORIES = [
  { value: 'want', label: 'Wants' },
  { value: 'dont_want', label: "Doesn't want" },
  { value: 'like', label: 'Likes' },
  { value: 'dislike', label: 'Dislikes' },
  { value: 'mentioned', label: 'Mentioned' },
  { value: 'note', label: 'Notes' },
] as const;

export type PartnerNoteCategory = (typeof PARTNER_NOTE_CATEGORIES)[number]['value'];

export type PartnerNote = {
  id: string;
  category: PartnerNoteCategory;
  body: string;
  created_at: string;
  updated_at: string;
};

export type PartnerNoteDraft = {
  category: PartnerNoteCategory;
  body: string;
};

export type PartnerNoteUpdateDraft = Partial<{
  category: PartnerNoteCategory;
  body: string;
}>;

export const PLACE_CATEGORIES = [
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'bar', label: 'Bar' },
  { value: 'coffee_shop', label: 'Coffee shop' },
  { value: 'hotel', label: 'Hotel' },
  { value: 'park', label: 'Park' },
  { value: 'store', label: 'Store' },
  { value: 'activity', label: 'Activity' },
  { value: 'date_location', label: 'Date spot' },
  { value: 'travel_destination', label: 'Travel' },
  { value: 'event_venue', label: 'Venue' },
  { value: 'personal', label: 'Personal' },
  { value: 'other', label: 'Other' },
] as const;

export type PlaceCategory = (typeof PLACE_CATEGORIES)[number]['value'];

export type Place = {
  id: string;
  name: string;
  category: PlaceCategory;
  address: string | null;
  latitude: number;
  longitude: number;
  notes: string | null;
  price_range: number | null;
  rating: number | null;
  photo_reference: string | null;
  external_place_id: string | null;
  visited: boolean;
  visited_at: string | null;
  created_at: string;
  created_by_you: boolean;
  created_by_name: string | null;
  liked_by_you: boolean;
  liked_by_partner: boolean;
};

export type PlaceDraft = {
  name: string;
  category: PlaceCategory;
  address?: string | null;
  latitude: number;
  longitude: number;
  notes?: string | null;
  price_range?: number | null;
  photo_reference?: string | null;
  external_place_id?: string | null;
};

export type PlaceUpdateDraft = Partial<{
  name: string;
  category: PlaceCategory;
  address: string | null;
  notes: string | null;
  price_range: number | null;
  rating: number | null;
  visited: boolean;
}>;

export type PlaceSearchResult = {
  external_place_id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  rating: number | null;
  price_level: number | null;
  photo_reference: string | null;
  suggested_category: PlaceCategory;
};

export type PlaceLookup = {
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  rating: number | null;
  price_level: number | null;
  opening_hours: string[] | null;
  phone: string | null;
  website: string | null;
  photo_reference: string | null;
};

export const TIMELINE_OWNERSHIPS = [
  { value: 'mine', label: 'Just me' },
  { value: 'shared', label: 'Shared' },
] as const;

export type TimelineOwnership = (typeof TIMELINE_OWNERSHIPS)[number]['value'];
export type TimelineStatus = 'active' | 'completed' | 'archived';

export const TIMELINE_CATEGORIES = [
  { value: 'school', label: 'School' },
  { value: 'work', label: 'Work' },
  { value: 'finances', label: 'Finances' },
  { value: 'health', label: 'Health' },
  { value: 'home', label: 'Home' },
  { value: 'travel', label: 'Travel' },
  { value: 'relationship', label: 'Relationship' },
  { value: 'personal', label: 'Personal' },
  { value: 'other', label: 'Other' },
] as const;

export type TimelineCategory = (typeof TIMELINE_CATEGORIES)[number]['value'];

export const TIMELINE_MAX_PARENTS = 2;

export type TimelineItem = {
  id: string;
  timeline_id: string;
  title: string;
  notes: string | null;
  target_date: string | null;
  completed_at: string | null;
  position: number;
  created_at: string;
};

export type Timeline = {
  id: string;
  title: string;
  description: string | null;
  ownership: TimelineOwnership;
  status: TimelineStatus;
  category: TimelineCategory;
  start_date: string | null;
  target_date: string | null;
  parent_timeline_ids: string[];
  created_at: string;
  created_by_you: boolean;
  created_by_name: string | null;
  items: TimelineItem[];
};

export type TimelineDraft = {
  title: string;
  description?: string | null;
  ownership: TimelineOwnership;
  category: TimelineCategory;
  parent_timeline_ids?: string[];
  start_date?: string | null;
  target_date?: string | null;
};

export type TimelineUpdateDraft = Partial<{
  title: string;
  description: string | null;
  status: TimelineStatus;
  category: TimelineCategory;
  parent_timeline_ids: string[];
  start_date: string | null;
  target_date: string | null;
}>;

export type TimelineItemDraft = {
  title: string;
  notes?: string | null;
  target_date?: string | null;
};

export type TimelineItemUpdateDraft = Partial<{
  title: string;
  notes: string | null;
  target_date: string | null;
  completed: boolean;
}>;

export const EVENT_CATEGORIES = [
  { value: 'date_night', label: 'Date night' },
  { value: 'anniversary', label: 'Anniversary' },
  { value: 'appointment', label: 'Appointment' },
  { value: 'travel', label: 'Travel' },
  { value: 'family_friends', label: 'Family & friends' },
  { value: 'household', label: 'Household' },
  { value: 'work', label: 'Work' },
  { value: 'health', label: 'Health' },
  { value: 'milestone', label: 'Milestone' },
  { value: 'reminder', label: 'Reminder' },
  { value: 'other', label: 'Other' },
] as const;

export type EventCategory = (typeof EVENT_CATEGORIES)[number]['value'];

export const EVENT_VISIBILITIES = [
  { value: 'shared', label: 'Shared', description: 'Both of you see full details.' },
  { value: 'private', label: 'Private', description: 'Only visible to you.' },
  { value: 'summary_only', label: 'Busy only', description: 'Your partner sees "Busy", no details.' },
  { value: 'hidden_until', label: 'Surprise', description: 'Hidden from your partner until a reveal date.' },
] as const;

export type EventVisibility = (typeof EVENT_VISIBILITIES)[number]['value'];

export const RECURRENCE_FREQS = [
  { value: 'none', label: 'Does not repeat' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
] as const;

export type RecurrenceFreq = (typeof RECURRENCE_FREQS)[number]['value'];

export type CalendarEvent = {
  id: string;
  instance_id: string;
  is_recurring: boolean;
  title: string;
  description: string | null;
  location: string | null;
  place_id: string | null;
  place: { id: string; name: string; address: string | null; category: PlaceCategory | null } | null;
  category: EventCategory | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  visibility: EventVisibility;
  hidden_until: string | null;
  recurrence_freq: RecurrenceFreq;
  recurrence_until: string | null;
  reminder_minutes: number | null;
  color: string | null;
  created_by_you: boolean;
  created_by_name: string | null;
  masked: boolean;
};

export type ExternalCalendarEvent = {
  instance_id: string;
  source: 'external';
  feed_id: string;
  feed_name: string;
  title: string;
  location: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  color: string;
  read_only: true;
};

export type CalendarEventsResponse = {
  events: CalendarEvent[];
  external_events: ExternalCalendarEvent[];
};

export type EventDraft = {
  title: string;
  description?: string | null;
  location?: string | null;
  place_id?: string | null;
  category: EventCategory;
  start_at: string;
  end_at: string;
  all_day?: boolean;
  visibility?: EventVisibility;
  hidden_until?: string | null;
  recurrence_freq?: RecurrenceFreq;
  recurrence_until?: string | null;
  reminder_minutes?: number | null;
  color?: string | null;
};

export type EventUpdateDraft = Partial<EventDraft>;

export const CALENDAR_PROVIDERS = [
  { value: 'google', label: 'Google Calendar' },
  { value: 'apple', label: 'Apple Calendar' },
  { value: 'outlook', label: 'Outlook' },
  { value: 'other', label: 'Other' },
] as const;

export type CalendarProvider = (typeof CALENDAR_PROVIDERS)[number]['value'];

export type CalendarFeed = {
  id: string;
  provider: CalendarProvider;
  name: string;
  color: string;
  feed_url: string | null;
  sync_status: 'pending' | 'ok' | 'error';
  last_synced_at: string | null;
  last_error: string | null;
  created_by_you: boolean;
};

export type CalendarFeedDraft = {
  provider: CalendarProvider;
  name: string;
  color?: string;
  feed_url: string;
};

export const FINANCE_CATEGORIES = [
  { value: 'dining_out', label: 'Dining out' },
  { value: 'groceries', label: 'Groceries' },
  { value: 'transportation', label: 'Transportation' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'travel', label: 'Travel' },
  { value: 'shopping', label: 'Shopping' },
  { value: 'bills_utilities', label: 'Bills & utilities' },
  { value: 'health', label: 'Health' },
  { value: 'subscriptions', label: 'Subscriptions' },
  { value: 'other', label: 'Other' },
] as const;

export type FinanceCategory = (typeof FINANCE_CATEGORIES)[number]['value'];

export type Budget = {
  id: string;
  category: FinanceCategory;
  monthly_limit: number;
  is_shared: boolean;
  spent_amount: number;
  remaining: number;
  percent_used: number;
  status: 'under' | 'over';
};

export type CoupleBudgetStatus = {
  category: FinanceCategory;
  mine: Budget | null;
  partner: Pick<Budget, 'status' | 'percent_used' | 'is_shared'> | null;
  pool: { combined_limit: number; combined_spent: number; remaining: number; status: 'under' | 'over' } | null;
};

export type FinanceLiability = {
  liability_type: 'credit' | 'student' | 'mortgage';
  apr_percent: number | null;
  minimum_payment: number | null;
  next_payment_due_date: string | null;
  last_payment_amount: number | null;
  last_payment_date: string | null;
  origination_principal: number | null;
};

export type FinanceAccount = {
  id: string;
  name: string;
  official_name: string | null;
  mask: string | null;
  type: string;
  subtype: string | null;
  current_balance: number | null;
  available_balance: number | null;
  credit_limit: number | null;
  iso_currency_code: string;
  is_closed: boolean;
  liability: FinanceLiability | null;
};

export type FinanceTransaction = {
  id: string;
  merchant_name: string | null;
  name: string;
  amount: number;
  iso_currency_code: string;
  category: FinanceCategory;
  category_overridden: boolean;
  is_shared: boolean;
  pending: boolean;
  transacted_on: string;
};

const configuredBaseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
const invalidDeviceHost = /:\/\/(?:0\.0\.0\.0|127\.0\.0\.1|localhost)(?::|\/|$)/;
const metroHost = Constants.expoConfig?.hostUri?.split(':')[0];

// In Expo Go on a physical phone, 0.0.0.0 and localhost refer to the phone,
// not the Mac. Use the LAN host serving the Metro bundle instead.
const baseUrl = invalidDeviceHost.test(configuredBaseUrl ?? '') && metroHost
  ? `http://${metroHost}:8000`
  : configuredBaseUrl;

export class ApiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

let sessionExpiredHandler: (() => void) | null = null;
let sessionExpiryTriggered = false;

export function setSessionExpiredHandler(handler: (() => void) | null) {
  sessionExpiredHandler = handler;
  sessionExpiryTriggered = false;
}

async function request<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  if (!baseUrl) {
    throw new ApiError('Set EXPO_PUBLIC_API_URL to connect Tether.');
  }

  const requestUrl = `${baseUrl}${path}`;

  let response: Response;
  try {
    response = await fetch(requestUrl, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    });
  } catch (error) {
    console.error(`[Tether] Network request failed for ${requestUrl}:`, error);
    throw new ApiError(`Tether could not reach ${baseUrl}. Check that your iPhone can open ${baseUrl}/health in Safari.`);
  }

  const payload = (await response.json().catch(() => null)) as { detail?: string } | T | null;
  if (!response.ok) {
    const detail = payload && typeof payload === 'object' && 'detail' in payload ? payload.detail : null;
    console.error(`[Tether] API ${init?.method ?? 'GET'} ${path} failed (${response.status}):`, detail);
    if (response.status === 401 && !sessionExpiryTriggered) {
      sessionExpiryTriggered = true;
      sessionExpiredHandler?.();
    }
    throw new ApiError(detail || 'Something went wrong. Please try again.', response.status);
  }
  return payload as T;
}

export const tetherApi = {
  me: (token: string) => request<MeResponse>('/api/me', token),
  updateProfile: (token: string, draft: ProfileUpdateDraft) =>
    request<MeResponse>('/api/me/profile', token, { method: 'PUT', body: JSON.stringify(draft) }),
  updateMyColor: (token: string, color: UserColor) =>
    request<MeResponse>('/api/me/color', token, { method: 'PATCH', body: JSON.stringify({ color }) }),
  updateRelationshipProfile: (token: string, draft: RelationshipProfileUpdateDraft) =>
    request<MeResponse>('/api/relationship-profile', token, { method: 'PUT', body: JSON.stringify(draft) }),
  listPreferences: (token: string) => request<{ preferences: Preference[] }>('/api/preferences', token),
  createPreference: (token: string, draft: PreferenceDraft) =>
    request<{ preference: Preference }>('/api/preferences', token, { method: 'POST', body: JSON.stringify(draft) }),
  updatePreference: (token: string, preferenceId: string, updates: PreferenceUpdateDraft) =>
    request<{ preference: Preference }>(`/api/preferences/${preferenceId}`, token, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),
  deletePreference: (token: string, preferenceId: string) =>
    request<void>(`/api/preferences/${preferenceId}`, token, { method: 'DELETE' }),
  listPartnerNotes: (token: string) => request<{ notes: PartnerNote[] }>('/api/partner-notes', token),
  createPartnerNote: (token: string, draft: PartnerNoteDraft) =>
    request<{ note: PartnerNote }>('/api/partner-notes', token, { method: 'POST', body: JSON.stringify(draft) }),
  updatePartnerNote: (token: string, noteId: string, updates: PartnerNoteUpdateDraft) =>
    request<{ note: PartnerNote }>(`/api/partner-notes/${noteId}`, token, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),
  deletePartnerNote: (token: string, noteId: string) =>
    request<void>(`/api/partner-notes/${noteId}`, token, { method: 'DELETE' }),
  createRelationship: (token: string) =>
    request<{ relationship: Relationship }>('/api/relationships', token, { method: 'POST' }),
  cancelPendingRelationship: (token: string) =>
    request<void>('/api/relationships/current', token, { method: 'DELETE' }),
  pendingInvitations: (token: string) =>
    request<{ invitations: PendingInvitation[] }>('/api/relationships/invitations/pending', token),
  acceptPendingInvitation: (token: string, invitationId: string) =>
    request<{ relationship: Relationship }>(`/api/relationships/invitations/${invitationId}/accept`, token, {
      method: 'POST',
    }),
  createInvitation: (token: string, inviteeEmail: string) =>
    request<InvitationResponse>('/api/relationships/invitations', token, {
      method: 'POST',
      body: JSON.stringify({ invitee_email: inviteeEmail }),
    }),
  acceptInvitation: (token: string, inviteToken: string) =>
    request<{ relationship: Relationship }>('/api/relationships/invitations/accept', token, {
      method: 'POST',
      body: JSON.stringify({ token: inviteToken }),
    }),
  listPlaces: (token: string) => request<{ places: Place[] }>('/api/places', token),
  createPlace: (token: string, place: PlaceDraft) =>
    request<{ place: Place }>('/api/places', token, { method: 'POST', body: JSON.stringify(place) }),
  updatePlace: (token: string, placeId: string, updates: PlaceUpdateDraft) =>
    request<{ place: Place }>(`/api/places/${placeId}`, token, { method: 'PATCH', body: JSON.stringify(updates) }),
  deletePlace: (token: string, placeId: string) =>
    request<void>(`/api/places/${placeId}`, token, { method: 'DELETE' }),
  likePlace: (token: string, placeId: string) =>
    request<void>(`/api/places/${placeId}/like`, token, { method: 'POST' }),
  unlikePlace: (token: string, placeId: string) =>
    request<void>(`/api/places/${placeId}/like`, token, { method: 'DELETE' }),
  searchPlaces: (token: string, query: string) =>
    request<{ results: PlaceSearchResult[] }>(`/api/places/search?query=${encodeURIComponent(query)}`, token),
  lookupPlace: (token: string, externalPlaceId: string) =>
    request<PlaceLookup>(`/api/places/lookup?external_place_id=${encodeURIComponent(externalPlaceId)}`, token),
  placePhotoSource: (token: string, ref: string) => ({
    uri: `${baseUrl}/api/places/photo?ref=${encodeURIComponent(ref)}`,
    headers: { Authorization: `Bearer ${token}` },
  }),
  listTimelines: (token: string) => request<{ timelines: Timeline[] }>('/api/timelines', token),
  createTimeline: (token: string, draft: TimelineDraft) =>
    request<{ timeline: Timeline }>('/api/timelines', token, { method: 'POST', body: JSON.stringify(draft) }),
  updateTimeline: (token: string, timelineId: string, updates: TimelineUpdateDraft) =>
    request<{ timeline: Timeline }>(`/api/timelines/${timelineId}`, token, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),
  deleteTimeline: (token: string, timelineId: string) =>
    request<void>(`/api/timelines/${timelineId}`, token, { method: 'DELETE' }),
  createTimelineItem: (token: string, timelineId: string, draft: TimelineItemDraft) =>
    request<{ item: TimelineItem }>(`/api/timelines/${timelineId}/items`, token, {
      method: 'POST',
      body: JSON.stringify(draft),
    }),
  updateTimelineItem: (token: string, timelineId: string, itemId: string, updates: TimelineItemUpdateDraft) =>
    request<{ item: TimelineItem }>(`/api/timelines/${timelineId}/items/${itemId}`, token, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),
  deleteTimelineItem: (token: string, timelineId: string, itemId: string) =>
    request<void>(`/api/timelines/${timelineId}/items/${itemId}`, token, { method: 'DELETE' }),
  listCalendarEvents: (token: string, startIso: string, endIso: string) =>
    request<CalendarEventsResponse>(
      `/api/calendar/events?start=${encodeURIComponent(startIso)}&end=${encodeURIComponent(endIso)}`,
      token,
    ),
  createEvent: (token: string, draft: EventDraft) =>
    request<{ event: CalendarEvent }>('/api/calendar/events', token, { method: 'POST', body: JSON.stringify(draft) }),
  updateEvent: (token: string, eventId: string, updates: EventUpdateDraft) =>
    request<{ event: CalendarEvent }>(`/api/calendar/events/${eventId}`, token, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),
  deleteEvent: (token: string, eventId: string) =>
    request<void>(`/api/calendar/events/${eventId}`, token, { method: 'DELETE' }),
  listCalendarFeeds: (token: string) => request<{ feeds: CalendarFeed[] }>('/api/calendar/feeds', token),
  createCalendarFeed: (token: string, draft: CalendarFeedDraft) =>
    request<{ feed: CalendarFeed }>('/api/calendar/feeds', token, { method: 'POST', body: JSON.stringify(draft) }),
  syncCalendarFeed: (token: string, feedId: string) =>
    request<{ feed: CalendarFeed }>(`/api/calendar/feeds/${feedId}/sync`, token, { method: 'POST' }),
  deleteCalendarFeed: (token: string, feedId: string) =>
    request<void>(`/api/calendar/feeds/${feedId}`, token, { method: 'DELETE' }),
  getExportLink: (token: string) => request<{ export_token: string }>('/api/calendar/export-link', token),
  rotateExportLink: (token: string) =>
    request<{ export_token: string }>('/api/calendar/export-link/rotate', token, { method: 'POST' }),
  calendarExportUrl: (exportToken: string) =>
    `${baseUrl}/api/calendar/export.ics?token=${encodeURIComponent(exportToken)}`,
  createPlaidLinkToken: (token: string) =>
    request<{ link_token: string; expiration: string }>('/api/finances/plaid/link-token', token, { method: 'POST' }),
  exchangePlaidPublicToken: (token: string, publicToken: string, institution?: { id?: string | null; name?: string | null }) =>
    request<{ item_id: string; linked: boolean }>('/api/finances/plaid/exchange', token, {
      method: 'POST',
      body: JSON.stringify({ public_token: publicToken, institution_id: institution?.id, institution_name: institution?.name }),
    }),
  syncPlaidItem: (token: string, itemId: string) =>
    request<{ added_or_modified: number; removed: number }>(`/api/finances/plaid/items/${itemId}/sync-transactions`, token, { method: 'POST' }),
  listFinanceAccounts: (token: string) => request<{ accounts: FinanceAccount[] }>('/api/finances/accounts', token),
  listBudgets: (token: string) => request<{ budgets: Budget[] }>('/api/finances/budgets', token),
  createBudget: (token: string, draft: Pick<Budget, 'category' | 'monthly_limit' | 'is_shared'>) =>
    request<Budget>('/api/finances/budgets', token, { method: 'POST', body: JSON.stringify(draft) }),
  updateBudget: (token: string, budgetId: string, updates: Partial<Pick<Budget, 'monthly_limit' | 'is_shared'>>) =>
    request<Budget>(`/api/finances/budgets/${budgetId}`, token, { method: 'PATCH', body: JSON.stringify(updates) }),
  deleteBudget: (token: string, budgetId: string) =>
    request<void>(`/api/finances/budgets/${budgetId}`, token, { method: 'DELETE' }),
  coupleBudgetStatus: (token: string) =>
    request<{ categories: CoupleBudgetStatus[] }>('/api/finances/couple-budget-status', token),
  listFinanceTransactions: (token: string, month?: string, category?: FinanceCategory) => {
    const params = new URLSearchParams();
    if (month) params.set('month', month);
    if (category) params.set('category', category);
    const suffix = params.toString();
    return request<{ transactions: FinanceTransaction[] }>(`/api/finances/transactions${suffix ? `?${suffix}` : ''}`, token);
  },
  updateFinanceTransaction: (token: string, transactionId: string, updates: Partial<Pick<FinanceTransaction, 'category' | 'is_shared'>>) =>
    request<FinanceTransaction>(`/api/finances/transactions/${transactionId}`, token, {
      method: 'PATCH', body: JSON.stringify(updates),
    }),
};
