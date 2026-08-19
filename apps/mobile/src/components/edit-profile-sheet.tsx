import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type ReactNode } from 'react';

import { PARTNER_A } from '@/components/atmosphere';
import { ApiError, USER_COLOR_PALETTE, tetherApi, type MeResponse, type UserColor } from '@/lib/api';

function toDateOnly(value: Date) {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDisplayDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

type EditProfileSheetProps = {
  visible: boolean;
  onClose: () => void;
  getToken: () => Promise<string | null>;
  me: MeResponse | null;
  onSaved: (me: MeResponse) => void;
};

export function EditProfileSheet({ visible, onClose, getToken, me, onSaved }: EditProfileSheetProps) {
  const [displayName, setDisplayName] = useState('');
  const [hasBirthday, setHasBirthday] = useState(false);
  const [birthday, setBirthday] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingColor, setSavingColor] = useState<UserColor | null>(null);
  const [colorError, setColorError] = useState<string | null>(null);

  const myColor = me?.user.color ?? null;
  const partnerColor = me?.relationship?.partner_color ?? null;

  useEffect(() => {
    if (!visible) return;
    setDisplayName(me?.user.display_name ?? '');
    setHasBirthday(Boolean(me?.profile?.birthday));
    setBirthday(me?.profile?.birthday ? new Date(`${me.profile.birthday}T00:00:00`) : new Date());
    setShowPicker(false);
    setError(null);
    setColorError(null);
  }, [visible, me]);

  function selectBirthday(selected: Date) {
    setBirthday(selected);
    setHasBirthday(true);
  }

  function openBirthdayPicker() {
    // Rendering DateTimePicker declaratively on Android causes it to flash
    // open and immediately dismiss on re-render; the imperative API is the
    // documented fix. iOS keeps the inline declarative picker.
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: hasBirthday ? birthday : new Date(2000, 0, 1),
        mode: 'date',
        maximumDate: new Date(),
        onChange: (event, selected) => {
          if (event.type === 'set' && selected) selectBirthday(selected);
        },
      });
      return;
    }
    setShowPicker(true);
  }

  async function save() {
    const trimmedName = displayName.trim();
    if (!trimmedName) {
      setError('Give yourself a name.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new ApiError('Your sign-in session has expired. Please sign in again.');
      const updated = await tetherApi.updateProfile(token, {
        display_name: trimmedName,
        first_name: me?.profile?.first_name ?? null,
        last_name: me?.profile?.last_name ?? null,
        pronouns: null,
        bio: null,
        birthday: hasBirthday ? toDateOnly(birthday) : null,
      });
      onSaved(updated);
      onClose();
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  }

  async function pickColor(color: UserColor) {
    if (color === partnerColor) return;
    setSavingColor(color);
    setColorError(null);
    try {
      const token = await getToken();
      if (!token) throw new ApiError('Your sign-in session has expired. Please sign in again.');
      onSaved(await tetherApi.updateMyColor(token, color));
    } catch (reason) {
      setColorError(reason instanceof ApiError ? reason.message : 'Could not update your color.');
    } finally {
      setSavingColor(null);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.screen}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          <View style={styles.headerRow}>
            <Pressable onPress={onClose} hitSlop={12} disabled={saving}>
              <Text style={styles.headerCancel}>Cancel</Text>
            </Pressable>
            <Text style={styles.headerTitle}>Edit profile</Text>
            <Pressable onPress={() => void save()} hitSlop={12} disabled={saving}>
              <Text style={[styles.headerAction, saving && styles.headerActionMuted]}>{saving ? 'Saving…' : 'Save'}</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            <Field label="Name">
              <TextInput
                placeholder="Your name"
                placeholderTextColor="#8E93A1"
                style={styles.input}
                value={displayName}
                onChangeText={setDisplayName}
              />
            </Field>

            <Field label="Your color">
              <Text style={styles.fieldHint}>How you show up on the map & timeline.</Text>
              <View style={styles.swatchRow}>
                {USER_COLOR_PALETTE.map((color) => {
                  const mine = color === myColor;
                  const takenByPartner = !mine && color === partnerColor;
                  return (
                    <Pressable
                      key={color}
                      disabled={takenByPartner || savingColor !== null}
                      onPress={() => void pickColor(color)}
                      style={[
                        styles.swatch,
                        { backgroundColor: color },
                        mine && styles.swatchActive,
                        takenByPartner && styles.swatchDisabled,
                      ]}>
                      {mine ? <Text style={styles.swatchGlyph}>✓</Text> : null}
                      {takenByPartner ? <Text style={styles.swatchGlyph}>✕</Text> : null}
                      {savingColor === color ? <Text style={styles.swatchGlyph}>…</Text> : null}
                    </Pressable>
                  );
                })}
              </View>
              {colorError ? <Text style={styles.error}>{colorError}</Text> : null}
            </Field>

            <Field label="Birthday">
              {hasBirthday ? (
                <View style={styles.birthdayRow}>
                  <Pressable onPress={openBirthdayPicker} style={styles.dateValue}>
                    <Text style={styles.dateValueText}>{formatDisplayDate(toDateOnly(birthday))}</Text>
                  </Pressable>
                  <Pressable onPress={() => { setHasBirthday(false); setShowPicker(false); }} hitSlop={8}>
                    <Text style={styles.removeDateText}>Remove</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable onPress={openBirthdayPicker} style={styles.addDateButton}>
                  <Text style={styles.addDateButtonText}>+ Add birthday</Text>
                </Pressable>
              )}
              {Platform.OS === 'ios' && showPicker ? (
                <DateTimePicker
                  value={birthday}
                  mode="date"
                  display="inline"
                  maximumDate={new Date()}
                  onChange={(_event, selected) => {
                    if (selected) selectBirthday(selected);
                  }}
                  themeVariant="dark"
                />
              ) : null}
            </Field>

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#0B0C10', flex: 1 },
  safeArea: { flex: 1 },
  headerRow: { alignItems: 'center', borderBottomColor: 'rgba(255,255,255,0.08)', borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 14, paddingHorizontal: 20, paddingTop: 8 },
  headerCancel: { color: '#A9ADB7', fontSize: 16, fontWeight: '600' },
  headerTitle: { color: '#F7F8FA', fontSize: 17, fontWeight: '700' },
  headerAction: { color: PARTNER_A, fontSize: 16, fontWeight: '700' },
  headerActionMuted: { opacity: 0.5 },
  form: { gap: 18, paddingBottom: 48, paddingHorizontal: 20, paddingTop: 18 },
  field: { gap: 8 },
  fieldLabel: { color: '#A9ADB7', fontSize: 13, fontWeight: '600' },
  fieldHint: { color: '#767C8A', fontSize: 12, lineHeight: 17, marginTop: -4 },
  input: { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, color: '#F7F8FA', fontSize: 16, minHeight: 50, paddingHorizontal: 14 },
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 2 },
  swatch: { alignItems: 'center', borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  swatchActive: { borderColor: '#F7F8FA', borderWidth: 3 },
  swatchDisabled: { opacity: 0.3 },
  swatchGlyph: { color: '#0B0C10', fontSize: 15, fontWeight: '800' },
  birthdayRow: { alignItems: 'center', flexDirection: 'row', gap: 16 },
  dateValue: { paddingVertical: 4 },
  dateValueText: { color: PARTNER_A, fontSize: 15, fontWeight: '700' },
  removeDateText: { color: '#8E93A1', fontSize: 13, fontWeight: '600' },
  addDateButton: { alignItems: 'flex-start', paddingVertical: 4 },
  addDateButtonText: { color: PARTNER_A, fontSize: 15, fontWeight: '700' },
  error: { color: '#FF9A9A', fontSize: 14, lineHeight: 20 },
});
