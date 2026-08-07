/**
 * Flowen Mobile — Root Application Component
 *
 * React Native (Expo bare workflow) app wrapper.
 * Manages auth state, syncs the user profile via Supabase Realtime,
 * and renders the session-gated navigation stack.
 *
 * Dependencies (add to flowen-mobile/package.json):
 *   expo ~52.x, react-native ~0.76.x,
 *   @react-navigation/native, @react-navigation/native-stack,
 *   expo-secure-store, expo-status-bar, react-native-safe-area-context,
 *   react-native-screens, @supabase/supabase-js
 */

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { createClient } from '@supabase/supabase-js';
import { useAudioPipeline, type AudioPipelineState } from './src/lib/audio/AudioPipeline';

// ── Types ─────────────────────────────────────────────────────────────────────

interface UserProfile {
  id:           string;
  tier:         string;
  id_verified:  boolean;
  pacer_bpm:    number;
}

type AppScreen = 'loading' | 'login' | 'verify-identity' | 'session';

// ── Supabase client ───────────────────────────────────────────────────────────

// Module-level singleton — createClient is lightweight and safe to call once.
// Use EXPO_PUBLIC_ prefix so Expo's bundler inlines the values at build time.
const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
);

// ── Profile sync via Supabase Realtime ────────────────────────────────────────
//
// Previously this used a custom WebSocket (wss://api.flowen.digital/ws/profile)
// that did not exist, and passed the user ID as a query-string parameter
// (`?uid=…`) — exposing it in network logs, proxies, and server access logs.
//
// Replacement: Supabase Realtime postgres_changes subscription on the profiles
// row, authenticated via the Supabase JWT (never in the URL).  An initial fetch
// hydrates the profile immediately; subsequent DB writes push updates in real time.

function useProfileSync(userId: string | null) {
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      return;
    }

    // Hydrate synchronously with the current row before the channel opens.
    supabase
      .from('profiles')
      .select('id, tier, id_verified, pacer_bpm')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (data) setProfile(data as UserProfile);
      });

    // Subscribe to UPDATE events on this user's profiles row.
    // The channel name is local-only; the filter is evaluated server-side.
    const channel = supabase
      .channel(`profile_sync:${userId}`)
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'profiles',
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          setProfile(payload.new as UserProfile);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return profile;
}

// ── Screens ───────────────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <View style={styles.centre}>
      <ActivityIndicator size="large" color="#3b82f6" />
      <Text style={styles.loadingText}>Starting Flowen…</Text>
    </View>
  );
}

function LoginScreen({ onLogin }: { onLogin: (id: string) => void }) {
  return (
    <View style={styles.centre}>
      <Text style={styles.title}>FLOWEN</Text>
      <Text style={styles.subtitle}>Neural Biofeedback Speech Therapy</Text>
      <TouchableOpacity style={styles.button} onPress={() => onLogin('demo-user-id')}>
        <Text style={styles.buttonText}>Sign In</Text>
      </TouchableOpacity>
    </View>
  );
}

function VerifyIdentityScreen() {
  return (
    <View style={styles.centre}>
      <Text style={styles.title}>Identity Verification</Text>
      <Text style={styles.bodyText}>
        Complete your KYC verification to access your therapy sessions.
      </Text>
    </View>
  );
}

function SessionScreen({ pipeline }: { pipeline: AudioPipelineState }) {
  const orbSize = 160;
  // Map RMS [0, 0.3] → scale [1, 1.6] for the orb visual
  const scale   = 1 + Math.min(pipeline.rms / 0.3, 1) * 0.6;

  return (
    <View style={styles.sessionContainer}>
      <Text style={styles.title}>Flowen Session</Text>

      {/* Pacer orb — simplified native equivalent of the web PacerOrb */}
      <View style={[styles.orbContainer, { width: orbSize, height: orbSize }]}>
        <View
          style={[
            styles.orb,
            {
              width:  orbSize * scale,
              height: orbSize * scale,
              borderRadius: orbSize * scale / 2,
              opacity: 0.5 + pipeline.rms * 1.5,
            },
          ]}
        />
        <View style={[styles.orbCore, { width: orbSize * 0.35, height: orbSize * 0.35, borderRadius: orbSize * 0.175 }]} />
      </View>

      {/* Volume meter */}
      <View style={styles.meterTrack}>
        <View
          style={[
            styles.meterFill,
            { height: `${Math.max(0, (pipeline.decibelLevel + 60) / 60 * 100)}%` },
          ]}
        />
      </View>

      <Text style={styles.dbLabel}>{Math.round(pipeline.decibelLevel)} dBFS</Text>
      <Text style={[styles.vadLabel, pipeline.isVoiceActive && styles.vadActive]}>
        {pipeline.isVoiceActive ? 'Voice Detected' : 'Listening…'}
      </Text>

      {pipeline.error && (
        <Text style={styles.errorText}>{pipeline.error}</Text>
      )}

      <TouchableOpacity
        style={[styles.button, pipeline.isRecording && styles.buttonStop]}
        onPress={pipeline.isRecording ? pipeline.stop : pipeline.start}
      >
        <Text style={styles.buttonText}>
          {pipeline.isRecording ? 'Stop Session' : 'Start Session'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Root component ────────────────────────────────────────────────────────────

export default function App() {
  const [screen,  setScreen]  = useState<AppScreen>('loading');
  const [userId,  setUserId]  = useState<string | null>(null);

  const profile  = useProfileSync(userId);
  const pipeline = useAudioPipeline();

  // Auth + profile-gate routing
  useEffect(() => {
    if (!userId) {
      setScreen('login');
      return;
    }
    if (!profile) {
      setScreen('loading');
      return;
    }
    if (!profile.id_verified) {
      setScreen('verify-identity');
      return;
    }
    setScreen('session');
  }, [userId, profile]);

  const handleLogin = (id: string) => {
    setUserId(id);
    setScreen('loading');
  };

  const renderScreen = () => {
    switch (screen) {
      case 'loading':          return <LoadingScreen />;
      case 'login':            return <LoginScreen onLogin={handleLogin} />;
      case 'verify-identity':  return <VerifyIdentityScreen />;
      case 'session':          return <SessionScreen pipeline={pipeline} />;
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
  root:             { flex: 1, backgroundColor: '#020617' },
  centre:           { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  sessionContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  title:            { fontSize: 28, fontWeight: '800', color: '#ffffff', letterSpacing: 2 },
  subtitle:         { fontSize: 14, color: '#94a3b8', marginTop: 8, textAlign: 'center' },
  loadingText:      { fontSize: 14, color: '#64748b', marginTop: 16 },
  bodyText:         { fontSize: 15, color: '#94a3b8', textAlign: 'center', lineHeight: 22, marginTop: 12 },
  dbLabel:          { fontSize: 13, color: '#64748b', fontVariant: ['tabular-nums'] },
  vadLabel:         { fontSize: 15, color: '#475569', fontWeight: '600' },
  vadActive:        { color: '#22d3ee' },
  errorText:        { fontSize: 12, color: '#ef4444', textAlign: 'center' },
  button: {
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
    marginTop: 8,
  },
  buttonStop:       { backgroundColor: '#ef4444' },
  buttonText:       { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  orbContainer:     { alignItems: 'center', justifyContent: 'center', marginVertical: 16 },
  orb: {
    position:        'absolute',
    backgroundColor: '#2563eb',
    shadowColor:     '#3b82f6',
    shadowRadius:    30,
    shadowOpacity:   0.6,
    shadowOffset:    { width: 0, height: 0 },
    elevation:       10,
  },
  orbCore: {
    backgroundColor: '#bfdbfe',
    shadowColor:     '#93c5fd',
    shadowRadius:    10,
    shadowOpacity:   0.9,
    shadowOffset:    { width: 0, height: 0 },
  },
  meterTrack: {
    width:           20,
    height:          160,
    backgroundColor: '#1e293b',
    borderRadius:    4,
    overflow:        'hidden',
    justifyContent:  'flex-end',
  },
  meterFill: {
    width:           '100%',
    backgroundColor: '#22d3ee',
    borderRadius:    4,
  },
});
