import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useNetwork } from "@/lib/network-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/agents/new")({
  component: CreateAgent,
});

function CreateAgent() {
  const navigate = useNavigate();
  const createAgent = useNetwork((s) => s.createAgent);
  const [form, setForm] = useState({
    name: "",
    role: "",
    systemPrompt: "",
    color: "#7c5cff",
    memoryScope: "shared" as const,
    broadcastEnabled: true,
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Agent needs a name");
      return;
    }
    const id = createAgent({
      ...form,
      xPosition: 200 + Math.random() * 300,
      yPosition: 150 + Math.random() * 250,
    });
    toast.success(`Agent ${form.name} spawned into the network`);
    navigate({ to: "/" });
    void id;
  };

  return (
    <div className="p-6 max-w-xl">
      <Link to="/" className="text-sm text-muted-foreground inline-flex items-center gap-1 mb-4 hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>
      <h1 className="text-2xl font-semibold mb-1">Create Agent</h1>
      <p className="text-sm text-muted-foreground mb-6">Spawn a new node into the simulated network.</p>

      <form onSubmit={submit} className="panel p-5 space-y-4">
        <div className="space-y-2">
          <Label>Name *</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Cipher" required />
        </div>
        <div className="space-y-2">
          <Label>Role</Label>
          <Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Analyst, Scout, Guardian…" />
        </div>
        <div className="space-y-2">
          <Label>System Prompt</Label>
          <Textarea rows={4} value={form.systemPrompt} onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
            placeholder="Describe the agent's directive…" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Color</Label>
            <Input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Memory scope</Label>
            <select className="w-full bg-input/40 border border-border rounded-md px-2 py-2 text-sm"
              value={form.memoryScope}
              onChange={(e) => setForm({ ...form, memoryScope: e.target.value as any })}>
              <option value="private">private</option>
              <option value="shared">shared</option>
              <option value="broadcast">broadcast</option>
            </select>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <Label>Broadcast enabled</Label>
          <Switch checked={form.broadcastEnabled} onCheckedChange={(v) => setForm({ ...form, broadcastEnabled: v })} />
        </div>
        <Button type="submit" className="w-full">Spawn agent</Button>
      </form>
    </div>
  );
}
