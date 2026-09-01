/**
 * Flowen Mobile — Root Application Component
 *
 * Expo bare-workflow app. Manages Supabase auth state, syncs the user
 * profile via Realtime, and routes to the correct screen.
 *
 * Screen routing:
 *   no session          → LoginScreen
 *   session, no profile → loading
 *   session + profile   → SessionScreen
 *
 * Note: the id_verified KYC gate was removed in Aug 2026 when the web
 * onboarding flow dropped the DIDIT step. All authenticated users go
 * straight to SessionScreen.
 */

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SecureStore from 'expo-secure-store';
import { createClient, type Session } from '@supabase/supabase-js';

import { LoginScreen }             from './src/screens/LoginScreen';
import { SessionScreen }           from './src/screens/SessionScreen';

// ── Supabase client ───────────────────────────────────────────────────────────
//
// ExpoSecureStoreAdapter persists the Supabase session in the device keychain
// (iOS Keychain / Android Keystore), keeping tokens off disk and out of
// AsyncStorage.

const ExpoSecureStoreAdapter = {
  getItem:    (key: string) => SecureStore.getItemAsync(key),
  setItem:    (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage:          ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession:   true,
      detectSessionInUrl: false,
    },
  },
);

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UserProfile {
  id:                string;
  tier:              string;
  pacer_default_bpm: number;
  display_name:      string | null;
}

type AppScreen = 'loading' | 'login' | 'session';

// ── Profile sync via Supabase Realtime ────────────────────────────────────────

function useProfileSync(userId: string | null) {
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      return;
    }

    supabase
      .from('profiles')
      .select('id, tier, pacer_default_bpm, display_name')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (data) setProfile(data as UserProfile);
      });

    const channel = supabase
      .channel(`profile_sync:${userId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
        (payload) => setProfile(payload.new as UserProfile),
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  return profile;
}

// ── Loading screen ────────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <View style={styles.centre}>
      <ActivityIndicator size="large" color="#3b82f6" />
      <Text style={styles.loadingText}>Starting Flowen…</Text>
    </View>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [screen,  setScreen]  = useState<AppScreen>('loading');
  const [userId,  setUserId]  = useState<string | null>(null);

  const profile  = useProfileSync(userId);

  // Bootstrap: restore session from SecureStore on first mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const uid = session?.user?.id ?? null;
      setUserId(uid);
      if (!uid) setScreen('login');
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: string, session: Session | null) => {
        const uid = session?.user?.id ?? null;
        setUserId(uid);
        if (!uid) setScreen('login');
      },
    );

    return () => subscription.unsubscribe();
  }, []);

  // Route: authenticated + profile → session, authenticated + no profile → loading
  useEffect(() => {
    if (!userId) return; // auth effect handles login redirect
    setScreen(profile ? 'session' : 'loading');
  }, [userId, profile]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUserId(null);
    setScreen('login');
  };

  const renderScreen = () => {
    switch (screen) {
      case 'loading': return <LoadingScreen />;
      case 'login':   return <LoginScreen supabase={supabase} />;
      case 'session':
        return profile
          ? <SessionScreen profile={profile} onSignOut={handleSignOut} />
          : <LoadingScreen />;
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />
      {renderScreen()}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: '#020617' },
  centre:      { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingText: { fontSize: 14, color: '#64748b', marginTop: 16 },
});
