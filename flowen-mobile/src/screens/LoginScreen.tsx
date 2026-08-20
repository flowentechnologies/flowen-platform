/**
 * LoginScreen — email/password sign-in using Supabase Auth.
 *
 * Supports:
 *   • Sign in with existing account
 *   • Toggle to sign up (creates account + profile row via Supabase trigger)
 *   • Inline error messaging
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { SupabaseClient } from '@supabase/supabase-js';

interface LoginScreenProps {
  supabase: SupabaseClient;
}

type Mode = 'signin' | 'signup';

export function LoginScreen({ supabase }: LoginScreenProps) {
  const [mode,     setMode]    = useState<Mode>('signin');
  const [email,    setEmail]   = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading] = useState(false);
  const [error,    setError]   = useState<string | null>(null);
  const [info,     setInfo]    = useState<string | null>(null);

  const submit = async () => {
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setLoading(true);
    setError(null);
    setInfo(null);

    const { error: authError } =
      mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
        : await supabase.auth.signUp({ email: email.trim(), password });

    setLoading(false);

    if (authError) {
      setError(authError.message);
    } else if (mode === 'signup') {
      setInfo('Check your email to confirm your account, then sign in.');
      setMode('signin');
    }
    // On successful sign-in, App.tsx auth listener handles the transition
  };

  const toggleMode = () => {
    setMode((m) => (m === 'signin' ? 'signup' : 'signin'));
    setError(null);
    setInfo(null);
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        {/* Logo */}
        <Text style={styles.wordmark}>FLOWEN</Text>
        <Text style={styles.tagline}>Neural Biofeedback Speech Therapy</Text>

        {/* Form */}
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#475569"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
            editable={!loading}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#475569"
            secureTextEntry
            autoCapitalize="none"
            value={password}
            onChangeText={setPassword}
            editable={!loading}
            onSubmitEditing={submit}
            returnKeyType="done"
          />

          {error && <Text style={styles.error}>{error}</Text>}
          {info  && <Text style={styles.info}>{info}</Text>}

          <Pressable
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={submit}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#020617" />
              : <Text style={styles.buttonText}>
                  {mode === 'signin' ? 'Sign In' : 'Create Account'}
                </Text>
            }
          </Pressable>

          <Pressable style={styles.toggle} onPress={toggleMode}>
            <Text style={styles.toggleText}>
              {mode === 'signin'
                ? "Don't have an account? Sign Up"
                : 'Already have an account? Sign In'}
            </Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:           { flex: 1 },
  inner:          { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  wordmark: {
    fontSize:      34,
    fontWeight:    '900',
    color:         '#ffffff',
    letterSpacing: 4,
  },
  tagline: {
    fontSize:   12,
    color:      '#475569',
    marginTop:  6,
    letterSpacing: 0.5,
    textAlign:  'center',
  },
  form: {
    width:       '100%',
    marginTop:   40,
    gap:         12,
  },
  input: {
    backgroundColor: '#0f172a',
    borderWidth:     1,
    borderColor:     '#1e293b',
    borderRadius:    14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    color:           '#f1f5f9',
    fontSize:        15,
  },
  error: {
    fontSize:    13,
    color:       '#f87171',
    textAlign:   'center',
  },
  info: {
    fontSize:    13,
    color:       '#34d399',
    textAlign:   'center',
  },
  button: {
    backgroundColor: '#3b82f6',
    paddingVertical: 15,
    borderRadius:    14,
    alignItems:      'center',
    marginTop:       4,
  },
  buttonDisabled:  { opacity: 0.6 },
  buttonText: {
    color:       '#ffffff',
    fontSize:    15,
    fontWeight:  '700',
  },
  toggle:          { alignItems: 'center', marginTop: 8 },
  toggleText:      { color: '#64748b', fontSize: 13 },
});
