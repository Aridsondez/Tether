import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { hexToRgba, PARTNER_A } from '@/components/atmosphere';
import { ApiError, CALENDAR_PROVIDERS, tetherApi, type CalendarFeed, type CalendarProvider } from '@/lib/api';

const PROVIDER_HELP: Record<CalendarProvider, string> = {
  google: 'Google Calendar (web) → Settings for your calendar → "Integrate calendar" → copy the Secret address in iCal format.',
  apple: 'Apple Calendar (Mac) → right-click the calendar → Sharing Settings → Public Calendar → copy the URL (change webcal:// to https://).',
  outlook: 'Outlook.com → Calendar settings → Shared calendars → Publish a calendar → copy the ICS link.',
  other: 'Paste any public or private .ics calendar URL.',
};

type CalendarConnectionsSheetProps = {
  visible: boolean;
  onClose: () => void;
  getToken: () => Promise<string | null>;
  onFeedsChanged: () => void;
};

export function CalendarConnectionsSheet({ visible, onClose, getToken, onFeedsChanged }: CalendarConnectionsSheetProps) {
  const [feeds, setFeeds] = useState<CalendarFeed[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyFeedId, setBusyFeedId] = useState<string | null>(null);
  const [exportToken, setExportToken] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [provider, setProvider] = useState<CalendarProvider>('google');
  const [name, setName] = useState('');
  const [feedUrl, setFeedUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new ApiError('Your sign-in session has expired. Please sign in again.');
      const [feedsResponse, linkResponse] = await Promise.all([
        tetherApi.listCalendarFeeds(token),
        tetherApi.getExportLink(token),
      ]);
      setFeeds(feedsResponse.feeds);
      setExportToken(linkResponse.export_token);
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Could not load connected calendars.');
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (visible) void load();
    else {
      setShowAddForm(false);
      setError(null);
    }
  }, [visible, load]);

  async function addFeed() {
    if (!name.trim() || !feedUrl.trim()) {
      Alert.alert('Missing info', 'Give the calendar a name and its address.');
      return;
    }
    setAdding(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new ApiError('Your sign-in session has expired. Please sign in again.');
      await tetherApi.createCalendarFeed(token, { provider, name: name.trim(), feed_url: feedUrl.trim() });
      setName('');
      setFeedUrl('');
      setShowAddForm(false);
      await load();
      onFeedsChanged();
    } catch (reason) {
      Alert.alert('Could not connect', reason instanceof ApiError ? reason.message : 'Check the address and try again.');
    } finally {
      setAdding(false);
    }
  }

  async function resyncFeed(feedId: string) {
    setBusyFeedId(feedId);
    try {
      const token = await getToken();
      if (!token) throw new ApiError('Your sign-in session has expired. Please sign in again.');
      await tetherApi.syncCalendarFeed(token, feedId);
      await load();
      onFeedsChanged();
    } catch (reason) {
      Alert.alert('Sync failed', reason instanceof ApiError ? reason.message : 'Please try again.');
    } finally {
      setBusyFeedId(null);
    }
  }

  function confirmRemoveFeed(feed: CalendarFeed) {
    Alert.alert('Remove this calendar?', `${feed.name} will no longer show up in your Tether calendar.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void removeFeed(feed.id) },
    ]);
  }

  async function removeFeed(feedId: string) {
    setBusyFeedId(feedId);
    try {
      const token = await getToken();
      if (!token) throw new ApiError('Your sign-in session has expired. Please sign in again.');
      await tetherApi.deleteCalendarFeed(token, feedId);
      await load();
      onFeedsChanged();
    } catch (reason) {
      Alert.alert('Could not remove', reason instanceof ApiError ? reason.message : 'Please try again.');
    } finally {
      setBusyFeedId(null);
    }
  }

  async function copyExportLink() {
    if (!exportToken) return;
    await Clipboard.setStringAsync(tetherApi.calendarExportUrl(exportToken));
    Alert.alert('Copied', 'Paste this address into Google/Apple/Outlook as a "subscribe by URL" calendar.');
  }

  async function rotateLink() {
    Alert.alert('Rotate export link?', 'The old link will stop working anywhere it was added.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Rotate',
        style: 'destructive',
        onPress: async () => {
          try {
            const token = await getToken();
            if (!token) throw new ApiError('Your sign-in session has expired. Please sign in again.');
            const response = await tetherApi.rotateExportLink(token);
            setExportToken(response.export_token);
          } catch (reason) {
            Alert.alert('Could not rotate link', reason instanceof ApiError ? reason.message : 'Please try again.');
          }
        },
      },
    ]);
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.screen}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>Connected calendars</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.headerAction}>Done</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {loading ? (
              <ActivityIndicator color="#F7F8FA" style={styles.loading} />
            ) : (
              <>
                <Text style={styles.sectionLabel}>YOUR CALENDARS, IN ONE PLACE</Text>
                <Text style={styles.blurb}>
                  Add a Google, Apple, or Outlook calendar by its private address and it shows up alongside your Tether
                  events — read-only, refreshed whenever you resync.
                </Text>

                {feeds.map((feed) => (
                  <View key={feed.id} style={styles.feedRow}>
                    <View style={[styles.feedDot, { backgroundColor: feed.color }]} />
                    <View style={styles.feedInfo}>
                      <Text style={styles.feedName}>{feed.name}</Text>
                      <Text style={styles.feedMeta}>
                        {feed.sync_status === 'error'
                          ? `Sync error${feed.last_error ? `: ${feed.last_error}` : ''}`
                          : feed.last_synced_at
                            ? `Synced ${new Date(feed.last_synced_at).toLocaleString()}`
                            : 'Not yet synced'}
                      </Text>
                    </View>
                    {busyFeedId === feed.id ? (
                      <ActivityIndicator color="#F7F8FA" />
                    ) : (
                      <View style={styles.feedActions}>
                        <Pressable onPress={() => void resyncFeed(feed.id)} hitSlop={8}>
                          <Text style={styles.feedAction}>Resync</Text>
                        </Pressable>
                        <Pressable onPress={() => confirmRemoveFeed(feed)} hitSlop={8}>
                          <Text style={[styles.feedAction, styles.feedActionDanger]}>Remove</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                ))}

                {!showAddForm ? (
                  <Pressable onPress={() => setShowAddForm(true)} style={styles.addButton}>
                    <Text style={styles.addButtonText}>+ Add a calendar</Text>
                  </Pressable>
                ) : (
                  <View style={styles.addForm}>
                    <View style={styles.chipRow}>
                      {CALENDAR_PROVIDERS.map((entry) => (
                        <Pressable
                          key={entry.value}
                          onPress={() => setProvider(entry.value)}
                          style={[
                            styles.chip,
                            provider === entry.value && { borderColor: PARTNER_A, backgroundColor: hexToRgba(PARTNER_A, 0.16) },
                          ]}>
                          <Text style={[styles.chipText, provider === entry.value && { color: '#F7F8FA' }]}>{entry.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <Text style={styles.helpText}>{PROVIDER_HELP[provider]}</Text>
                    <TextInput
                      placeholder="Calendar name (e.g. Alex's Google Calendar)"
                      placeholderTextColor="#8E93A1"
                      style={styles.input}
                      value={name}
                      onChangeText={setName}
                    />
                    <TextInput
                      placeholder="https://calendar.google.com/calendar/ical/…"
                      placeholderTextColor="#8E93A1"
                      style={styles.input}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="url"
                      value={feedUrl}
                      onChangeText={setFeedUrl}
                    />
                    <View style={styles.formActions}>
                      <Pressable onPress={() => setShowAddForm(false)} style={styles.secondaryButton} disabled={adding}>
                        <Text style={styles.secondaryButtonText}>Cancel</Text>
                      </Pressable>
                      <Pressable onPress={() => void addFeed()} style={styles.primaryButton} disabled={adding}>
                        <Text style={styles.primaryButtonText}>{adding ? 'Connecting…' : 'Connect'}</Text>
                      </Pressable>
                    </View>
                  </View>
                )}

                <Text style={[styles.sectionLabel, styles.exportLabel]}>SHARE TETHER WITH AN EXTERNAL APP</Text>
                <Text style={styles.blurb}>
                  Subscribe to this address from Google Calendar, Apple Calendar, or Outlook to see your shared Tether
                  events there too. Private events are never included.
                </Text>
                <Pressable onPress={() => void copyExportLink()} style={styles.exportRow} disabled={!exportToken}>
                  <Text style={styles.exportUrl} numberOfLines={1}>
                    {exportToken ? tetherApi.calendarExportUrl(exportToken) : 'Loading…'}
                  </Text>
                  <Text style={styles.copyText}>Copy</Text>
                </Pressable>
                <Pressable onPress={() => void rotateLink()} hitSlop={8}>
                  <Text style={styles.rotateText}>Rotate link</Text>
                </Pressable>

                {error && <Text style={styles.error}>{error}</Text>}
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#0B0C10', flex: 1 },
  safeArea: { flex: 1 },
  headerRow: { alignItems: 'center', borderBottomColor: 'rgba(255,255,255,0.08)', borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 14, paddingHorizontal: 20, paddingTop: 8 },
  headerTitle: { color: '#F7F8FA', fontSize: 17, fontWeight: '700' },
  headerAction: { color: PARTNER_A, fontSize: 16, fontWeight: '700' },
  scrollContent: { gap: 12, paddingBottom: 48, paddingHorizontal: 20, paddingTop: 18 },
  loading: { marginTop: 60 },
  sectionLabel: { color: '#8E93A1', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  exportLabel: { marginTop: 18 },
  blurb: { color: '#A9ADB7', fontSize: 13, lineHeight: 19, marginBottom: 4 },
  feedRow: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 12, padding: 14 },
  feedDot: { borderRadius: 5, height: 10, width: 10 },
  feedInfo: { flex: 1, gap: 2 },
  feedName: { color: '#F7F8FA', fontSize: 15, fontWeight: '600' },
  feedMeta: { color: '#8E93A1', fontSize: 12 },
  feedActions: { flexDirection: 'row', gap: 14 },
  feedAction: { color: PARTNER_A, fontSize: 13, fontWeight: '600' },
  feedActionDanger: { color: '#FF9A9A' },
  addButton: { alignItems: 'center', borderColor: 'rgba(255,255,255,0.16)', borderRadius: 16, borderStyle: 'dashed', borderWidth: 1, marginTop: 4, paddingVertical: 16 },
  addButtonText: { color: PARTNER_A, fontSize: 15, fontWeight: '700' },
  addForm: { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, gap: 10, padding: 14 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderColor: 'rgba(255,255,255,0.16)', borderRadius: 100, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { color: '#B8BBC5', fontSize: 13, fontWeight: '600' },
  helpText: { color: '#8E93A1', fontSize: 12, lineHeight: 17 },
  input: { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, color: '#F7F8FA', fontSize: 14, minHeight: 46, paddingHorizontal: 14 },
  formActions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end', marginTop: 4 },
  secondaryButton: { paddingHorizontal: 14, paddingVertical: 10 },
  secondaryButtonText: { color: '#C5C9D8', fontSize: 14, fontWeight: '600' },
  primaryButton: { backgroundColor: '#E8EBFF', borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10 },
  primaryButtonText: { color: '#1B1E2B', fontSize: 14, fontWeight: '700' },
  exportRow: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  exportUrl: { color: '#AEB6FF', flex: 1, fontSize: 13 },
  copyText: { color: PARTNER_A, fontSize: 13, fontWeight: '700' },
  rotateText: { color: '#8E93A1', fontSize: 12, fontWeight: '600', marginTop: 2, textAlign: 'right' },
  error: { color: '#FF9A9A', fontSize: 13, marginTop: 8 },
});
