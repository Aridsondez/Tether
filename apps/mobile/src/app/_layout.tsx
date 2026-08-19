import { ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { Alert, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { useEffect } from 'react';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { setSessionExpiredHandler } from '@/lib/api';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (!publishableKey) {
    return <MissingClerkConfiguration />;
  }

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <AppLayout />
    </ClerkProvider>
  );
}

function AppLayout() {
  const colorScheme = useColorScheme();
  const { signOut } = useAuth();

  useEffect(() => {
    setSessionExpiredHandler(() => {
      void signOut().finally(() => {
        router.replace('/');
        Alert.alert('Session ended', 'Your sign-in session has ended. Please sign in again.');
      });
    });
    return () => setSessionExpiredHandler(null);
  }, [signOut]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </ThemeProvider>
  );
}

function MissingClerkConfiguration() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Authentication needs configuration</Text>
      <Text style={styles.message}>
        Add EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY to apps/mobile/.env, then restart Expo.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    color: '#4b5563',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
});
