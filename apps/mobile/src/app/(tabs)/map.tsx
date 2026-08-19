import { useAuth } from '@clerk/expo';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Atmosphere, GlassCard, PARTNER_A, PARTNER_B } from '@/components/atmosphere';
import { AddPlaceSheet } from '@/components/map/add-place-sheet';
import { MapPin } from '@/components/map/map-pin';
import { PlaceDetailSheet } from '@/components/map/place-detail-sheet';
import { filterKey, PlaceFilterButton, type PlaceFilter } from '@/components/map/place-filter-sheet';
import { PlacePreview } from '@/components/map/place-preview';
import { ApiError, tetherApi, type Place } from '@/lib/api';

const FALLBACK_REGION: Region = { latitude: 20, longitude: 0, latitudeDelta: 80, longitudeDelta: 80 };

function matchesFilters(place: Place, filters: PlaceFilter[]) {
  const categories = filters.filter((filter) => filter.kind === 'category').map((filter) => filter.value);
  if (categories.length > 0 && !categories.includes(place.category)) return false;
  for (const filter of filters) {
    if (filter.kind === 'both_like' && !(place.liked_by_you && place.liked_by_partner)) return false;
    if (filter.kind === 'mine' && !place.created_by_you) return false;
    if (filter.kind === 'unvisited' && place.visited) return false;
  }
  return true;
}

function userMessage(error: unknown) {
  return error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';
}

export default function MapScreen() {
  const { getToken, isSignedIn } = useAuth();
  const insets = useSafeAreaInsets();
  // The native tab bar floats over screen content, so absolutely-positioned
  // controls need extra clearance beyond the plain safe-area inset or they
  // render underneath it and become unreachable.
  const tabBarClearance = (insets.bottom > 0 ? 83 : 49) + 16;
  const tokenRef = useRef<string | null>(null);
  const mapRef = useRef<MapView>(null);

  const [region, setRegion] = useState<Region | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [filters, setFilters] = useState<PlaceFilter[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [detailPlace, setDetailPlace] = useState<Place | null>(null);
  const [addSheet, setAddSheet] = useState<{ coordinate: { latitude: number; longitude: number } } | null>(null);
  const [editingPlace, setEditingPlace] = useState<Place | null>(null);
  const [myColor, setMyColor] = useState<string>(PARTNER_A);
  const [partnerColor, setPartnerColor] = useState<string>(PARTNER_B);

  const loadPlaces = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    tokenRef.current = token;
    const { places: loaded } = await tetherApi.listPlaces(token);
    setPlaces(loaded);
  }, [getToken]);

  useEffect(() => {
    if (!isSignedIn) return;
    (async () => {
      try {
        await loadPlaces();
      } catch (reason) {
        setError(userMessage(reason));
      } finally {
        setLoading(false);
      }
    })();
  }, [isSignedIn, loadPlaces]);

  useEffect(() => {
    if (!isSignedIn) return;
    (async () => {
      const token = await getToken();
      if (!token) return;
      try {
        const me = await tetherApi.me(token);
        if (me.user.color) setMyColor(me.user.color);
        if (me.relationship?.partner_color) setPartnerColor(me.relationship.partner_color);
      } catch {
        // Falls back to the default indigo/rose pairing — not worth failing the map over.
      }
    })();
  }, [getToken, isSignedIn]);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationDenied(true);
        setRegion(FALLBACK_REGION);
        return;
      }
      try {
        const position = await Location.getCurrentPositionAsync({});
        setRegion({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        });
      } catch {
        setRegion(FALLBACK_REGION);
      }
    })();
  }, []);

  async function recenter() {
    try {
      const position = await Location.getCurrentPositionAsync({});
      const next: Region = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
      setRegion(next);
      mapRef.current?.animateToRegion(next, 350);
    } catch {
      // Leave the map where it is if location can't be resolved right now.
    }
  }

  function toggleFilter(filter: PlaceFilter) {
    setFilters((prev) => {
      const key = filterKey(filter);
      const exists = prev.some((entry) => filterKey(entry) === key);
      return exists ? prev.filter((entry) => filterKey(entry) !== key) : [...prev, filter];
    });
  }

  function selectPlace(place: Place) {
    void Haptics.selectionAsync();
    setSelectedPlace(place);
  }

  function applyPlaceUpdate(updated: Place) {
    setPlaces((prev) => prev.map((place) => (place.id === updated.id ? updated : place)));
    setSelectedPlace((prev) => (prev?.id === updated.id ? updated : prev));
    setDetailPlace((prev) => (prev?.id === updated.id ? updated : prev));
  }

  async function toggleLike(place: Place) {
    const token = tokenRef.current ?? (await getToken());
    if (!token) return;
    const nextLiked = !place.liked_by_you;
    applyPlaceUpdate({ ...place, liked_by_you: nextLiked });
    try {
      if (nextLiked) await tetherApi.likePlace(token, place.id);
      else await tetherApi.unlikePlace(token, place.id);
    } catch (reason) {
      applyPlaceUpdate(place);
      setError(userMessage(reason));
    }
  }

  async function toggleVisited(place: Place) {
    const token = tokenRef.current ?? (await getToken());
    if (!token) return;
    setBusy(true);
    try {
      const { place: updated } = await tetherApi.updatePlace(token, place.id, { visited: !place.visited });
      applyPlaceUpdate(updated);
    } catch (reason) {
      setError(userMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function ratePlace(place: Place, rating: number | null) {
    const token = tokenRef.current ?? (await getToken());
    if (!token) return;
    setBusy(true);
    try {
      const { place: updated } = await tetherApi.updatePlace(token, place.id, { rating });
      applyPlaceUpdate(updated);
    } catch (reason) {
      setError(userMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function deletePlace(place: Place) {
    const token = tokenRef.current ?? (await getToken());
    if (!token) return;
    setBusy(true);
    try {
      await tetherApi.deletePlace(token, place.id);
      setPlaces((prev) => prev.filter((entry) => entry.id !== place.id));
      setDetailPlace(null);
      setSelectedPlace(null);
    } catch (reason) {
      setError(userMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  function handleSaved(place: Place) {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setPlaces((prev) => {
      const exists = prev.some((entry) => entry.id === place.id);
      return exists ? prev.map((entry) => (entry.id === place.id ? place : entry)) : [place, ...prev];
    });
    setAddSheet(null);
    setEditingPlace(null);
    setDetailPlace(null);
    setSelectedPlace(place);
  }

  const visiblePlaces = places.filter((place) => matchesFilters(place, filters));
  const addInitialCoordinate = addSheet?.coordinate ?? (region ? { latitude: region.latitude, longitude: region.longitude } : { latitude: 0, longitude: 0 });

  return (
    <Atmosphere>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.mapWrap}>
          {region ? (
            <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={region}
              showsUserLocation={!locationDenied}
              showsMyLocationButton={false}
              onPress={() => setSelectedPlace(null)}
              onLongPress={(event) => {
                void Haptics.selectionAsync();
                setEditingPlace(null);
                setAddSheet({ coordinate: event.nativeEvent.coordinate });
              }}>
              {visiblePlaces.map((place) => (
                <Marker
                  key={place.id}
                  coordinate={{ latitude: place.latitude, longitude: place.longitude }}
                  onPress={(event) => {
                    event.stopPropagation();
                    selectPlace(place);
                  }}
                  tracksViewChanges={false}>
                  <MapPin
                    ownedByYou={place.created_by_you}
                    bothLike={place.liked_by_you && place.liked_by_partner}
                    myColor={myColor}
                    partnerColor={partnerColor}
                  />
                </Marker>
              ))}
            </MapView>
          ) : (
            <View style={styles.mapLoading}>
              <ActivityIndicator color="#F7F8FA" size="large" />
            </View>
          )}

          <PlaceFilterButton
            active={filters}
            topOffset={16}
            onToggle={toggleFilter}
            onClear={() => setFilters([])}
          />

          {/* Add lives on the left, opposite the always-on-screen "…" menu and
              recenter button on the right, so the two corners never collide. */}
          <Pressable
            onPress={() => {
              setEditingPlace(null);
              setAddSheet({ coordinate: addInitialCoordinate });
            }}
            style={[styles.fabLeft, { bottom: tabBarClearance }]}>
            <GlassCard style={[styles.fabInner, styles.fabPrimary]}><Text style={styles.fabIcon}>+</Text></GlassCard>
          </Pressable>

          <View style={[styles.fabColumn, { bottom: tabBarClearance }]}>
            <Pressable onPress={() => void recenter()} style={styles.fab}>
              <GlassCard style={styles.fabInner}><Text style={styles.fabIcon}>◎</Text></GlassCard>
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.loadingPill}><GlassCard style={styles.loadingPillInner}><ActivityIndicator color="#F7F8FA" /></GlassCard></View>
          ) : null}

          {error ? (
            <View style={styles.errorPill}>
              <GlassCard style={styles.errorPillInner}><Text style={styles.errorText}>{error}</Text></GlassCard>
            </View>
          ) : null}

          {selectedPlace && !detailPlace ? (
            <PlacePreview
              place={selectedPlace}
              token={tokenRef.current ?? ''}
              bottomOffset={tabBarClearance}
              myColor={myColor}
              partnerColor={partnerColor}
              onPress={() => setDetailPlace(selectedPlace)}
              onToggleLike={() => void toggleLike(selectedPlace)}
            />
          ) : null}
        </View>
      </SafeAreaView>

      <PlaceDetailSheet
        place={detailPlace}
        token={tokenRef.current ?? ''}
        busy={busy}
        myColor={myColor}
        partnerColor={partnerColor}
        onClose={() => setDetailPlace(null)}
        onToggleLike={(place) => void toggleLike(place)}
        onToggleVisited={(place) => void toggleVisited(place)}
        onRate={(place, rating) => void ratePlace(place, rating)}
        onEdit={(place) => {
          setDetailPlace(null);
          setEditingPlace(place);
          setAddSheet({ coordinate: { latitude: place.latitude, longitude: place.longitude } });
        }}
        onDelete={(place) => void deletePlace(place)}
      />

      <AddPlaceSheet
        visible={Boolean(addSheet)}
        token={tokenRef.current ?? ''}
        initialCoordinate={addSheet?.coordinate ?? addInitialCoordinate}
        editingPlace={editingPlace}
        onClose={() => {
          setAddSheet(null);
          setEditingPlace(null);
        }}
        onSaved={handleSaved}
      />
    </Atmosphere>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  mapWrap: { flex: 1 },
  map: { flex: 1 },
  mapLoading: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  fabColumn: { gap: 12, position: 'absolute', right: 16 },
  fabLeft: { alignItems: 'center', justifyContent: 'center', position: 'absolute', left: 16 },
  fab: { alignItems: 'center', justifyContent: 'center' },
  fabInner: { alignItems: 'center', borderRadius: 27, height: 54, justifyContent: 'center', padding: 0, width: 54 },
  fabPrimary: { backgroundColor: 'rgba(108,140,255,0.35)' },
  fabIcon: { color: '#F7F8FA', fontSize: 22, fontWeight: '700' },
  loadingPill: { alignSelf: 'center', position: 'absolute', top: 16 },
  loadingPillInner: { padding: 10 },
  errorPill: { left: 16, position: 'absolute', right: 16, top: 16 },
  errorPillInner: { padding: 12 },
  errorText: { color: '#FF9A9A', fontSize: 13, textAlign: 'center' },
});
