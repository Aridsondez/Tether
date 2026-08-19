import { useAuth } from '@clerk/expo';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Atmosphere, GlassCard, PARTNER_A } from '@/components/atmosphere';
import { ApiError, RELATIONSHIP_STAGES, type MeResponse, type RelationshipStage, tetherApi } from '@/lib/api';

function displayDate(value: string | null | undefined) {
  return value ? new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : 'Not set';
}

export default function AboutUsScreen() {
  const { getToken, isSignedIn } = useAuth();
  const tokenRef = useRef(getToken);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [stage, setStage] = useState<RelationshipStage>('partners');
  const [metOn, setMetOn] = useState('');
  const [anniversaryOn, setAnniversaryOn] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { tokenRef.current = getToken; }, [getToken]);
  const load = useCallback(async () => {
    const token = await tokenRef.current();
    if (!token) return;
    const response = await tetherApi.me(token);
    setMe(response);
    setStage(response.relationship_profile?.relationship_stage ?? 'partners');
    setMetOn(response.relationship_profile?.met_on ?? '');
    setAnniversaryOn(response.relationship_profile?.anniversary_on ?? '');
  }, []);
  useEffect(() => { if (isSignedIn) void load().catch((reason) => setError(reason instanceof ApiError ? reason.message : 'Could not load your relationship.')); }, [isSignedIn, load]);

  async function save() {
    const validDate = (value: string) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value);
    if (!validDate(metOn) || !validDate(anniversaryOn)) { setError('Use YYYY-MM-DD for dates.'); return; }
    setSaving(true); setError(null);
    try {
      const token = await tokenRef.current();
      if (!token) throw new ApiError('Your sign-in session has expired. Please sign in again.');
      setMe(await tetherApi.updateRelationshipProfile(token, { relationship_stage: stage, met_on: metOn || null, anniversary_on: anniversaryOn || null }));
    } catch (reason) { setError(reason instanceof ApiError ? reason.message : 'Could not save your relationship details.'); }
    finally { setSaving(false); }
  }

  const partnerName = me?.relationship?.partner_display_name ?? 'your person';
  return <Atmosphere><SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
    <View style={styles.header}><Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Profile</Text></Pressable><Pressable disabled={saving} onPress={() => void save()}><Text style={styles.save}>{saving ? 'Saving…' : 'Save'}</Text></Pressable></View>
    {!me ? <ActivityIndicator color="#F7F8FA" style={styles.loading} /> : <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>About us</Text><Text style={styles.subtitle}>Shared details about you and {partnerName}.</Text>
      <GlassCard style={styles.card}><Text style={styles.label}>RELATIONSHIP STATUS</Text><View style={styles.chips}>{RELATIONSHIP_STAGES.map((item) => <Pressable key={item.value} onPress={() => setStage(item.value)} style={[styles.chip, stage === item.value && styles.chipActive]}><Text style={[styles.chipText, stage === item.value && styles.chipTextActive]}>{item.label}</Text></Pressable>)}</View></GlassCard>
      <GlassCard style={styles.card}><Text style={styles.fieldLabel}>When did you meet?</Text><TextInput value={metOn} onChangeText={setMetOn} placeholder="YYYY-MM-DD" placeholderTextColor="#8E93A1" style={styles.input} /><Text style={styles.hint}>{displayDate(metOn)}</Text><Text style={styles.fieldLabel}>Anniversary</Text><TextInput value={anniversaryOn} onChangeText={setAnniversaryOn} placeholder="YYYY-MM-DD" placeholderTextColor="#8E93A1" style={styles.input} /><Text style={styles.hint}>{displayDate(anniversaryOn)}</Text></GlassCard>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </ScrollView>}
  </SafeAreaView></Atmosphere>;
}

const styles = StyleSheet.create({ safe:{flex:1,paddingHorizontal:20,paddingTop:10},header:{alignItems:'center',flexDirection:'row',justifyContent:'space-between'},back:{color:PARTNER_A,fontSize:16,fontWeight:'700'},save:{color:PARTNER_A,fontSize:16,fontWeight:'800'},loading:{marginTop:48},content:{gap:14,paddingBottom:32,paddingTop:20},title:{color:'#F7F8FA',fontSize:32,fontWeight:'700',letterSpacing:-1},subtitle:{color:'#B8BBC5',fontSize:15,lineHeight:21,marginTop:-8},card:{gap:12},label:{color:PARTNER_A,fontSize:11,fontWeight:'800',letterSpacing:1.2},chips:{flexDirection:'row',flexWrap:'wrap',gap:8},chip:{borderColor:'rgba(255,255,255,0.16)',borderRadius:16,borderWidth:1,paddingHorizontal:12,paddingVertical:8},chipActive:{backgroundColor:'rgba(108,140,255,0.2)',borderColor:PARTNER_A},chipText:{color:'#C5C9D8',fontSize:13,fontWeight:'600'},chipTextActive:{color:'#E1E7FF'},fieldLabel:{color:'#DDE0E8',fontSize:14,fontWeight:'700',marginTop:2},input:{backgroundColor:'#222631',borderColor:'rgba(255,255,255,0.14)',borderRadius:13,borderWidth:1,color:'#F7F8FA',fontSize:16,paddingHorizontal:13,paddingVertical:11},hint:{color:'#858B99',fontSize:12,marginTop:-5},error:{color:'#FF9A9A',fontSize:13} });
