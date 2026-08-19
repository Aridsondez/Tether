import { useAuth } from '@clerk/expo';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Atmosphere, GlassCard, PARTNER_A, PARTNER_B } from '@/components/atmosphere';
import { ApiError, FINANCE_CATEGORIES, tetherApi, type Budget, type CoupleBudgetStatus, type FinanceAccount, type FinanceCategory } from '@/lib/api';
import { SkeletonBlock } from '@/components/skeleton';

const currency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
const labelFor = (category: FinanceCategory) => FINANCE_CATEGORIES.find((item) => item.value === category)?.label ?? category;

export default function FinancesScreen() {
  const { getToken, isSignedIn } = useAuth();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [coupleStatuses, setCoupleStatuses] = useState<CoupleBudgetStatus[]>([]);
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    const [budgetResult, accountResult, coupleResult] = await Promise.all([
      tetherApi.listBudgets(token),
      tetherApi.listFinanceAccounts(token),
      tetherApi.coupleBudgetStatus(token).catch(() => ({ categories: [] })),
    ]);
    setBudgets(budgetResult.budgets);
    setAccounts(accountResult.accounts);
    setCoupleStatuses(coupleResult.categories);
  }, [getToken]);

  useEffect(() => {
    if (!isSignedIn) return;
    void load().catch((reason) => setError(reason instanceof ApiError ? reason.message : 'Could not load finances.')).finally(() => setLoading(false));
  }, [isSignedIn, load]);

  async function toggleSharing(budget: Budget, isShared: boolean) {
    const token = await getToken();
    if (!token) return;
    try {
      const changed = await tetherApi.updateBudget(token, budget.id, { is_shared: isShared });
      void Haptics.selectionAsync();
      setBudgets((items) => items.map((item) => item.id === changed.id ? changed : item));
      await load();
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Could not update sharing.');
    }
  }

  async function launchPlaid() {
    // Expo Go does not contain Plaid's custom native module. Crucially, do not
    // import the SDK at module scope: that would crash every app screen before
    // this button is ever tapped.
    if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
      setError('Bank linking needs a custom iOS or Android build. Budgets work normally in Expo Go.');
      return;
    }
    const token = await getToken();
    if (!token) return;
    try {
      const { createPlaidLinkSession } = await import('react-native-plaid-link-sdk');
      const { link_token } = await tetherApi.createPlaidLinkToken(token);
      const session = await createPlaidLinkSession({
        token: link_token,
        onSuccess: (success) => {
          void (async () => {
            try {
              const linked = await tetherApi.exchangePlaidPublicToken(token, success.publicToken, success.metadata.institution);
              await tetherApi.syncPlaidItem(token, linked.item_id);
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              await load();
            } catch (reason) {
              setError(reason instanceof ApiError ? reason.message : 'Your account was connected, but Tether could not load it yet.');
            }
          })();
        },
        onExit: (exit) => {
          if (exit.error) setError(exit.error.displayMessage ?? exit.error.errorMessage ?? 'Bank connection was cancelled.');
        },
        onEvent: () => {},
      });
      await session.open();
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Could not open your bank connection.');
    }
  }

  return (
    <Atmosphere>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Back" hitSlop={12} onPress={() => router.back()}><Text style={styles.back}>‹</Text></Pressable>
          <Pressable onPress={() => setComposerOpen(true)} style={styles.add}><Text style={styles.addText}>+ Budget</Text></Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.eyebrow}>PRIVATE BY DEFAULT</Text>
          <Text style={styles.title}>Finances</Text>
          <Text style={styles.subtitle}>Your accounts are only yours. Share a budget category when you want to coordinate.</Text>

          {loading ? <FinancesSkeleton /> : <>
            {accounts.length === 0 ? (
              <GlassCard style={styles.linkCard}>
                <Text style={styles.cardTitle}>Connect your accounts</Text>
                <Text style={styles.cardCopy}>Link a bank or card to automatically sort spending into your personal budgets.</Text>
                <Pressable style={styles.primaryButton} onPress={() => void launchPlaid()}><Text style={styles.primaryText}>Link a bank</Text></Pressable>
              </GlassCard>
            ) : (
              <GlassCard style={styles.accountCard}>
                <Text style={styles.cardTitle}>Your accounts</Text>
                {accounts.slice(0, 3).map((account) => <View key={account.id} style={styles.accountRow}><Text style={styles.accountName}>{account.name}{account.mask ? ` ··${account.mask}` : ''}</Text><Text style={styles.balance}>{currency(account.current_balance ?? 0)}</Text></View>)}
                <Text style={styles.personalNote}>Balances and debt details are never shared.</Text>
              </GlassCard>
            )}

            <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Your monthly budgets</Text><Text style={styles.sectionHint}>Only you see amounts</Text></View>
            {budgets.length === 0 ? <Text style={styles.empty}>Set a category budget to start seeing where your money is going.</Text> : budgets.map((budget) => (
              <BudgetCard key={budget.id} budget={budget} onToggle={toggleSharing} />
            ))}

            {coupleStatuses.some((entry) => entry.partner || entry.pool) ? <>
              <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Together</Text><Text style={styles.sectionHint}>Only shared categories</Text></View>
              {coupleStatuses.filter((entry) => entry.partner || entry.pool).map((entry) => <PartnerCard key={entry.category} entry={entry} />)}
            </> : null}
          </>}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>
      </SafeAreaView>
      <BudgetComposer visible={composerOpen} onClose={() => setComposerOpen(false)} onCreated={async (budget) => { setBudgets((items) => [...items, budget]); setComposerOpen(false); await load(); }} />
    </Atmosphere>
  );
}

function FinancesSkeleton() {
  return (
    <View style={styles.skeletonWrap}>
      <GlassCard style={styles.linkCard}>
        <SkeletonBlock width={150} height={16} />
        <SkeletonBlock width="85%" height={13} />
        <SkeletonBlock width={112} height={38} radius={16} style={{ marginTop: 2 }} />
      </GlassCard>

      <SkeletonBlock width={170} height={17} style={{ marginTop: 4 }} />
      {[0, 1].map((key) => (
        <GlassCard key={key} style={styles.budgetCard}>
          <View style={styles.rowBetween}>
            <SkeletonBlock width={110} height={16} />
            <SkeletonBlock width={70} height={13} />
          </View>
          <SkeletonBlock width={130} height={23} />
          <SkeletonBlock width="100%" height={7} radius={8} />
        </GlassCard>
      ))}
    </View>
  );
}

function BudgetCard({ budget, onToggle }: { budget: Budget; onToggle: (budget: Budget, value: boolean) => void }) {
  const pct = Math.min(budget.percent_used, 100);
  const over = budget.status === 'over';
  return <GlassCard style={styles.budgetCard}>
    <View style={styles.rowBetween}><Text style={styles.cardTitle}>{labelFor(budget.category)}</Text><Text style={[styles.status, { color: over ? '#FF9A9A' : PARTNER_A }]}>{over ? 'Over budget' : `${currency(budget.remaining)} left`}</Text></View>
    <Text style={styles.amount}>{currency(budget.spent_amount)} <Text style={styles.of}>of {currency(budget.monthly_limit)}</Text></Text>
    <View style={styles.track}><View style={[styles.fill, { width: `${pct}%`, backgroundColor: over ? '#FF7373' : PARTNER_A }]} /></View>
    <View style={styles.shareRow}><View><Text style={styles.shareTitle}>Share category status</Text><Text style={styles.shareCopy}>{budget.is_shared ? 'Your partner sees over/under status, never your amounts.' : 'Private to you.'}</Text></View><Switch value={budget.is_shared} onValueChange={(value) => onToggle(budget, value)} trackColor={{ false: '#3C414D', true: '#6D7FD9' }} /></View>
  </GlassCard>;
}

function PartnerCard({ entry }: { entry: CoupleBudgetStatus }) {
  return <GlassCard style={styles.partnerCard}>
    <View style={styles.rowBetween}><Text style={styles.cardTitle}>{labelFor(entry.category)}</Text><Text style={[styles.status, { color: PARTNER_B }]}>{entry.partner ? `Partner: ${entry.partner.status === 'over' ? 'over' : 'on track'}` : 'Shared'}</Text></View>
    {entry.pool ? <><Text style={styles.poolAmount}>{currency(entry.pool.remaining)} <Text style={styles.of}>left together</Text></Text><Text style={styles.shareCopy}>{currency(entry.pool.combined_spent)} of {currency(entry.pool.combined_limit)} shared pool</Text></> : <Text style={styles.shareCopy}>Both of you can make this a combined pool by sharing the same category.</Text>}
  </GlassCard>;
}

function BudgetComposer({ visible, onClose, onCreated }: { visible: boolean; onClose: () => void; onCreated: (budget: Budget) => void }) {
  const { getToken } = useAuth();
  const [category, setCategory] = useState<FinanceCategory>('dining_out');
  const [limit, setLimit] = useState('300');
  const [isShared, setIsShared] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save() {
    const amount = Number(limit);
    if (!Number.isFinite(amount) || amount <= 0) { setError('Enter a monthly amount greater than zero.'); return; }
    const token = await getToken(); if (!token) return;
    setSaving(true); setError(null);
    try { const budget = await tetherApi.createBudget(token, { category, monthly_limit: amount, is_shared: isShared }); void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); onCreated(budget); }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : 'Could not save budget.'); }
    finally { setSaving(false); }
  }
  return <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={styles.sheet}>
    <View style={styles.sheetHeader}><Text style={styles.sheetTitle}>New monthly budget</Text><Pressable onPress={onClose}><Text style={styles.close}>×</Text></Pressable></View>
    <Text style={styles.fieldLabel}>Category</Text><View style={styles.categoryGrid}>{FINANCE_CATEGORIES.map((item) => <Pressable key={item.value} onPress={() => setCategory(item.value)} style={[styles.categoryChip, category === item.value && styles.categoryChipActive]}><Text style={[styles.categoryText, category === item.value && styles.categoryTextActive]}>{item.label}</Text></Pressable>)}</View>
    <Text style={styles.fieldLabel}>Monthly limit</Text><TextInput keyboardType="decimal-pad" value={limit} onChangeText={setLimit} style={styles.input} placeholder="$300" placeholderTextColor="#737988" />
    <View style={styles.shareRow}><View><Text style={styles.shareTitle}>Share category status</Text><Text style={styles.shareCopy}>Your partner will never see your amounts.</Text></View><Switch value={isShared} onValueChange={setIsShared} trackColor={{ false: '#3C414D', true: '#6D7FD9' }} /></View>
    {error ? <Text style={styles.error}>{error}</Text> : null}<Pressable disabled={saving} onPress={save} style={styles.saveButton}><Text style={styles.saveText}>{saving ? 'Saving…' : 'Create budget'}</Text></Pressable>
  </View></View></Modal>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 }, header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8 }, back: { color: '#F7F8FA', fontSize: 38, lineHeight: 40 }, add: { backgroundColor: 'rgba(174,187,255,0.16)', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9 }, addText: { color: '#D6DEFF', fontSize: 13, fontWeight: '700' }, content: { gap: 12, padding: 20, paddingTop: 12, paddingBottom: 44 }, eyebrow: { color: '#AEBBFF', fontSize: 11, fontWeight: '800', letterSpacing: 2.2 }, title: { color: '#F7F8FA', fontSize: 34, fontWeight: '700', letterSpacing: -1.2, marginTop: 3 }, subtitle: { color: '#A9ADB7', fontSize: 15, lineHeight: 22, marginBottom: 10 }, skeletonWrap: { gap: 12 }, linkCard: { gap: 10, padding: 20 }, cardTitle: { color: '#F7F8FA', fontSize: 16, fontWeight: '700' }, cardCopy: { color: '#A9ADB7', fontSize: 13, lineHeight: 19 }, primaryButton: { alignSelf: 'flex-start', backgroundColor: PARTNER_A, borderRadius: 16, marginTop: 4, paddingHorizontal: 15, paddingVertical: 10 }, primaryText: { color: '#12151D', fontSize: 13, fontWeight: '800' }, accountCard: { gap: 10, padding: 18 }, accountRow: { flexDirection: 'row', justifyContent: 'space-between' }, accountName: { color: '#CDD0D8', fontSize: 13 }, balance: { color: '#F7F8FA', fontSize: 13, fontWeight: '700' }, personalNote: { color: '#788090', fontSize: 12, marginTop: 3 }, sectionHeading: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 }, sectionTitle: { color: '#F7F8FA', fontSize: 17, fontWeight: '700' }, sectionHint: { color: '#788090', fontSize: 11 }, empty: { color: '#A9ADB7', fontSize: 14, lineHeight: 21, paddingVertical: 8 }, budgetCard: { gap: 9, padding: 17 }, rowBetween: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between' }, status: { fontSize: 12, fontWeight: '700' }, amount: { color: '#F7F8FA', fontSize: 23, fontWeight: '700' }, of: { color: '#A9ADB7', fontSize: 13, fontWeight: '500' }, track: { backgroundColor: 'rgba(255,255,255,0.09)', borderRadius: 8, height: 7, overflow: 'hidden' }, fill: { borderRadius: 8, height: '100%' }, shareRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }, shareTitle: { color: '#D6D9E0', fontSize: 13, fontWeight: '600' }, shareCopy: { color: '#89909E', fontSize: 11, lineHeight: 16, marginTop: 2 }, partnerCard: { gap: 7, padding: 17 }, poolAmount: { color: '#F7F8FA', fontSize: 22, fontWeight: '700' }, error: { color: '#FF9A9A', fontSize: 13, lineHeight: 18, marginTop: 6 }, modalBackdrop: { backgroundColor: 'rgba(0,0,0,0.6)', flex: 1, justifyContent: 'flex-end' }, sheet: { backgroundColor: '#181B23', borderTopLeftRadius: 28, borderTopRightRadius: 28, gap: 12, padding: 22, paddingBottom: 36 }, sheetHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, sheetTitle: { color: '#F7F8FA', fontSize: 20, fontWeight: '700' }, close: { color: '#B8BDC9', fontSize: 28 }, fieldLabel: { color: '#B8BDC9', fontSize: 12, fontWeight: '700', marginTop: 4 }, categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, categoryChip: { borderColor: 'rgba(255,255,255,0.15)', borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 10, paddingVertical: 7 }, categoryChipActive: { backgroundColor: 'rgba(174,187,255,0.18)', borderColor: PARTNER_A }, categoryText: { color: '#B8BDC9', fontSize: 12 }, categoryTextActive: { color: '#DCE3FF', fontWeight: '700' }, input: { backgroundColor: '#222631', borderColor: 'rgba(255,255,255,0.14)', borderRadius: 14, borderWidth: 1, color: '#F7F8FA', fontSize: 18, paddingHorizontal: 14, paddingVertical: 11 }, saveButton: { alignItems: 'center', backgroundColor: PARTNER_A, borderRadius: 16, marginTop: 4, paddingVertical: 14 }, saveText: { color: '#111318', fontSize: 14, fontWeight: '800' },
});
