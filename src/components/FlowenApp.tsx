"use client";

import React, { useState, useRef } from 'react';

export default function FlowenApp() {
  const [isLive, setIsLive] = useState(false);
  const [disfluencyState, setDisfluencyState] = useState<'Fluent' | 'Block'>('Fluent');
  const [latency, setLatency] = useState<number>(0);
  const [loadingPayment, setLoadingPayment] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  const handleCheckout = async () => {
    setLoadingPayment(true);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'founding.member@flowen.app' }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("Payment initiation error:", err);
    } finally {
      setLoadingPayment(false);
    }
  };

  const startTelemetryLoop = async () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;
      await audioCtx.audioWorklet.addModule('/audio-worklets/pcm-processor.js');

      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const source = audioCtx.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(audioCtx, 'flowen-pcm-processor');

      let startTime = performance.now();

      workletNode.port.onmessage = (event: MessageEvent<Float32Array>) => {
        const pcmChunk = event.data;
        const now = performance.now();
        setLatency(Math.round(now - startTime));

        let sum = 0;
        for (let i = 0; i < pcmChunk.length; i++) {
          sum += Math.abs(pcmChunk[i]);
        }
        const energy = sum / pcmChunk.length;

        setDisfluencyState(energy > 0.12 ? 'Block' : 'Fluent');
        startTime = performance.now();
      };

      source.connect(workletNode);
      workletNode.connect(audioCtx.destination);
      setIsLive(true);
    } catch (err) {
      console.error("Microphone setup error:", err);
    }
  };

  const stopTelemetryLoop = () => {
    audioContextRef.current?.close();
    setIsLive(false);
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl text-white">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold tracking-wide">Real-Time Disfluency Telemetry</h2>
          <span className={`px-3 py-1 rounded-full text-xs font-mono ${isLive ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30' : 'bg-slate-800 text-slate-400'}`}>
            {isLive ? 'ENGINE ACTIVE' : 'IDLE'}
          </span>
        </div>

        <div className="h-44 bg-slate-950 rounded-xl border border-slate-800 flex flex-col items-center justify-center relative overflow-hidden">
          <div className={`w-28 h-28 rounded-full filter blur-2xl transition-all duration-75 ${disfluencyState === 'Block' ? 'bg-amber-500/40 scale-125' : 'bg-teal-500/30 scale-100'}`} />
          <p className="font-mono text-sm z-10">
            SPEECH STATE: <span className={disfluencyState === 'Block' ? 'text-amber-400 font-bold' : 'text-teal-400 font-bold'}>{disfluencyState}</span>
          </p>
          <span className="text-xs font-mono text-slate-500 mt-1 z-10">Target: &lt;60ms | End-to-End: {latency}ms</span>
        </div>

        <button
          onClick={isLive ? stopTelemetryLoop : startTelemetryLoop}
          className={`w-full mt-4 py-3 rounded-xl font-semibold transition-transform active:scale-95 ${isLive ? 'bg-rose-500 text-white' : 'bg-teal-500 text-slate-950 hover:bg-teal-400'}`}
        >
          {isLive ? 'Stop Session' : 'Start Real-Time Telemetry'}
        </button>
      </div>

      <div className="bg-gradient-to-br from-amber-500/10 to-slate-900 border border-amber-500/30 rounded-2xl p-6 text-white flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <span className="text-xs font-mono text-amber-400 uppercase tracking-widest">Founding Member Pass</span>
          <h3 className="text-xl font-bold mt-1">Lock 50% Off Lifetime</h3>
          <p className="text-xs text-slate-400 mt-1">£4.99/mo pre-pay escrow seat. Fully refundable prior to public launch.</p>
        </div>
        <button
          onClick={handleCheckout}
          disabled={loadingPayment}
          className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl transition-all whitespace-nowrap active:scale-95 disabled:opacity-50"
        >
          {loadingPayment ? 'Redirecting...' : 'Pre-Pay £4.99/mo'}
        </button>
      </div>
    </div>
  );
}
