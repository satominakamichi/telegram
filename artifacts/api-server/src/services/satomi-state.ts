export interface SatomiLogEntry {
  username: string;
  question: string;
  response: string;
  timestamp: Date;
}

export interface SatomiState {
  connected: boolean;
  startTime: number;
  messagesReceived: number;
  triggerCount: number;
  responsesGenerated: number;
  logs: SatomiLogEntry[];
}

export const satomiState: SatomiState = {
  connected: false,
  startTime: Date.now(),
  messagesReceived: 0,
  triggerCount: 0,
  responsesGenerated: 0,
  logs: [],
};

export function addLog(entry: SatomiLogEntry): void {
  satomiState.logs.unshift(entry);
  if (satomiState.logs.length > 20) {
    satomiState.logs.pop();
  }
}
