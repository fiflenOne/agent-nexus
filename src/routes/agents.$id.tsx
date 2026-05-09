import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useNetwork } from "@/lib/network-store";
import { STATUS_COLORS, type AgentStatus } from "@/lib/network-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Trash2 } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/agents/$id")({
  component: AgentInspector,
});

function AgentInspector() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { agents, messages, updateAgent, deleteAgent, connections } = useNetwork();
  const agent = agents.find((a) => a.id === id);
  const [draft, setDraft] = useState(agent);

  if (!agent || !draft) {
    return (
      <div className="p-6">
        <p>Agent not found.</p>
        <Link to="/" className="text-primary underline">Back to network</Link>
      </div>
    );
  }

  const inbox = messages.filter((m) => m.targetAgent === agent.id);
  const outbox = messages.filter((m) => m.sourceAgent === agent.id);
  const conns = connections.filter((c) => c.sourceAgent === agent.id || c.targetAgent === agent.id);

  const save = () => {
    updateAgent(agent.id, draft);
  };

  return (
    <div className="p-6 max-w-5xl">
      <Link to="/" className="text-sm text-muted-foreground inline-flex items-center gap-1 mb-4 hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Back to network
      </Link>

      <div className="flex items-start gap-4 mb-6">
        <div className="w-20 h-20 rounded-full glow-node grid place-items-center font-bold text-lg border-2"
          style={{
            background: `radial-gradient(circle at 30% 30%, ${agent.color}, oklch(0.18 0.04 270))`,
            borderColor: STATUS_COLORS[agent.status],
            color: STATUS_COLORS[agent.status],
            boxShadow: `0 0 24px ${STATUS_COLORS[agent.status]}66`,
          }}>
          {agent.name.slice(0,2).toUpperCase()}
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">{agent.name}</h1>
          <p className="text-muted-foreground">{agent.role}</p>
          <div className="text-xs mt-1 text-muted-foreground">
            Status: <span style={{ color: STATUS_COLORS[agent.status] }}>{agent.status}</span> · Last cycle: {agent.lastCycleAt ? new Date(agent.lastCycleAt).toLocaleTimeString() : "—"}
          </div>
        </div>
        <Button variant="destructive" onClick={() => { deleteAgent(agent.id); navigate({ to: "/" }); }}>
          <Trash2 className="w-4 h-4 mr-1" /> Remove
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="panel p-5 space-y-3">
          <h2 className="font-medium mb-2">Configuration</h2>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Input value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>System Prompt</Label>
            <Textarea rows={4} value={draft.systemPrompt} onChange={(e) => setDraft({ ...draft, systemPrompt: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Color</Label>
              <Input type="color" value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <select className="w-full bg-input/40 border border-border rounded-md px-2 py-2 text-sm"
                value={draft.status}
                onChange={(e) => setDraft({ ...draft, status: e.target.value as AgentStatus })}>
                {(["idle","thinking","speaking","warning","learning"] as const).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label>Broadcast enabled</Label>
            <Switch checked={draft.broadcastEnabled} onCheckedChange={(v) => setDraft({ ...draft, broadcastEnabled: v })} />
          </div>
          <Button onClick={save} className="w-full">Save changes</Button>
        </div>

        <div className="space-y-4">
          <div className="panel p-5">
            <h2 className="font-medium mb-2">Stats</h2>
            <div className="grid grid-cols-3 gap-3 text-center">
              <Stat label="Inbox" value={inbox.length} />
              <Stat label="Outbox" value={outbox.length} />
              <Stat label="Links" value={conns.length} />
            </div>
            <div className="mt-3 text-sm text-muted-foreground italic">"{agent.cycleNotes || "No cycle notes yet."}"</div>
          </div>

          <div className="panel p-5">
            <h2 className="font-medium mb-2">Recent messages</h2>
            <div className="space-y-1 max-h-64 overflow-auto">
              {[...inbox, ...outbox].sort((a,b) => b.timestamp - a.timestamp).slice(0, 10).map((m) => (
                <div key={m.id} className="text-sm border-b border-border/40 py-1">
                  <div>{m.content}</div>
                  <div className="text-xs text-muted-foreground">{m.messageType} · {new Date(m.timestamp).toLocaleTimeString()}</div>
                </div>
              ))}
              {inbox.length + outbox.length === 0 && <div className="text-sm text-muted-foreground">No traffic yet.</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-secondary/40 rounded-md p-2">
      <div className="text-xl font-semibold">{value}</div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
    </div>
  );
}
