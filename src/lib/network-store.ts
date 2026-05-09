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
        const state = get();
        const { agents, connections, memoryNodes } = state;
        if (agents.length === 0) return;

        const now = () => Date.now();
        const newMessages: AgentMessage[] = [];
        const newMemoryNodes: MemoryNode[] = [];
        const newMemoryLinks: MemoryLink[] = [];
        const newEvents: EventLogEntry[] = [];
        const inboxDelta = new Map<string, number>();
        const outboxDelta = new Map<string, number>();
        const pulsedConns = new Set<string>();
        const statusOverride = new Map<string, AgentStatus>();
        const cycleNotes = new Map<string, string>();

        const pushEvent = (e: Omit<EventLogEntry, "id" | "timestamp">) => {
          newEvents.push({ ...e, id: nanoid(8), timestamp: now() });
        };

        pushEvent({
          agent: "system",
          agentNameSnapshot: "Network",
          actionType: "cycle_start",
          confidence: 1,
          affectedMemoryNodes: [],
          details: `Cycle ${cycleId} started · ${agents.length} agents online.`,
        });

        const detectRole = (a: Agent): string => {
          const r = (a.role + " " + a.name).toLowerCase();
          if (r.includes("research")) return "researcher";
          if (r.includes("verif") || r.includes("guardian") || r.includes("sentinel")) return "verifier";
          if (r.includes("build") || r.includes("engineer") || r.includes("implement")) return "builder";
          if (r.includes("memory") || r.includes("archiv") || r.includes("keeper")) return "memory_keeper";
          if (r.includes("strateg") || r.includes("planner") || r.includes("commander")) return "strategist";
          if (r.includes("dream") || r.includes("muse") || r.includes("creative")) return "dreamer";
          return "generic";
        };

        const outgoing = (id: string) =>
          connections.filter((c) => c.sourceAgent === id);

        const targetsFor = (a: Agent): { tgt: Agent; conn?: AgentConnection }[] => {
          const direct = outgoing(a.id)
            .map((c) => ({ tgt: agents.find((x) => x.id === c.targetAgent)!, conn: c }))
            .filter((x) => x.tgt);
          if (a.broadcastEnabled) {
            const peers = agents
              .filter((p) => p.id !== a.id && !direct.some((d) => d.tgt.id === p.id))
              .map((tgt) => ({ tgt, conn: undefined }));
            return [...direct, ...peers];
          }
          return direct;
        };

        const sendMessage = (
          src: Agent,
          tgt: Agent,
          messageType: AgentMessage["messageType"],
          content: string,
          confidence: number,
          relatedMemoryNodes: string[] = [],
          conn?: AgentConnection,
        ) => {
          const isBroadcast = !conn;
          if (isBroadcast && !src.broadcastEnabled) return;
          newMessages.push({
            id: nanoid(8),
            messageType: isBroadcast ? "broadcast" : messageType,
            content,
            confidence,
            timestamp: now(),
            sourceAgent: src.id,
            targetAgent: tgt.id,
            relatedMemoryNodes,
            delivered: true,
            cycleId,
          });
          inboxDelta.set(tgt.id, (inboxDelta.get(tgt.id) ?? 0) + 1);
          outboxDelta.set(src.id, (outboxDelta.get(src.id) ?? 0) + 1);
          if (conn) pulsedConns.add(conn.id);

          pushEvent({
            agent: src.id,
            agentNameSnapshot: src.name,
            actionType: "message_sent",
            confidence,
            affectedMemoryNodes: relatedMemoryNodes,
            details: `${src.name} → ${tgt.name} [${isBroadcast ? "broadcast" : messageType}] ${content}`,
          });
        };

        const pickOne = <T,>(arr: T[]): T | undefined =>
          arr.length ? arr[Math.floor(Math.random() * arr.length)] : undefined;

        const conf = () => Math.round((0.55 + Math.random() * 0.4) * 100) / 100;

        const allMemoryPool = [...memoryNodes, ...newMemoryNodes];
        const lookupMemory = () => allMemoryPool;

        for (const agent of agents) {
          const role = detectRole(agent);
          const inboxCount = state.messages.filter((m) => m.targetAgent === agent.id).length;

          pushEvent({
            agent: agent.id,
            agentNameSnapshot: agent.name,
            actionType: "inbox_read",
            confidence: 1,
            affectedMemoryNodes: [],
            details: `${agent.name} read ${inboxCount} messages and ${memoryNodes.length} memory nodes.`,
          });

          const targets = targetsFor(agent);
          const note: string[] = [];
          let nextStatus: AgentStatus = "thinking";

          switch (role) {
            case "researcher": {
              nextStatus = "speaking";
              const finding = `Discovery: pattern Δ-${Math.floor(Math.random() * 99)} in stream cluster.`;
              for (const { tgt, conn } of targets.slice(0, 2)) {
                sendMessage(agent, tgt, "direct", finding, conf(), [], conn);
              }
              if (Math.random() > 0.4) {
                const id = nanoid(8);
                const node: MemoryNode = {
                  id,
                  title: `Discovery ${id.slice(0, 4).toUpperCase()}`,
                  content: finding + " Suggested for review.",
                  hash: hash(finding + now()),
                  integrityStatus: "pending",
                  createdByAgent: agent.id,
                  confidence: conf(),
                  tags: ["discovery", "proposed"],
                  createdAt: now(),
                  updatedAt: now(),
                };
                newMemoryNodes.push(node);
                pushEvent({
                  agent: agent.id, agentNameSnapshot: agent.name,
                  actionType: "memory_created", confidence: node.confidence,
                  affectedMemoryNodes: [id],
                  details: `${agent.name} proposed memory node "${node.title}".`,
                });
                note.push("proposed memory node");
              }
              note.push("issued discovery report");
              break;
            }
            case "verifier": {
              nextStatus = Math.random() > 0.5 ? "warning" : "thinking";
              const target = pickOne(lookupMemory());
              if (target && Math.random() > 0.4) {
                const isContradiction = Math.random() > 0.5;
                const action = isContradiction ? "contradiction_flagged" : "integrity_warning";
                const text = isContradiction
                  ? `Contradiction in "${target.title}" vs prior axioms.`
                  : `Integrity drift on hash ${target.hash}.`;
                pushEvent({
                  agent: agent.id, agentNameSnapshot: agent.name,
                  actionType: action, confidence: conf(),
                  affectedMemoryNodes: [target.id],
                  details: text,
                });
                for (const { tgt, conn } of targets.slice(0, 3)) {
                  sendMessage(agent, tgt, "warning", text, conf(), [target.id], conn);
                }
                note.push(isContradiction ? "flagged contradiction" : "raised integrity warning");
              } else {
                note.push("audit pass clean");
              }
              break;
            }
            case "builder": {
              nextStatus = "speaking";
              const refMem = pickOne(lookupMemory());
              const task = `Implementation task: scaffold module for ${refMem?.title ?? "open spec"}.`;
              for (const { tgt, conn } of targets.slice(0, 2)) {
                sendMessage(agent, tgt, "direct", task, conf(), refMem ? [refMem.id] : [], conn);
              }
              note.push("dispatched build task");
              break;
            }
            case "memory_keeper": {
              nextStatus = "learning";
              const id = nanoid(8);
              const node: MemoryNode = {
                id,
                title: `Consolidated note ${id.slice(0, 4).toUpperCase()}`,
                content: `Aggregated state across ${memoryNodes.length} prior nodes at cycle ${cycleId}.`,
                hash: hash("consolidated" + now()),
                integrityStatus: "verified",
                createdByAgent: agent.id,
                confidence: conf(),
                tags: ["consolidation", "verified"],
                createdAt: now(),
                updatedAt: now(),
              };
              newMemoryNodes.push(node);
              pushEvent({
                agent: agent.id, agentNameSnapshot: agent.name,
                actionType: "memory_created", confidence: node.confidence,
                affectedMemoryNodes: [id],
                details: `${agent.name} created memory node "${node.title}".`,
              });
              for (const { tgt, conn } of targets.slice(0, 2)) {
                sendMessage(agent, tgt, "memory", `Memory update: ${node.title}`, node.confidence, [id], conn);
              }
              note.push("committed memory update");
              break;
            }
            case "strategist": {
              nextStatus = "thinking";
              const directive = `Priority shift: focus on ${pickOne(["signal entropy", "anomaly Δ", "consensus loop", "memory integrity"])}.`;
              for (const { tgt, conn } of targets.slice(0, 4)) {
                sendMessage(agent, tgt, "direct", directive, conf(), [], conn);
              }
              note.push("issued prioritization directive");
              break;
            }
            case "dreamer": {
              nextStatus = "learning";
              const speculation = `Speculation: latent link between disparate signals.`;
              for (const { tgt, conn } of targets.slice(0, 2)) {
                sendMessage(agent, tgt, "direct", speculation, conf(), [], conn);
              }
              const pool = lookupMemory();
              if (pool.length >= 2) {
                const a1 = pool[Math.floor(Math.random() * pool.length)];
                let a2 = pool[Math.floor(Math.random() * pool.length)];
                if (a2.id === a1.id) a2 = pool[(pool.indexOf(a1) + 1) % pool.length];
                const link: MemoryLink = {
                  id: nanoid(8),
                  sourceMemoryNode: a1.id,
                  targetMemoryNode: a2.id,
                  suggestedByAgent: agent.id,
                  reason: "Speculative resonance detected during dream cycle.",
                  confidence: conf(),
                  status: "proposed",
                };
                newMemoryLinks.push(link);
                pushEvent({
                  agent: agent.id, agentNameSnapshot: agent.name,
                  actionType: "memory_link_suggested", confidence: link.confidence,
                  affectedMemoryNodes: [a1.id, a2.id],
                  details: `${agent.name} suggested link "${a1.title}" ↔ "${a2.title}".`,
                });
                note.push("dreamed a memory link");
              }
              break;
            }
            default: {
              nextStatus = pickOne<AgentStatus>(["thinking", "idle", "speaking"]) ?? "idle";
              const text = SAMPLE_THOUGHTS[Math.floor(Math.random() * SAMPLE_THOUGHTS.length)];
              for (const { tgt, conn } of targets.slice(0, 1)) {
                sendMessage(agent, tgt, "thought", text, conf(), [], conn);
              }
              note.push("generic cycle");
            }
          }

          if (nextStatus !== agent.status) {
            pushEvent({
              agent: agent.id, agentNameSnapshot: agent.name,
              actionType: "status_changed", confidence: 1,
              affectedMemoryNodes: [],
              details: `${agent.name}: ${agent.status} → ${nextStatus}`,
            });
          }
          statusOverride.set(agent.id, nextStatus);
          cycleNotes.set(agent.id, note.join(" · "));
        }

        const updatedAgents = agents.map((a) => ({
          ...a,
          status: statusOverride.get(a.id) ?? a.status,
          lastCycleAt: now(),
          cycleNotes: cycleNotes.get(a.id) ?? a.cycleNotes,
          inboxCount: a.inboxCount + (inboxDelta.get(a.id) ?? 0),
          outboxCount: a.outboxCount + (outboxDelta.get(a.id) ?? 0),
        }));

        const updatedConns = connections.map((c) =>
          pulsedConns.has(c.id) ? { ...c, lastPulseAt: now() } : c,
        );

        pushEvent({
          agent: "system",
          agentNameSnapshot: "Network",
          actionType: "cycle_complete",
          confidence: 1,
          affectedMemoryNodes: newMemoryNodes.map((n) => n.id),
          details: `Cycle ${cycleId} complete · ${newMessages.length} msgs · ${newMemoryNodes.length} memory · ${newMemoryLinks.length} links.`,
        });

        set((s) => ({
          agents: updatedAgents,
          connections: updatedConns,
          messages: [...newMessages, ...s.messages].slice(0, 500),
          memoryNodes: [...newMemoryNodes, ...s.memoryNodes],
          memoryLinks: [...newMemoryLinks, ...s.memoryLinks],
          events: [...newEvents.reverse(), ...s.events].slice(0, 1000),
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
