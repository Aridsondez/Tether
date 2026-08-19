import { useAuth, useUser } from '@clerk/expo';
import { useHostedAuth } from '@clerk/expo/hosted-auth';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Atmosphere, GlassCard, PARTNER_A } from '@/components/atmosphere';
import { HomeDashboard } from '@/components/home-dashboard';
import { ApiError, type InvitationResponse, type MeResponse, type PartnerNote, type PendingInvitation, tetherApi } from '@/lib/api';

type BusyAction = 'relationship' | 'invitation' | 'accepting' | 'inbox-accepting' | 'cancelling' | null;

function inviteTokenFromUrl(url: string | null) {
  if (!url) return null;
  const { path, queryParams } = Linking.parse(url);
  return path === 'invite' && typeof queryParams?.token === 'string' ? queryParams.token : null;
}

function userMessage(error: unknown) {
  return error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';
}

export default function HomeScreen() {
  const { getToken, isLoaded, isSignedIn, signOut } = useAuth();
  const getTokenRef = useRef(getToken);
  const { user } = useUser();
  const { startHostedAuth } = useHostedAuth();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [partnerEmail, setPartnerEmail] = useState('');
  const [issuedInvite, setIssuedInvite] = useState<InvitationResponse | null>(null);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [diningBudget, setDiningBudget] = useState<{ spent: number; limit: number; remaining: number } | null>(null);
  const [partnerNotes, setPartnerNotes] = useState<PartnerNote[]>([]);

  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  const loadAccount = useCallback(async () => {
    const token = await getTokenRef.current();
    if (!token) throw new ApiError('Your sign-in session has expired. Please sign in again.');
    const [account, invitations] = await Promise.all([
      tetherApi.me(token),
      tetherApi.pendingInvitations(token),
    ]);
    setMe(account);
    setPendingInvitations(invitations.invitations);
  }, []);

  useEffect(() => {
    void Linking.getInitialURL().then((url) => setInviteToken(inviteTokenFromUrl(url)));
    const subscription = Linking.addEventListener('url', ({ url }) => {
      const token = inviteTokenFromUrl(url);
      if (token) setInviteToken(token);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!isSignedIn) {
      setMe(null);
      setPendingInvitations([]);
      return;
    }
    void loadAccount().catch((reason) => {
      console.error('[Tether] Session established, but loading /api/me failed:', reason);
      setError(userMessage(reason));
    });
  }, [isSignedIn, loadAccount]);

  useEffect(() => {
    if (me?.relationship?.relationship_status !== 'active') {
      setDiningBudget(null);
      return;
    }
    void (async () => {
      const token = await getTokenRef.current();
      if (!token) return;
      try {
        const { categories } = await tetherApi.coupleBudgetStatus(token);
        const dining = categories.find((item) => item.category === 'dining_out');
        if (dining?.pool) {
          setDiningBudget({ spent: dining.pool.combined_spent, limit: dining.pool.combined_limit, remaining: dining.pool.remaining });
        } else if (dining?.mine) {
          setDiningBudget({ spent: dining.mine.spent_amount, limit: dining.mine.monthly_limit, remaining: dining.mine.remaining });
        } else {
          setDiningBudget(null);
        }
      } catch {
        // Finance is additive to the home screen; an unavailable Plaid setup must
        // not make the relationship dashboard fail to render.
        setDiningBudget(null);
      }
    })();
  }, [me?.relationship?.relationship_status]);

  useEffect(() => {
    if (me?.relationship?.relationship_status !== 'active') {
      setPartnerNotes([]);
      return;
    }
    void (async () => {
      const token = await getTokenRef.current();
      if (!token) return;
      try {
        const { notes } = await tetherApi.listPartnerNotes(token);
        setPartnerNotes(notes);
      } catch {
        // Additive preview only — Home must still render if this fails.
        setPartnerNotes([]);
      }
    })();
  }, [me?.relationship?.relationship_status]);

  async function authenticate(mode: 'sign-in' | 'sign-up') {
    setError(null);
    try {
      // Account Portal handles email links in the browser, then returns through the
      // registered native callback and activates the session before this screen re-renders.
      await startHostedAuth({ mode });
    } catch (reason) {
      console.error('[Tether] Clerk hosted authentication failed:', reason);
      setError(userMessage(reason));
    }
  }

  async function createRelationship() {
    setBusy('relationship');
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new ApiError('Your sign-in session has expired. Please sign in again.');
      await tetherApi.createRelationship(token);
      await loadAccount();
    } catch (reason) {
      setError(userMessage(reason));
    } finally {
      setBusy(null);
    }
  }

  async function createInvitation() {
    const email = partnerEmail.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError('Enter your partner’s email address.');
      return;
    }
    setBusy('invitation');
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new ApiError('Your sign-in session has expired. Please sign in again.');
      setIssuedInvite(await tetherApi.createInvitation(token, email));
    } catch (reason) {
      setError(userMessage(reason));
    } finally {
      setBusy(null);
    }
  }

  function confirmCancelConnection() {
    Alert.alert(
      'Cancel connection?',
      'This cancels the pending connection and makes any invitation link invalid.',
      [
        { text: 'Keep connection', style: 'cancel' },
        {
          text: 'Cancel connection',
          style: 'destructive',
          onPress: () => void cancelConnection(),
        },
      ],
    );
  }

  async function cancelConnection() {
    setBusy('cancelling');
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new ApiError('Your sign-in session has expired. Please sign in again.');
      await tetherApi.cancelPendingRelationship(token);
      setIssuedInvite(null);
      setPartnerEmail('');
      await loadAccount();
    } catch (reason) {
      setError(userMessage(reason));
    } finally {
      setBusy(null);
    }
  }

  async function acceptInvitation() {
    if (!inviteToken) return;
    setBusy('accepting');
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new ApiError('Your sign-in session has expired. Please sign in again.');
      await tetherApi.acceptInvitation(token, inviteToken);
      setInviteToken(null);
      await loadAccount();
    } catch (reason) {
      setError(userMessage(reason));
    } finally {
      setBusy(null);
    }
  }

  async function acceptInboxInvitation(invitationId: string) {
    setBusy('inbox-accepting');
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new ApiError('Your sign-in session has expired. Please sign in again.');
      await tetherApi.acceptPendingInvitation(token, invitationId);
      setPendingInvitations([]);
      await loadAccount();
    } catch (reason) {
      setError(userMessage(reason));
    } finally {
      setBusy(null);
    }
  }

  async function emailInvitation() {
    if (!issuedInvite) return;
    const link = Linking.createURL('invite', { queryParams: { token: issuedInvite.invite_token } });
    const subject = 'Join me on Tether';
    const body = `I’d love to build our shared life in Tether. Open this private invitation to connect with me:\n\n${link}`;
    const href = `mailto:${issuedInvite.invitation.invitee_email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    const supported = await Linking.canOpenURL(href);
    if (supported) await Linking.openURL(href);
    else Alert.alert('No email app found', `Share this private invitation link with ${issuedInvite.invitation.invitee_email}:\n${link}`);
  }

  if (!isLoaded) return <LoadingScreen />;

  if (!isSignedIn) {
    return (
      <Atmosphere>
        <SafeAreaView style={styles.authSafeArea} edges={['top', 'bottom']}>
          <View style={styles.authHero}>
            <Text style={styles.eyebrow}>TETHER</Text>
            <Text style={styles.wordmark}>A life,{"\n"}together.</Text>
            <Text style={styles.intro}>The private space for the two of you to plan, remember, and grow.</Text>
          </View>
          <GlassCard style={styles.authCard}>
            {inviteToken ? <InviteNotice /> : null}
            <PrimaryButton label="Continue with email" onPress={() => void authenticate('sign-in')} />
            <Pressable onPress={() => void authenticate('sign-up')} hitSlop={12} style={styles.secondaryActionWrap}>
              <Text style={styles.secondaryAction}>New here? Create your account</Text>
            </Pressable>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </GlassCard>
        </SafeAreaView>
      </Atmosphere>
    );
  }

  const relationship = me?.relationship;
  const pendingOwner = relationship?.role === 'owner' && relationship.relationship_status === 'pending';
  const connected = relationship?.relationship_status === 'active';
  const pendingInvitation = pendingInvitations[0];

  return (
    <Atmosphere>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <SafeAreaView edges={['top']}>
          <View style={styles.topbar}>
            <Text style={styles.eyebrow}>TETHER</Text>
            <Pressable onPress={() => void signOut()} hitSlop={12}><Text style={styles.signOut}>Sign out</Text></Pressable>
          </View>
        </SafeAreaView>
        <Text style={styles.greeting}>Hi, {me?.user.display_name || user?.firstName || 'there'}.</Text>
        <Text style={styles.subheading}>{connected ? 'Your shared space is ready.' : 'Let’s bring your person in.'}</Text>

        {inviteToken ? (
          <GlassCard style={[styles.focusCard, styles.inviteCard]}>
            <View style={styles.inviteTint} pointerEvents="none" />
            <View style={styles.kickerRow}>
              <View style={styles.kickerDot} />
              <Text style={styles.cardKickerAccent}>PRIVATE INVITATION</Text>
            </View>
            <Text style={styles.cardTitle}>You’ve been invited to Tether.</Text>
            <Text style={styles.cardCopy}>Accept to create a private space for the two of you.</Text>
            <PrimaryButton label={busy === 'accepting' ? 'Connecting…' : 'Accept invitation'} onPress={() => void acceptInvitation()} disabled={busy !== null} />
          </GlassCard>
        ) : pendingInvitation ? (
          <GlassCard style={[styles.focusCard, styles.inviteCard]}>
            <View style={styles.inviteTint} pointerEvents="none" />
            <View style={styles.kickerRow}>
              <View style={styles.kickerDot} />
              <Text style={styles.cardKickerAccent}>PENDING INVITATION</Text>
            </View>
            <Text style={styles.cardTitle}>You have a connection waiting.</Text>
            <Text style={styles.cardCopy}>Accept it to create your shared Tether.</Text>
            <PrimaryButton label={busy === 'inbox-accepting' ? 'Connecting…' : 'Accept invitation'} onPress={() => void acceptInboxInvitation(pendingInvitation.id)} disabled={busy !== null} />
            <Text style={styles.caption}>This invitation expires {new Date(pendingInvitation.expires_at).toLocaleDateString()}.</Text>
          </GlassCard>
        ) : connected && relationship?.connected_at ? (
          <HomeDashboard
            connectedAt={relationship.connected_at}
            diningBudget={diningBudget}
            partnerName={relationship.partner_display_name ?? null}
            userName={me?.user.display_name || user?.firstName || 'there'}
            partnerNotes={partnerNotes}
            onOpenPartnerNotes={() => router.push('/more/partner')}
            myColor={me?.user.color ?? undefined}
            partnerColor={relationship.partner_color ?? undefined}
          />
        ) : connected ? (
          <GlassCard style={styles.focusCard}>
            <Text style={styles.cardKicker}>YOU’RE CONNECTED</Text>
            <Text style={styles.cardTitle}>Your Tether is ready.</Text>
            <Text style={styles.cardCopy}>The foundation is set. Shared moments, plans, and rituals are next.</Text>
          </GlassCard>
        ) : pendingOwner ? (
          <GlassCard style={styles.focusCard}>
            <Text style={styles.cardKicker}>INVITE YOUR PARTNER</Text>
            <Text style={styles.cardTitle}>Make this a shared place.</Text>
            <Text style={styles.cardCopy}>We’ll create a private, one-time invitation link addressed to them.</Text>
            {issuedInvite ? (
              <View style={styles.inviteReady}>
                <Text style={styles.inviteEmail}>{issuedInvite.invitation.invitee_email}</Text>
                <PrimaryButton label="Open email invitation" onPress={() => void emailInvitation()} />
                <Text style={styles.caption}>This link expires {new Date(issuedInvite.invitation.expires_at).toLocaleDateString()}.</Text>
              </View>
            ) : (
              <View style={styles.form}>
                <TextInput autoCapitalize="none" autoComplete="email" keyboardType="email-address" onChangeText={setPartnerEmail} placeholder="Partner’s email address" placeholderTextColor="#8E93A1" style={styles.input} value={partnerEmail} />
                <PrimaryButton label={busy === 'invitation' ? 'Creating invitation…' : 'Create invitation'} onPress={() => void createInvitation()} disabled={busy !== null} />
              </View>
            )}
            <Pressable disabled={busy !== null} onPress={confirmCancelConnection} style={({ pressed }) => [styles.cancelConnection, (pressed || busy !== null) && styles.buttonMuted]}>
              <Text style={styles.cancelConnectionText}>{busy === 'cancelling' ? 'Cancelling…' : 'Cancel connection'}</Text>
            </Pressable>
          </GlassCard>
        ) : (
          <GlassCard style={styles.focusCard}>
            <Text style={styles.cardKicker}>START HERE</Text>
            <Text style={styles.cardTitle}>Create your Tether.</Text>
            <Text style={styles.cardCopy}>Start a private space, then invite the person you share life with.</Text>
            <PrimaryButton label={busy === 'relationship' ? 'Creating your space…' : 'Create a Tether'} onPress={() => void createRelationship()} disabled={busy !== null || !me} />
          </GlassCard>
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </Atmosphere>
  );
}

function PrimaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.primaryButton, (pressed || disabled) && styles.buttonMuted]}><Text style={styles.primaryButtonText}>{label}</Text></Pressable>;
}

function InviteNotice() {
  return (
    <View style={styles.inviteNotice}>
      <View style={styles.kickerRow}>
        <View style={styles.kickerDot} />
        <Text style={styles.cardKickerAccent}>PRIVATE INVITATION</Text>
      </View>
      <Text style={styles.noticeText}>You have a private invitation waiting. Sign in or create an account to continue.</Text>
    </View>
  );
}

function LoadingScreen() {
  return <Atmosphere><View style={styles.loading}><ActivityIndicator color="#F7F8FA" size="large" /></View></Atmosphere>;
}

const styles = StyleSheet.create({
  authSafeArea: { flex: 1, justifyContent: 'space-between', paddingBottom: 56, paddingHorizontal: 20, paddingTop: 32 },
  authHero: { alignItems: 'center', marginTop: 56 },
  authCard: { gap: 14, marginBottom: 12 },
  eyebrow: { color: '#AEBBFF', fontSize: 11, fontWeight: '800', letterSpacing: 3 },
  wordmark: { color: '#F7F8FA', fontSize: 52, fontWeight: '700', letterSpacing: -2.4, lineHeight: 56, marginTop: 18, textAlign: 'center' },
  intro: { color: '#B8BBC5', fontSize: 17, lineHeight: 25, marginTop: 20, maxWidth: 300, textAlign: 'center' },
  inviteNotice: { gap: 8 },
  noticeText: { color: '#DCE1FF', fontSize: 14, lineHeight: 20 },
  primaryButton: { alignItems: 'center', alignSelf: 'stretch', backgroundColor: '#E8EBFF', borderRadius: 18, minHeight: 56, justifyContent: 'center', paddingHorizontal: 20 },
  primaryButtonText: { color: '#1B1E2B', fontSize: 16, fontWeight: '700' },
  buttonMuted: { opacity: 0.58 },
  secondaryActionWrap: { alignItems: 'center' },
  secondaryAction: { color: '#C5C9D8', fontSize: 15, fontWeight: '600' },
  error: { color: '#FF9A9A', fontSize: 14, lineHeight: 20, marginTop: 16, textAlign: 'center' },
  loading: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  scrollContent: { flexGrow: 1, paddingBottom: 42, paddingHorizontal: 20 },
  topbar: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10 },
  signOut: { color: '#A9ADB7', fontSize: 14, fontWeight: '600' },
  greeting: { color: '#F7F8FA', fontSize: 38, fontWeight: '700', letterSpacing: -1.4, marginTop: 46 },
  subheading: { color: '#A9ADB7', fontSize: 17, lineHeight: 25, marginBottom: 30, marginTop: 10 },
  focusCard: { gap: 13 },
  inviteCard: { borderColor: 'rgba(108,140,255,0.35)' },
  inviteTint: { backgroundColor: 'rgba(108,140,255,0.08)', bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  kickerRow: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  kickerDot: { backgroundColor: PARTNER_A, borderRadius: 3, height: 6, width: 6 },
  cardKicker: { color: '#ABB9FF', fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  cardKickerAccent: { color: PARTNER_A, fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  cardTitle: { color: '#F7F8FA', fontSize: 27, fontWeight: '700', letterSpacing: -0.7, lineHeight: 33 },
  cardCopy: { color: '#B8BBC5', fontSize: 15, lineHeight: 22, marginBottom: 8 },
  form: { gap: 12, marginTop: 4 },
  input: { backgroundColor: 'rgba(5,6,9,0.34)', borderColor: 'rgba(255,255,255,0.14)', borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, color: '#F7F8FA', fontSize: 16, minHeight: 54, paddingHorizontal: 16 },
  inviteReady: { gap: 14, marginTop: 4 },
  inviteEmail: { color: '#F7F8FA', fontSize: 16, fontWeight: '600' },
  caption: { color: '#8E93A1', fontSize: 12, lineHeight: 17 },
  cancelConnection: { alignItems: 'center', marginTop: 8, minHeight: 44, justifyContent: 'center' },
  cancelConnectionText: { color: '#FFAAA8', fontSize: 14, fontWeight: '700' },
});
