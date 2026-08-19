/**
 * Shared Web Speech (TTS) helpers for narrating snap advice.
 * All functions safely no-op in browsers without Web Speech support.
 */

export function isSpeechSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    "SpeechSynthesisUtterance" in window
  );
}

export function splitForTTS(text: string): string[] {
  if (text.length <= 200) return [text];
  const parts = text.split(/(?<=[。.！？!?])\s*/u);
  const chunks: string[] = [];
  let current = "";
  for (const part of parts) {
    if ((current + part).length > 200 && current) {
      chunks.push(current.trim());
      current = part;
    } else {
      current += part;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length > 0 ? chunks : [text];
}

export function getTTSLang(): string {
  if (!isSpeechSupported()) return "zh-HK";
  const voices = speechSynthesis.getVoices();
  if (voices.length === 0) return "zh-HK";
  return voices.some((v) => v.lang.startsWith("zh")) ? "zh-HK" : "en-US";
}

export interface SpeechHandle {
  stop: () => void;
}

/**
 * Start narrating `text`. Returns a handle whose `stop()` cancels
 * narration. `onDone` fires when narration finishes or is stopped.
 * Returns null (and calls nothing) when speech is unsupported.
 */
export function startSpeech(text: string, onDone?: () => void): SpeechHandle | null {
  if (!isSpeechSupported() || !text.trim()) return null;
  speechSynthesis.cancel();
  const lang = getTTSLang();
  const chunks = splitForTTS(text);
  let cancelled = false;
  let idx = 0;
  const finish = () => {
    if (!cancelled) {
      cancelled = true;
      onDone?.();
    }
  };
  const speakNext = () => {
    if (cancelled || idx >= chunks.length) {
      finish();
      return;
    }
    const utt = new SpeechSynthesisUtterance(chunks[idx++]);
    utt.lang = lang;
    utt.onend = speakNext;
    utt.onerror = finish;
    speechSynthesis.speak(utt);
  };
  speakNext();
  return {
    stop: () => {
      if (cancelled) return;
      cancelled = true;
      speechSynthesis.cancel();
      onDone?.();
    },
  };
}

/** Cancel any in-flight speech, safely no-op without Web Speech support. */
export function cancelSpeech(): void {
  if (isSpeechSupported()) speechSynthesis.cancel();
}
