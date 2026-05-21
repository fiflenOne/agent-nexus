import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useNetwork } from "@/lib/network-store";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Trash2 } from "lucide-react";

export const Route = createFileRoute("/connect")({
  component: ConnectAgents,
});

function ConnectAgents() {
  const { agents, connections, createConnection, deleteConnection } = useNetwork();
  const [src, setSrc] = useState("");
  const [tgt, setTgt] = useState("");
  const [type, setType] = useState<"command" | "peer" | "observer" | "feedback">("peer");
  const [strength, setStrength] = useState(0.7);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!src || !tgt || src === tgt) return;
    createConnection({ sourceAgent: src, targetAgent: tgt, type, strength, animated: true });
    setSrc(""); setTgt("");
  };

  const nameOf = (id: string) => agents.find((a) => a.id === id)?.name ?? "?";

  return (
    <div className="p-6 max-w-3xl">
      <Link to="/" className="text-sm text-muted-foreground inline-flex items-center gap-1 mb-4 hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>
      <h1 className="text-2xl font-semibold mb-1">Connect Agents</h1>
      <p className="text-sm text-muted-foreground mb-6">Wire directional channels between agents.</p>

      <form onSubmit={submit} className="panel p-5 space-y-4 mb-6">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Source</Label>
            <select className="w-full bg-input/40 border border-border rounded-md px-2 py-2 text-sm" value={src} onChange={(e) => setSrc(e.target.value)} required>
              <option value="">Select…</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Target</Label>
            <select className="w-full bg-input/40 border border-border rounded-md px-2 py-2 text-sm" value={tgt} onChange={(e) => setTgt(e.target.value)} required>
              <option value="">Select…</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Type</Label>
            <select className="w-full bg-input/40 border border-border rounded-md px-2 py-2 text-sm" value={type} onChange={(e) => setType(e.target.value as any)}>
              <option value="command">command</option>
              <option value="peer">peer</option>
              <option value="observer">observer</option>
              <option value="feedback">feedback</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Strength: {strength.toFixed(2)}</Label>
            <input type="range" min={0.1} max={1} step={0.05} value={strength} onChange={(e) => setStrength(Number(e.target.value))} className="w-full" />
          </div>
        </div>
        <Button type="submit" className="w-full" disabled={!src || !tgt || src === tgt}>Create connection</Button>
      </form>

      <div className="panel p-5">
        <h2 className="font-medium mb-3">Existing connections</h2>
        <div className="space-y-2">
          {connections.map((c) => (
            <div key={c.id} className="flex items-center justify-between bg-secondary/30 rounded-md px-3 py-2 text-sm">
              <span><strong>{nameOf(c.sourceAgent)}</strong> → <strong>{nameOf(c.targetAgent)}</strong> · {c.type} · {c.strength.toFixed(2)}</span>
              <Button size="icon" variant="ghost" onClick={() => deleteConnection(c.id)}><Trash2 className="w-4 h-4" /></Button>
            </div>
          ))}
          {connections.length === 0 && <div className="text-sm text-muted-foreground">No connections yet.</div>}
        </div>
      </div>
    </div>
  );
}
