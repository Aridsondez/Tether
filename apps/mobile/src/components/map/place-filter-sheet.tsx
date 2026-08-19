import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Atmosphere, GlassCard, PARTNER_A } from '@/components/atmosphere';
import { PLACE_CATEGORIES, type PlaceCategory } from '@/lib/api';

export type PlaceFilter =
  | { kind: 'category'; value: PlaceCategory }
  | { kind: 'both_like' }
  | { kind: 'mine' }
  | { kind: 'unvisited' };

export function filterKey(filter: PlaceFilter) {
  return filter.kind === 'category' ? `category:${filter.value}` : filter.kind;
}

const QUICK_FILTERS: { filter: PlaceFilter; label: string; hint: string }[] = [
  { filter: { kind: 'both_like' }, label: 'Both want to go', hint: 'Places you both marked as interested' },
  { filter: { kind: 'mine' }, label: 'Saved by me', hint: 'Only places you added' },
  { filter: { kind: 'unvisited' }, label: 'Unvisited', hint: 'Hide places already marked visited' },
];

type PlaceFilterButtonProps = {
  active: PlaceFilter[];
  topOffset: number;
  onToggle: (filter: PlaceFilter) => void;
  onClear: () => void;
};

export function PlaceFilterButton({ active, topOffset, onToggle, onClear }: PlaceFilterButtonProps) {
  const [open, setOpen] = useState(false);
  const count = active.length;
  const activeKeys = new Set(active.map(filterKey));

  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={[styles.trigger, { top: topOffset }]}>
        <GlassCard style={[styles.triggerInner, count > 0 && styles.triggerInnerActive]}>
          <Text style={styles.triggerIcon}>▤</Text>
          <Text style={[styles.triggerText, count > 0 && styles.triggerTextActive]}>
            {count > 0 ? `Filter · ${count}` : 'Filter'}
          </Text>
        </GlassCard>
      </Pressable>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <Atmosphere>
          <SafeAreaView style={styles.sheetSafe} edges={['top', 'bottom']}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Filter places</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={12}><Text style={styles.sheetClose}>Done</Text></Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.sectionLabel}>Quick filters</Text>
              {QUICK_FILTERS.map(({ filter, label, hint }) => (
                <FilterRow
                  key={filterKey(filter)}
                  label={label}
                  hint={hint}
                  selected={activeKeys.has(filterKey(filter))}
                  onPress={() => onToggle(filter)}
                />
              ))}

              <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>Category</Text>
              {PLACE_CATEGORIES.map(({ value, label }) => {
                const filter: PlaceFilter = { kind: 'category', value };
                return (
                  <FilterRow
                    key={value}
                    label={label}
                    selected={activeKeys.has(filterKey(filter))}
                    onPress={() => onToggle(filter)}
                  />
                );
              })}
            </ScrollView>

            <View style={styles.sheetFooter}>
              <Pressable disabled={count === 0} onPress={onClear} style={[styles.clearButton, count === 0 && styles.clearButtonDisabled]}>
                <Text style={styles.clearButtonText}>Clear all</Text>
              </Pressable>
              <Pressable onPress={() => setOpen(false)} style={styles.doneButton}>
                <Text style={styles.doneButtonText}>
                  {count > 0 ? `Show ${count} filter${count === 1 ? '' : 's'}` : 'Show all places'}
                </Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </Atmosphere>
      </Modal>
    </>
  );
}

function FilterRow({ label, hint, selected, onPress }: { label: string; hint?: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      <GlassCard style={[styles.row, selected && styles.rowActive]}>
        <View style={styles.rowText}>
          <Text style={[styles.rowLabel, selected && styles.rowLabelActive]}>{label}</Text>
          {hint ? <Text style={styles.rowHint}>{hint}</Text> : null}
        </View>
        <View style={[styles.checkbox, selected && styles.checkboxActive]}>
          {selected ? <Text style={styles.checkmark}>✓</Text> : null}
        </View>
      </GlassCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  trigger: { position: 'absolute', right: 16 },
  triggerInner: { alignItems: 'center', borderRadius: 22, flexDirection: 'row', gap: 8, height: 44, paddingHorizontal: 16 },
  triggerInnerActive: { backgroundColor: 'rgba(108,140,255,0.35)', borderColor: 'rgba(108,140,255,0.55)' },
  triggerIcon: { color: '#F7F8FA', fontSize: 16 },
  triggerText: { color: '#DCE1FF', fontSize: 14, fontWeight: '700' },
  triggerTextActive: { color: '#F7F8FA' },
  sheetSafe: { flex: 1, paddingHorizontal: 20 },
  sheetHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10 },
  sheetTitle: { color: '#F7F8FA', fontSize: 22, fontWeight: '700', letterSpacing: -0.4 },
  sheetClose: { color: PARTNER_A, fontSize: 15, fontWeight: '700' },
  sheetContent: { gap: 10, paddingBottom: 24, paddingTop: 18 },
  sectionLabel: { color: '#A9ADB7', fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  sectionLabelSpaced: { marginTop: 10 },
  row: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  rowActive: { backgroundColor: 'rgba(108,140,255,0.16)', borderColor: 'rgba(108,140,255,0.4)' },
  rowText: { flex: 1, gap: 2, paddingRight: 12 },
  rowLabel: { color: '#F7F8FA', fontSize: 15, fontWeight: '600' },
  rowLabelActive: { color: '#F7F8FA' },
  rowHint: { color: '#8E93A1', fontSize: 12 },
  checkbox: { alignItems: 'center', borderColor: 'rgba(255,255,255,0.28)', borderRadius: 12, borderWidth: 1.5, height: 24, justifyContent: 'center', width: 24 },
  checkboxActive: { backgroundColor: PARTNER_A, borderColor: PARTNER_A },
  checkmark: { color: '#0B0C10', fontSize: 14, fontWeight: '800' },
  sheetFooter: { flexDirection: 'row', gap: 10, paddingBottom: 12, paddingTop: 12 },
  clearButton: { alignItems: 'center', borderColor: 'rgba(255,255,255,0.18)', borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, flex: 1, justifyContent: 'center', minHeight: 54 },
  clearButtonDisabled: { opacity: 0.4 },
  clearButtonText: { color: '#DCE1FF', fontSize: 14, fontWeight: '700' },
  doneButton: { alignItems: 'center', backgroundColor: '#E8EBFF', borderRadius: 16, flex: 2, justifyContent: 'center', minHeight: 54 },
  doneButtonText: { color: '#1B1E2B', fontSize: 15, fontWeight: '700' },
});
