import { MidiPlayer, MidiRecorder } from '../lib/recorder';
import { midiService, VIRTUAL_ID } from './midiService';
import { exportFile } from './fileExport';
import { toolsStore } from './stores';

export interface RecorderSnapshot {
  recording: boolean;
  playing: boolean;
  eventCount: number;
  durationMs: number;
}

class RecorderService {
  private readonly recorder = new MidiRecorder();
  private readonly player: MidiPlayer;
  private snapshot: RecorderSnapshot = { recording: false, playing: false, eventCount: 0, durationMs: 0 };
  private readonly listeners = new Set<() => void>();
  private uiTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.player = new MidiPlayer({
      send: (status, data1, data2) => midiService.routeMessage(status, data1, data2, VIRTUAL_ID),
    });
    midiService.addTap(({ status, data1, data2 }) => {
      if (this.recorder.isRecording) {
        this.recorder.record(status, data1, data2);
      }
    });
  }

  getSnapshot = (): RecorderSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private refresh(): void {
    this.snapshot = {
      recording: this.recorder.isRecording,
      playing: this.player.isPlaying,
      eventCount: this.recorder.eventCount,
      durationMs: this.recorder.durationMs,
    };
    this.listeners.forEach((l) => l());
  }

  startRecording(): void {
    this.stopPlayback();
    this.recorder.start();
    this.uiTimer = setInterval(() => this.refresh(), 250);
    this.refresh();
  }

  stopRecording(): void {
    this.recorder.stop();
    if (this.uiTimer) clearInterval(this.uiTimer);
    this.uiTimer = null;
    this.refresh();
  }

  play(): void {
    if (this.recorder.isRecording) this.stopRecording();
    const events = this.recorder.getEvents();
    if (events.length === 0) return;
    this.player.play(events, () => this.refresh());
    this.refresh();
  }

  stopPlayback(): void {
    this.player.stop();
    this.refresh();
  }

  clear(): void {
    this.stopPlayback();
    this.recorder.clear();
    if (this.uiTimer) clearInterval(this.uiTimer);
    this.uiTimer = null;
    this.refresh();
  }

  async exportMidi(): Promise<'shared' | 'downloaded'> {
    const data = this.recorder.toSmf(toolsStore.get().bpm);
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    return exportFile({
      fileName: `nexusmidi-${stamp}.mid`,
      data,
      mimeType: 'audio/midi',
      title: 'Gravação MIDI',
    });
  }
}

export const recorderService = new RecorderService();
