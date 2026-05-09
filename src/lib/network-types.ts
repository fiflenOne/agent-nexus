export type AgentStatus = "idle" | "thinking" | "speaking" | "warning" | "learning";

export const STATUS_COLORS: Record<AgentStatus, string> = {
  idle: "#e6e6e6",
  thinking: "#3b9eff",
  speaking: "#28d17c",
  warning: "#ff4d4d",
  learning: "#ffc83d",
};

export interface Agent {
  id: string;
  name: string;
  role: string;
  systemPrompt: string;
  color: string;
  memoryScope: "private" | "shared" | "broadcast";
  status: AgentStatus;
  broadcastEnabled: boolean;
  xPosition: number;
  yPosition: number;
  inboxCount: number;
  outboxCount: number;
  lastCycleAt: number | null;
  cycleNotes: string;
}

export interface AgentConnection {
  id: string;
  sourceAgent: string;
  targetAgent: string;
  type: "command" | "peer" | "observer" | "feedback";
  strength: number;
  animated: boolean;
  lastPulseAt: number | null;
}

export interface AgentMessage {
  id: string;
  messageType: "thought" | "broadcast" | "direct" | "memory" | "warning";
  content: string;
  confidence: number;
  timestamp: number;
  sourceAgent: string;
  targetAgent: string | null;
  relatedMemoryNodes: string[];
  delivered: boolean;
  cycleId: string;
}

export interface MemoryNode {
  id: string;
  title: string;
  content: string;
  hash: string;
  integrityStatus: "verified" | "pending" | "corrupt";
  createdByAgent: string;
  confidence: number;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface MemoryLink {
  id: string;
  sourceMemoryNode: string;
  targetMemoryNode: string;
  suggestedByAgent: string;
  reason: string;
  confidence: number;
  status: "proposed" | "accepted" | "rejected";
}

export interface EventLogEntry {
  id: string;
  timestamp: number;
  agent: string;
  agentNameSnapshot: string;
  actionType: string;
  confidence: number;
  affectedMemoryNodes: string[];
  details: string;
}
