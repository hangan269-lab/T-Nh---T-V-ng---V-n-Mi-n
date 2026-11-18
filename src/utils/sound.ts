const NOTIF_SOUND_STORAGE_KEY = 'tn_tv_vm_notif_sound_v1';

export function getNotificationSoundEnabled(): boolean {
  try {
    const saved = localStorage.getItem(NOTIF_SOUND_STORAGE_KEY);
    if (saved === null) return true;
    return saved === '1';
  } catch {
    return true;
  }
}

export function setNotificationSoundEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(NOTIF_SOUND_STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    // Ignore localStorage errors
  }
}

let sharedAudioCtx: AudioContext | null = null;

export function playNotificationChime(): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    if (!sharedAudioCtx) {
      sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx.state === 'suspended') {
      void sharedAudioCtx.resume().catch(() => {});
    }

    const now = sharedAudioCtx.currentTime;

    // Gentle two-note ceramic bell "ting" (A5 -> E6)
    const playTone = (freq: number, startOffset: number, duration: number, peakGain: number) => {
      if (!sharedAudioCtx) return;
      const osc = sharedAudioCtx.createOscillator();
      const gain = sharedAudioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + startOffset);

      gain.gain.setValueAtTime(0.0001, now + startOffset);
      gain.gain.exponentialRampToValueAtTime(peakGain, now + startOffset + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + duration);

      osc.connect(gain);
      gain.connect(sharedAudioCtx.destination);
      osc.start(now + startOffset);
      osc.stop(now + startOffset + duration + 0.02);
    };

    playTone(880, 0, 0.22, 0.08);
    playTone(1318.5, 0.09, 0.32, 0.06);
  } catch {
    // Ignore audio context errors when autoplay is restricted
  }
}
