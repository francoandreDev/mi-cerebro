export interface TtsVoiceOption {
  readonly uri: string;
  readonly label: string;
}

export interface TtsPrefs {
  readonly rate: number;
  readonly voiceURI: string | null;
}

export interface TtsSegment {
  readonly id: string;
  readonly text: string;
}

// why: bundled into a single input/output pair on ChapterEditorPaneComponent
//      (rule 4.4 — 5+ inputs/outputs flags mixed responsibility) instead of
//      four separate primitives.
export interface TtsPaneState {
  readonly supported: boolean;
  readonly speaking: boolean;
  readonly paused: boolean;
  readonly voices: readonly TtsVoiceOption[];
  readonly prefs: TtsPrefs;
}

export type TtsAction =
  | { readonly kind: 'toggle' }
  | { readonly kind: 'stop' }
  | { readonly kind: 'prefs'; readonly prefs: TtsPrefs };
