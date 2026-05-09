import { create } from "zustand";
import { persist } from "zustand/middleware";
import { nanoid } from "nanoid";
import type {
  Agent,
  AgentConnection,
  AgentMessage,
  AgentStatus,
  EventLogEntry,
  MemoryLink,
  MemoryNode,
} from "./network-types";

function hash(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return "0x" + (h >>> 0).toString(16).padStart(8, "0");
}

interface NetworkState {
  agents: Agent[];
  connections: AgentConnection[];
  messages: AgentMessage[];
  memoryNodes: MemoryNode[];
  memoryLinks: MemoryLink[];
  events: EventLogEntry[];
  autoRunning: boolean;

  createAgent: (a: Omit<Agent, "id" | "inboxCount" | "outboxCount" | "lastCycleAt" | "cycleNotes" | "status"> & Partial<Pick<Agent, "status">>) => string;
  updateAgent: (id: string, patch: Partial<Agent>) => void;
  deleteAgent: (id: string) => void;

  createConnection: (c: Omit<AgentConnection, "id" | "lastPulseAt">) => void;
  deleteConnection: (id: string) => void;

  addMemoryNode: (n: Omit<MemoryNode, "id" | "hash" | "createdAt" | "updatedAt" | "integrityStatus">) => string;
  updateMemoryNode: (id: string, patch: Partial<MemoryNode>) => void;
  deleteMemoryNode: (id: string) => void;

  logEvent: (e: Omit<EventLogEntry, "id" | "timestamp">) => void;

  runOneCycle: () => void;
  setAutoRunning: (v: boolean) => void;
  resetNetwork: () => void;
  seedDemo: () => void;
}

const SAMPLE_THOUGHTS = [
  "Analyzing input patterns…",
  "Cross-referencing prior memory.",
  "Detected anomaly in shared context.",
  "Synthesizing new hypothesis.",
  "Proposing memory link.",
  "Broadcasting consensus check.",
  "Reinforcing established node.",
  "Requesting clarification from peer.",
];

export const useNetwork = create<NetworkState>()(
  persist(
    (set, get) => ({
      agents: [],
      connections: [],
      messages: [],
      memoryNodes: [],
      memoryLinks: [],
      events: [],
      autoRunning: false,

      createAgent: (a) => {
        const id = nanoid(8);
        const agent: Agent = {
          id,
          inboxCount: 0,
          outboxCount: 0,
          lastCycleAt: null,
          cycleNotes: "",
          status: a.status ?? "idle",
          ...a,
        };
        set((s) => ({ agents: [...s.agents, agent] }));
        get().logEvent({
          agent: id,
          agentNameSnapshot: agent.name,
          actionType: "agent.created",
          confidence: 1,
          affectedMemoryNodes: [],
          details: `Agent ${agent.name} (${agent.role}) initialized.`,
        });
        return id;
      },

      updateAgent: (id, patch) =>
        set((s) => ({
          agents: s.agents.map((a) => (a.id === id ? { ...a, ...patch } : a)),
        })),

      deleteAgent: (id) =>
        set((s) => ({
          agents: s.agents.filter((a) => a.id !== id),
          connections: s.connections.filter(
            (c) => c.sourceAgent !== id && c.targetAgent !== id,
          ),
        })),

      createConnection: (c) =>
        set((s) => ({
          connections: [
            ...s.connections,
            { ...c, id: nanoid(8), lastPulseAt: null },
          ],
        })),

      deleteConnection: (id) =>
        set((s) => ({ connections: s.connections.filter((c) => c.id !== id) })),

      addMemoryNode: (n) => {
        const id = nanoid(8);
        const now = Date.now();
        const node: MemoryNode = {
          ...n,
          id,
          hash: hash(n.title + n.content + now),
          integrityStatus: "verified",
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ memoryNodes: [...s.memoryNodes, node] }));
        return id;
      },

      updateMemoryNode: (id, patch) =>
        set((s) => ({
          memoryNodes: s.memoryNodes.map((n) =>
            n.id === id
              ? {
                  ...n,
                  ...patch,
                  updatedAt: Date.now(),
                  hash: hash((patch.title ?? n.title) + (patch.content ?? n.content) + Date.now()),
                }
              : n,
          ),
        })),

      deleteMemoryNode: (id) =>
        set((s) => ({ memoryNodes: s.memoryNodes.filter((n) => n.id !== id) })),

      logEvent: (e) =>
        set((s) => ({
          events: [
            { ...e, id: nanoid(8), timestamp: Date.now() },
            ...s.events,
          ].slice(0, 500),
        })),

      runOneCycle: () => {
        const cycleId = nanoid(6);
        const { agents, connections } = get();
        if (agents.length === 0) return;

        const statuses: AgentStatus[] = ["thinking", "speaking", "learning", "idle"];
        const newMessages: AgentMessage[] = [];
        const updatedAgents = agents.map((a) => {
          const status = statuses[Math.floor(Math.random() * statuses.length)];
          const note = SAMPLE_THOUGHTS[Math.floor(Math.random() * SAMPLE_THOUGHTS.length)];
          return {
            ...a,
            status,
            lastCycleAt: Date.now(),
            cycleNotes: note,
            outboxCount: a.outboxCount + (status === "speaking" ? 1 : 0),
          };
        });

        // generate messages along connections
        const updatedConns = connections.map((c) => {
          const fire = Math.random() > 0.4;
          if (fire) {
            const src = updatedAgents.find((a) => a.id === c.sourceAgent);
            const tgt = updatedAgents.find((a) => a.id === c.targetAgent);
            if (src && tgt) {
              newMessages.push({
                id: nanoid(8),
                messageType: c.type === "command" ? "direct" : "thought",
                content: `${src.name} → ${tgt.name}: ${SAMPLE_THOUGHTS[Math.floor(Math.random() * SAMPLE_THOUGHTS.length)]}`,
                confidence: Math.round(Math.random() * 100) / 100,
                timestamp: Date.now(),
                sourceAgent: src.id,
                targetAgent: tgt.id,
                relatedMemoryNodes: [],
                delivered: true,
                cycleId,
              });
              tgt.inboxCount += 1;
            }
            return { ...c, lastPulseAt: Date.now() };
          }
          return c;
        });

        set((s) => ({
          agents: updatedAgents,
          connections: updatedConns,
          messages: [...newMessages, ...s.messages].slice(0, 300),
          events: [
            {
              id: nanoid(8),
              timestamp: Date.now(),
              agent: "system",
              agentNameSnapshot: "Network",
              actionType: "cycle.run",
              confidence: 1,
              affectedMemoryNodes: [],
              details: `Cycle ${cycleId} executed across ${updatedAgents.length} agents, ${newMessages.length} messages.`,
            },
            ...s.events,
          ].slice(0, 500),
        }));
      },

      setAutoRunning: (v) => set({ autoRunning: v }),

      resetNetwork: () =>
        set({
          agents: [],
          connections: [],
          messages: [],
          memoryNodes: [],
          memoryLinks: [],
          events: [],
          autoRunning: false,
        }),

      seedDemo: () => {
        const s = get();
        if (s.agents.length > 0) return;
        const a1 = s.createAgent({
          name: "Oracle",
          role: "Synthesizer",
          systemPrompt: "Combine signals from peers into coherent insight.",
          color: "#7c5cff",
          memoryScope: "shared",
          broadcastEnabled: true,
          xPosition: 200,
          yPosition: 180,
        });
        const a2 = s.createAgent({
          name: "Scout",
          role: "Explorer",
          systemPrompt: "Probe environment, surface novel patterns.",
          color: "#28d17c",
          memoryScope: "private",
          broadcastEnabled: false,
          xPosition: 520,
          yPosition: 120,
        });
        const a3 = s.createAgent({
          name: "Sentinel",
          role: "Guardian",
          systemPrompt: "Detect anomalies, raise warnings.",
          color: "#ff4d4d",
          memoryScope: "shared",
          broadcastEnabled: true,
          xPosition: 460,
          yPosition: 380,
        });
        const a4 = s.createAgent({
          name: "Archivist",
          role: "Memory Keeper",
          systemPrompt: "Curate and verify shared memory integrity.",
          color: "#ffc83d",
          memoryScope: "shared",
          broadcastEnabled: true,
          xPosition: 160,
          yPosition: 420,
        });
        s.createConnection({ sourceAgent: a1, targetAgent: a2, type: "command", strength: 0.8, animated: true });
        s.createConnection({ sourceAgent: a2, targetAgent: a1, type: "feedback", strength: 0.6, animated: true });
        s.createConnection({ sourceAgent: a1, targetAgent: a3, type: "peer", strength: 0.7, animated: true });
        s.createConnection({ sourceAgent: a3, targetAgent: a4, type: "observer", strength: 0.5, animated: true });
        s.createConnection({ sourceAgent: a4, targetAgent: a1, type: "peer", strength: 0.9, animated: true });
        s.addMemoryNode({
          title: "Genesis Protocol",
          content: "Initial axiom: agents cooperate to maximize shared insight.",
          createdByAgent: a4,
          confidence: 0.95,
          tags: ["axiom", "core"],
        });
        s.addMemoryNode({
          title: "Anomaly Pattern Δ-7",
          content: "Recurring spike in inbound signal entropy near cycle 12.",
          createdByAgent: a3,
          confidence: 0.72,
          tags: ["anomaly", "signal"],
        });
      },
    }),
    { name: "agent-network-v1" },
  ),
);
