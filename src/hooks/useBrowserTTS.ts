import { useState, useCallback, useRef, useEffect } from "react";

interface UseBrowserTTSReturn {
  speak: (text: string) => void;
  stop: () => void;
  isSpeaking: boolean;
  analyser: AnalyserNode | null;
}

const useBrowserTTS = (): UseBrowserTTSReturn => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);

  // Create a fake audio analyser that simulates amplitude during TTS
  // (Browser SpeechSynthesis doesn't expose audio stream directly)
  const createFakeAnalyser = useCallback(() => {
    try {
      const ctx = new AudioContext();
      const analyserNode = ctx.createAnalyser();
      analyserNode.fftSize = 256;

      // Create oscillator to drive the analyser with fake speech-like signal
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 150;
      gain.gain.value = 0;
      osc.connect(gain);
      gain.connect(analyserNode);
      osc.start();

      audioCtxRef.current = ctx;
      analyserRef.current = analyserNode;
      oscillatorRef.current = osc;
      gainRef.current = gain;
      setAnalyser(analyserNode);
      return { analyserNode, gain, osc };
    } catch {
      return null;
    }
  }, []);

  // Simulate speech amplitude by modulating gain
  const simulateSpeechAmplitude = useCallback(() => {
    if (!gainRef.current) return;
    const gain = gainRef.current;
    let frame: number;

    const animate = () => {
      if (!gainRef.current) return;
      // Random speech-like amplitude pattern
      const base = 0.3 + Math.random() * 0.5;
      const variation = Math.sin(performance.now() / 80) * 0.2;
      gain.gain.value = Math.max(0, base + variation);
      frame = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(frame);
      if (gainRef.current) gainRef.current.gain.value = 0;
    };
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!window.speechSynthesis) return;

      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "ar-SA";
      utterance.rate = 0.95;
      utterance.pitch = 1.0;

      // Try to find Arabic voice
      const voices = window.speechSynthesis.getVoices();
      const arabicVoice = voices.find(
        (v) => v.lang.startsWith("ar") && v.localService
      ) || voices.find((v) => v.lang.startsWith("ar"));
      if (arabicVoice) utterance.voice = arabicVoice;

      // Setup fake analyser if not already created
      if (!analyserRef.current) {
        createFakeAnalyser();
      }

      let stopSimulation: (() => void) | undefined;

      utterance.onstart = () => {
        setIsSpeaking(true);
        stopSimulation = simulateSpeechAmplitude();
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        stopSimulation?.();
        if (gainRef.current) gainRef.current.gain.value = 0;
      };

      utterance.onerror = () => {
        setIsSpeaking(false);
        stopSimulation?.();
        if (gainRef.current) gainRef.current.gain.value = 0;
      };

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [createFakeAnalyser, simulateSpeechAmplitude]
  );

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
    if (gainRef.current) gainRef.current.gain.value = 0;
  }, []);

  // Load voices on mount
  useEffect(() => {
    const loadVoices = () => window.speechSynthesis?.getVoices();
    loadVoices();
    window.speechSynthesis?.addEventListener("voiceschanged", loadVoices);
    return () => {
      window.speechSynthesis?.removeEventListener("voiceschanged", loadVoices);
      window.speechSynthesis?.cancel();
      oscillatorRef.current?.stop();
      audioCtxRef.current?.close();
    };
  }, []);

  return { speak, stop, isSpeaking, analyser };
};

export default useBrowserTTS;
