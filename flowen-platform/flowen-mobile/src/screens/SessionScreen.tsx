/**
 * SessionScreen
 *
 * Main therapy session UI. Renders the Pacer orb, volume meter, VAD indicator,
 * and start/stop controls backed by the native AudioPipeline.
 *
 * pacer_bpm from the user's profile will drive the Pacer animation in a later
 * milestone; right now the orb pulses proportionally to the live RMS level.
 */

import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { AudioPipelineState } from '../lib/audio/AudioPipeline';
import type { UserProfile }        from '../../App';

interface SessionScreenProps {
  pipeline:   AudioPipelineState;
  profile:    UserProfile;
  onSignOut:  () => void;
}

export function SessionScreen({ pipeline, profile, onSignOut }: SessionScreenProps) {
  const ORB = 160;
  // RMS [0, 0.3] → scale [1.0, 1.6]
  const scale = 1 + Math.min(pipeline.rms / 0.3, 1) * 0.6;

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.wordmark}>FLOWEN</Text>
        <Pressable onPress={onSignOut} hitSlop={12}>
          <Text style={styles.signOut}>Sign out</Text>
        </Pressable>
      </View>

      {/* Tier chip */}
      <View style={styles.tierChip}>
        <Text style={styles.tierText}>{profile.tier}</Text>
      </View>

      {/* Pacer orb */}
      <View style={[styles.orbWrap, { width: ORB, height: ORB }]}>
        <View
          style={[
            styles.glow,
            {
              width:        ORB * scale,
              height:       ORB * scale,
              borderRadius: (ORB * scale) / 2,
              opacity:      Math.min(0.3 + pipeline.rms * 2, 0.9),
            },
          ]}
        />
        <View style={styles.core} />
      </View>

      {/* Volume meter — vertical bar */}
      <View style={styles.meterTrack}>
        <View
          style={[
            styles.meterFill,
            { height: `${Math.max(0, (pipeline.decibelLevel + 60) / 60) * 100}%` },
          ]}
        />
      </View>

      <Text style={styles.dbLabel}>{Math.round(pipeline.decibelLevel)} dBFS</Text>

      <Text style={[styles.vad, pipeline.isVoiceActive && styles.vadActive]}>
        {pipeline.isVoiceActive ? '● Voice Detected' : '○ Listening…'}
      </Text>

      {pipeline.error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{pipeline.error}</Text>
        </View>
      )}

      {/* Start / Stop */}
      <Pressable
        style={[styles.cta, pipeline.isRecording && styles.ctaStop]}
        onPress={pipeline.isRecording ? pipeline.stop : pipeline.start}
      >
        <Text style={styles.ctaText}>
          {pipeline.isRecording ? 'Stop Session' : 'Start Session'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    padding:        24,
    gap:            16,
  },
  header: {
    position:       'absolute',
    top:            0,
    left:           0,
    right:          0,
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    padding:        20,
  },
  wordmark: {
    fontSize:      18,
    fontWeight:    '900',
    color:         '#ffffff',
    letterSpacing: 3,
  },
  signOut: {
    fontSize: 13,
    color:    '#475569',
  },
  tierChip: {
    backgroundColor: '#0f172a',
    borderWidth:     1,
    borderColor:     '#1e293b',
    borderRadius:    20,
    paddingVertical:   4,
    paddingHorizontal: 12,
    marginBottom:    8,
  },
  tierText: {
    fontSize:    11,
    color:       '#64748b',
    fontWeight:  '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  orbWrap: {
    alignItems:     'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  glow: {
    position:        'absolute',
    backgroundColor: '#2563eb',
    shadowColor:     '#3b82f6',
    shadowRadius:    40,
    shadowOpacity:   0.7,
    shadowOffset:    { width: 0, height: 0 },
    elevation:       12,
  },
  core: {
    width:           56,
    height:          56,
    borderRadius:    28,
    backgroundColor: '#bfdbfe',
    shadowColor:     '#93c5fd',
    shadowRadius:    12,
    shadowOpacity:   0.9,
    shadowOffset:    { width: 0, height: 0 },
  },
  meterTrack: {
    width:           16,
    height:          120,
    backgroundColor: '#0f172a',
    borderRadius:    4,
    overflow:        'hidden',
    justifyContent:  'flex-end',
  },
  meterFill: {
    width:           '100%',
    backgroundColor: '#22d3ee',
    borderRadius:    4,
  },
  dbLabel: {
    fontSize:    13,
    color:       '#475569',
    fontVariant: ['tabular-nums'],
  },
  vad:      { fontSize: 14, color: '#334155', fontWeight: '600' },
  vadActive:{ color: '#22d3ee' },
  errorBox: {
    backgroundColor: '#450a0a',
    borderRadius:    10,
    padding:         12,
    width:           '100%',
  },
  errorText: {
    color:     '#fca5a5',
    fontSize:  12,
    textAlign: 'center',
  },
  cta: {
    backgroundColor: '#3b82f6',
    paddingVertical:   15,
    paddingHorizontal: 40,
    borderRadius:      14,
    marginTop:         4,
  },
  ctaStop: { backgroundColor: '#ef4444' },
  ctaText: {
    color:      '#ffffff',
    fontSize:   15,
    fontWeight: '700',
  },
});
