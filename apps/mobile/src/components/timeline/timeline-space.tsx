import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, Polygon, Rect, Stop } from 'react-native-svg';

import { hexToRgba } from '@/components/atmosphere';
import type { Timeline, TimelineItem } from '@/lib/api';
import { TIMELINE_CATEGORIES } from '@/lib/api';

import { timelineCategoryColor, timelineColor, timelineGradient, timelineProgress, timelineShape, type OwnerColors } from './timeline-color';

const PADDING = 56;
const LEVEL_W = 190; // horizontal distance between generations (left -> right)
const ROW_H = 132; // vertical distance between sibling slots within a generation
const NODE_R = 22;
const RING_R = 28;
const LABEL_W = 108;
const STUB_W = 56; // leader line length for root nodes so their milestones still have somewhere to sit
const ITEM_R = 5;

const CATEGORY_ORDER = TIMELINE_CATEGORIES.map((entry) => entry.value);

type Point = { x: number; y: number };

/** Parent ids restricted to timelines actually present in this render (a category filter can drop one end of an edge). */
function visibleParents(timeline: Timeline, idSet: Set<string>): string[] {
  return timeline.parent_timeline_ids.filter((id) => idSet.has(id));
}

function isTimelineComplete(timeline: Timeline): boolean {
  if (timeline.status === 'completed') return true;
  const { total, fraction } = timelineProgress(timeline);
  return total > 0 && fraction === 1;
}

/** Layered (Sugiyama-lite) DAG layout: rank = generation (drives X), slot = row within a generation (drives Y). */
function layoutDag(timelines: Timeline[]) {
  const idSet = new Set(timelines.map((t) => t.id));
  const byId = new Map(timelines.map((t) => [t.id, t]));
  const rank = new Map<string, number>();
  const resolving = new Set<string>();

  function rankOf(id: string): number {
    const cached = rank.get(id);
    if (cached !== undefined) return cached;
    if (resolving.has(id)) return 0; // defensive: never trust a cycle, backend already rejects them
    resolving.add(id);
    const timeline = byId.get(id);
    const parents = timeline ? visibleParents(timeline, idSet) : [];
    const value = parents.length === 0 ? 0 : 1 + Math.max(...parents.map(rankOf));
    resolving.delete(id);
    rank.set(id, value);
    return value;
  }
  for (const timeline of timelines) rankOf(timeline.id);

  const maxRank = timelines.length > 0 ? Math.max(...timelines.map((t) => rank.get(t.id) ?? 0)) : 0;
  const columns: Timeline[][] = Array.from({ length: maxRank + 1 }, () => []);
  for (const timeline of timelines) columns[rank.get(timeline.id) ?? 0].push(timeline);

  const slot = new Map<string, number>();
  for (const column of columns) {
    const ordered = column
      .map((timeline) => {
        const parentSlots = visibleParents(timeline, idSet)
          .map((id) => slot.get(id))
          .filter((value): value is number => value !== undefined);
        const barycenter = parentSlots.length > 0
          ? parentSlots.reduce((sum, value) => sum + value, 0) / parentSlots.length
          : Number.MAX_SAFE_INTEGER;
        return { timeline, categoryIndex: CATEGORY_ORDER.indexOf(timeline.category), barycenter };
      })
      // Cluster by category first ("goals near each other"), then minimize edge crossing within a cluster.
      .sort((a, b) => a.categoryIndex - b.categoryIndex || a.barycenter - b.barycenter || a.timeline.title.localeCompare(b.timeline.title));
    ordered.forEach((entry, index) => slot.set(entry.timeline.id, index));
  }

  const maxSlot = timelines.length > 0 ? Math.max(...timelines.map((t) => slot.get(t.id) ?? 0)) : 0;
  return { idSet, byId, rank, slot, maxRank, maxSlot };
}

function cubicPoint(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const mt = 1 - t;
  return {
    x: mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x,
    y: mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y,
  };
}

function polygonPoints(cx: number, cy: number, r: number, sides: number, rotationDeg: number): string {
  const points: string[] = [];
  for (let i = 0; i < sides; i += 1) {
    const angle = (rotationDeg + (360 / sides) * i) * (Math.PI / 180);
    points.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
  }
  return points.join(' ');
}

function NodeBody({ shape, x, y, r, fill }: { shape: ReturnType<typeof timelineShape>; x: number; y: number; r: number; fill: string }) {
  switch (shape) {
    case 'square':
      return <Rect x={x - r * 0.82} y={y - r * 0.82} width={r * 1.64} height={r * 1.64} rx={6} fill={fill} opacity={0.85} />;
    case 'triangle':
      return <Polygon points={polygonPoints(x, y, r * 1.15, 3, -90)} fill={fill} opacity={0.85} />;
    case 'diamond':
      return <Polygon points={polygonPoints(x, y, r * 1.08, 4, -90)} fill={fill} opacity={0.85} />;
    case 'hexagon':
      return <Polygon points={polygonPoints(x, y, r * 1.0, 6, -90)} fill={fill} opacity={0.85} />;
    case 'circle':
    default:
      return <Circle cx={x} cy={y} r={r} fill={fill} opacity={0.85} />;
  }
}

type ItemDot = { item: TimelineItem; point: Point };

/** Milestone dots sampled along a branch edge's bezier, evenly spaced by item position. */
function itemDotsAlongCurve(items: TimelineItem[], from: Point, cp1: Point, cp2: Point, to: Point): ItemDot[] {
  return items.map((item, index) => ({
    item,
    point: cubicPoint(from, cp1, cp2, to, (index + 1) / (items.length + 1)),
  }));
}

/** Milestone dots evenly spaced along a root node's straight leader stub. */
function itemDotsAlongLine(items: TimelineItem[], from: Point, to: Point): ItemDot[] {
  return items.map((item, index) => {
    const t = (index + 1) / (items.length + 1);
    return { item, point: { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t } };
  });
}

type TimelineSpaceProps = {
  timelines: Timeline[];
  colors: OwnerColors;
  onSelect: (timeline: Timeline) => void;
  onSelectItem?: (timeline: Timeline, item: TimelineItem) => void;
};

export function TimelineSpace({ timelines, colors, onSelect, onSelectItem }: TimelineSpaceProps) {
  if (timelines.length === 0) return <EmptySpace />;

  const { idSet, byId, rank, slot, maxRank, maxSlot } = layoutDag(timelines);
  const width = PADDING * 2 + maxRank * LEVEL_W + LABEL_W * 0.6 + STUB_W;
  const height = PADDING * 2 + maxSlot * ROW_H + LABEL_W * 0.6;

  const pixel = (timeline: Timeline): Point => ({
    x: PADDING + STUB_W + (rank.get(timeline.id) ?? 0) * LEVEL_W,
    y: PADDING + (slot.get(timeline.id) ?? 0) * ROW_H,
  });

  const edges = timelines.flatMap((timeline) => {
    const to = pixel(timeline);
    return visibleParents(timeline, idSet).map((parentId) => {
      const parent = byId.get(parentId);
      if (!parent) return null;
      const from = pixel(parent);
      const midX = (from.x + to.x) / 2;
      const cp1: Point = { x: midX, y: from.y };
      const cp2: Point = { x: midX, y: to.y };
      const start: Point = { x: from.x + RING_R, y: from.y };
      const end: Point = { x: to.x - RING_R, y: to.y };
      return { key: `${parentId}-${timeline.id}`, timeline, start, end, cp1, cp2 };
    });
  }).filter((edge): edge is NonNullable<typeof edge> => edge !== null);

  const itemDotsByTimeline = new Map<string, ItemDot[]>();
  for (const timeline of timelines) {
    if (timeline.items.length === 0) continue;
    const to = pixel(timeline);
    const firstEdge = edges.find((edge) => edge.timeline.id === timeline.id);
    if (firstEdge) {
      itemDotsByTimeline.set(timeline.id, itemDotsAlongCurve(timeline.items, firstEdge.start, firstEdge.cp1, firstEdge.cp2, firstEdge.end));
    } else {
      // Root node: no incoming edge, so give it a short straight leader line to hang milestones on.
      const stubStart: Point = { x: to.x - STUB_W, y: to.y };
      const stubEnd: Point = { x: to.x - RING_R, y: to.y };
      itemDotsByTimeline.set(timeline.id, itemDotsAlongLine(timeline.items, stubStart, stubEnd));
    }
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ minWidth: width }}>
      <ScrollView contentContainerStyle={{ minHeight: height }}>
        <View style={{ width, height }}>
          <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
            <Defs>
              {timelines.map((timeline) => {
                const [from, to] = timelineGradient(timeline, colors);
                return (
                  <LinearGradient key={timeline.id} id={`grad-${timeline.id}`} x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0" stopColor={from} />
                    <Stop offset="1" stopColor={to} />
                  </LinearGradient>
                );
              })}
            </Defs>

            {timelines.map((timeline) => {
              if (edges.some((edge) => edge.timeline.id === timeline.id)) return null;
              const dots = itemDotsByTimeline.get(timeline.id);
              if (!dots || dots.length === 0) return null;
              const to = pixel(timeline);
              const complete = isTimelineComplete(timeline);
              return (
                <Path
                  key={`stub-${timeline.id}`}
                  d={`M ${to.x - STUB_W} ${to.y} L ${to.x - RING_R} ${to.y}`}
                  stroke={`url(#grad-${timeline.id})`}
                  strokeWidth={complete ? 3.5 : 3}
                  strokeDasharray={complete ? undefined : '7,7'}
                  strokeLinecap="round"
                  opacity={complete ? 0.9 : 0.45}
                />
              );
            })}

            {edges.map((edge) => {
              const complete = isTimelineComplete(edge.timeline);
              return (
                <Path
                  key={`edge-${edge.key}`}
                  d={`M ${edge.start.x} ${edge.start.y} C ${edge.cp1.x} ${edge.cp1.y}, ${edge.cp2.x} ${edge.cp2.y}, ${edge.end.x} ${edge.end.y}`}
                  stroke={`url(#grad-${edge.timeline.id})`}
                  strokeWidth={complete ? 3.5 : 3}
                  strokeDasharray={complete ? undefined : '7,7'}
                  strokeLinecap="round"
                  fill="none"
                  opacity={complete ? 0.9 : 0.45}
                />
              );
            })}

            {timelines.map((timeline) => {
              const { x, y } = pixel(timeline);
              const { fraction } = timelineProgress(timeline);
              const circumference = 2 * Math.PI * RING_R;
              const shape = timelineShape(timeline.category);
              return (
                <G key={timeline.id}>
                  <Circle cx={x} cy={y} r={RING_R} stroke="rgba(255,255,255,0.14)" strokeWidth={3} fill="none" />
                  <Circle
                    cx={x}
                    cy={y}
                    r={RING_R}
                    stroke={`url(#grad-${timeline.id})`}
                    strokeWidth={3}
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${circumference}`}
                    strokeDashoffset={circumference * (1 - fraction)}
                    transform={`rotate(-90 ${x} ${y})`}
                  />
                  <NodeBody shape={shape} x={x} y={y} r={NODE_R} fill={`url(#grad-${timeline.id})`} />
                  <Circle cx={x + RING_R * 0.62} cy={y - RING_R * 0.62} r={5} fill={timelineCategoryColor(timeline.category)} stroke="#0B0C10" strokeWidth={1.5} />
                </G>
              );
            })}

            {timelines.map((timeline) =>
              (itemDotsByTimeline.get(timeline.id) ?? []).map((dot) => (
                <Circle
                  key={`item-${dot.item.id}`}
                  cx={dot.point.x}
                  cy={dot.point.y}
                  r={ITEM_R}
                  fill={dot.item.completed_at ? timelineCategoryColor(timeline.category) : '#0B0C10'}
                  stroke={timelineCategoryColor(timeline.category)}
                  strokeWidth={1.5}
                />
              )),
            )}
          </Svg>

          {timelines.map((timeline) =>
            (itemDotsByTimeline.get(timeline.id) ?? []).map((dot) => (
              <Pressable
                key={`item-hit-${dot.item.id}`}
                onPress={() => onSelectItem?.(timeline, dot.item)}
                hitSlop={8}
                style={{ position: 'absolute', left: dot.point.x - 12, top: dot.point.y - 12, width: 24, height: 24 }}
              />
            )),
          )}

          {timelines.map((timeline) => {
            const { x, y } = pixel(timeline);
            const { completed, total } = timelineProgress(timeline);
            const color = timelineColor(timeline, colors);
            return (
              <Pressable
                key={timeline.id}
                onPress={() => onSelect(timeline)}
                hitSlop={8}
                style={{ position: 'absolute', left: x - LABEL_W / 2, top: y - RING_R, width: LABEL_W, alignItems: 'center' }}>
                <View style={{ height: RING_R * 2 }} />
                <Text numberOfLines={1} style={[styles.nodeLabel, { color }]}>
                  {timeline.title}
                </Text>
                <Text style={styles.nodeCaption}>{total > 0 ? `${completed}/${total}` : 'no items'}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </ScrollView>
  );
}

function EmptySpace() {
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyRing, { borderColor: hexToRgba('#6C8CFF', 0.35) }]} />
      <Text style={styles.emptyTitle}>No timelines yet</Text>
      <Text style={styles.emptyCopy}>Create your first timeline to start tracking progress together.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  nodeLabel: { fontSize: 13, fontWeight: '700', marginTop: 6, textAlign: 'center' },
  nodeCaption: { color: '#8E93A1', fontSize: 11, marginTop: 2, textAlign: 'center' },
  empty: { alignItems: 'center', paddingHorizontal: 32, paddingVertical: 64 },
  emptyRing: { borderRadius: 40, borderWidth: 3, height: 80, marginBottom: 20, width: 80 },
  emptyTitle: { color: '#F7F8FA', fontSize: 20, fontWeight: '700' },
  emptyCopy: { color: '#A9ADB7', fontSize: 14, lineHeight: 20, marginTop: 8, textAlign: 'center' },
});
