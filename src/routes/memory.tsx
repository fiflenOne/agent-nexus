import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useNetwork } from "@/lib/network-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Trash2, ShieldCheck, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/memory")({
  component: SharedMemory,
});

function SharedMemory() {
  const { memoryNodes, agents, addMemoryNode, deleteMemoryNode } = useNetwork();
  const [form, setForm] = useState({ title: "", content: "", tags: "", createdByAgent: "" });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    addMemoryNode({
      title: form.title,
      content: form.content,
      createdByAgent: form.createdByAgent || "system",
      confidence: 0.8,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
    });
    setForm({ title: "", content: "", tags: "", createdByAgent: "" });
  };

  const nameOf = (id: string) => agents.find((a) => a.id === id)?.name ?? "system";

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-2xl font-semibold mb-1">Shared Memory</h1>
      <p className="text-sm text-muted-foreground mb-6">Hashed knowledge nodes accessible to broadcasting agents.</p>

      <div className="grid md:grid-cols-2 gap-6">
        <form onSubmit={submit} className="panel p-5 space-y-3 h-fit">
          <h2 className="font-medium">Add memory node</h2>
          <div className="space-y-2"><Label>Title</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
          <div className="space-y-2"><Label>Content</Label>
            <Textarea rows={4} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} /></div>
          <div className="space-y-2"><Label>Tags (comma separated)</Label>
            <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="signal, anomaly" /></div>
          <div className="space-y-2"><Label>Author</Label>
            <select className="w-full bg-input/40 border border-border rounded-md px-2 py-2 text-sm"
              value={form.createdByAgent} onChange={(e) => setForm({ ...form, createdByAgent: e.target.value })}>
              <option value="">system</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <Button type="submit" className="w-full">Persist node</Button>
        </form>

        <div className="space-y-3">
          {memoryNodes.map((n) => (
            <div key={n.id} className="panel p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium flex items-center gap-2">
                    {n.integrityStatus === "verified" ? <ShieldCheck className="w-4 h-4 text-[var(--status-speaking)]" /> : <ShieldAlert className="w-4 h-4 text-[var(--status-warning)]" />}
                    {n.title}
                  </div>
                  <div className="text-xs text-muted-foreground">by {nameOf(n.createdByAgent)} · {n.hash} · conf {Math.round(n.confidence * 100)}%</div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => deleteMemoryNode(n.id)}><Trash2 className="w-4 h-4" /></Button>
              </div>
              <p className="text-sm mt-2">{n.content}</p>
              <div className="mt-2 flex gap-1 flex-wrap">
                {n.tags.map((t) => <span key={t} className="text-[10px] uppercase tracking-widest bg-accent/40 px-1.5 py-0.5 rounded">{t}</span>)}
              </div>
            </div>
          ))}
          {memoryNodes.length === 0 && <div className="text-sm text-muted-foreground">No memory nodes yet.</div>}
        </div>
      </div>
    </div>
  );
}
