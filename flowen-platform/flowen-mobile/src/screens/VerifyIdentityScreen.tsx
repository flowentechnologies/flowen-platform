/**
 * VerifyIdentityScreen
 *
 * Shown when a user is authenticated but id_verified = false.
 * Directs them to complete KYC in the web app; the profile Realtime
 * subscription in App.tsx will push an update and route them to SessionScreen
 * automatically once the admin flips id_verified = true.
 */

import React from 'react';
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

interface VerifyIdentityScreenProps {
  onSignOut: () => void;
}

const VERIFY_URL = 'https://www.flowen.digital/portal/verify-identity';

export function VerifyIdentityScreen({ onSignOut }: VerifyIdentityScreenProps) {
  return (
    <View style={styles.root}>
      <Text style={styles.emoji}>🪪</Text>
      <Text style={styles.heading}>Identity Verification Required</Text>
      <Text style={styles.body}>
        To access your therapy sessions we need to verify your identity.
        Complete the short verification process on the Flowen website — it only
        takes a couple of minutes.
      </Text>
      <Text style={styles.body}>
        Once approved, this screen updates automatically. You don't need to
        restart the app.
      </Text>

      <Pressable style={styles.primary} onPress={() => Linking.openURL(VERIFY_URL)}>
        <Text style={styles.primaryText}>Verify Identity</Text>
      </Pressable>

      <Pressable style={styles.ghost} onPress={onSignOut}>
        <Text style={styles.ghostText}>Sign Out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex:            1,
    alignItems:      'center',
    justifyContent:  'center',
    padding:         32,
    gap:             16,
  },
  emoji:   { fontSize: 48, marginBottom: 4 },
  heading: {
    fontSize:    22,
    fontWeight:  '800',
    color:       '#ffffff',
    textAlign:   'center',
  },
  body: {
    fontSize:    14,
    color:       '#94a3b8',
    textAlign:   'center',
    lineHeight:  22,
  },
  primary: {
    backgroundColor: '#3b82f6',
    paddingVertical:   14,
    paddingHorizontal: 32,
    borderRadius:      14,
    marginTop:         8,
  },
  primaryText: {
    color:      '#ffffff',
    fontSize:   15,
    fontWeight: '700',
  },
  ghost: {
    paddingVertical: 10,
  },
  ghostText: {
    color:    '#475569',
    fontSize: 13,
  },
});
