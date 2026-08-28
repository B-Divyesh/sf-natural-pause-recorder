export type AudioSegment = {
  id: string;
  type: 'voice' | 'pause';
  start: number;
  end: number;
  originalDuration: number;
  outputDuration: number;
  restored: boolean;
};

export type Take = {
  id: string;
  name: string;
  createdAt: number;
  duration: number;
  editedDuration: number;
  sampleRate: number;
  minSilenceMs: number;
  thresholdDb: number;
  segments: AudioSegment[];
  rawBlob: Blob;
  editedBlob: Blob;
};

export type PortableTake = Omit<Take, 'rawBlob' | 'editedBlob'> & {
  rawWav: string;
  editedWav: string;
};
