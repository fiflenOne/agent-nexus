import { createFileRoute, Link } from "@tanstack/react-router";
import { useNetwork } from "@/lib/network-store";
import { STATUS_COLORS } from "@/lib/network-types";
import { useMemo } from "react";

export const Route = createFileRoute("/")({
  component: NetworkView,
});

function NetworkView() {
  const { agents, connections, messages } = useNetwork();

  const recentPulse = useMemo(() => {
    const map = new Map<string, number>();
    connections.forEach((c) => c.lastPulseAt && map.set(c.id, c.lastPulseAt));
    return map;
  }, [connections]);

  return (
    <div className="p-6 h-screen flex flex-col gap-4">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Agent Network</h1>
          <p className="text-sm text-muted-foreground">
            Live topology of {agents.length} agents · {connections.length} links · {messages.length} messages buffered
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {(["idle","thinking","speaking","warning","learning"] as const).map((s) => (
            <div key={s} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_COLORS[s], boxShadow: `0 0 10px ${STATUS_COLORS[s]}` }} />
              <span className="capitalize">{s}</span>
            </div>
          ))}
        </div>
      </header>

      <div className="panel relative flex-1 overflow-hidden">
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="currentColor" className="text-primary" />
            </marker>
          </defs>
          {connections.map((c) => {
            const a = agents.find((x) => x.id === c.sourceAgent);
            const b = agents.find((x) => x.id === c.targetAgent);
            if (!a || !b) return null;
            const recent = recentPulse.get(c.id) && Date.now() - recentPulse.get(c.id)! < 1500;
            return (
              <line
                key={c.id}
                x1={a.xPosition + 40} y1={a.yPosition + 40}
                x2={b.xPosition + 40} y2={b.yPosition + 40}
                stroke={recent ? "var(--status-speaking)" : "rgba(180,180,255,0.45)"}
                strokeWidth={1.5 + c.strength * 1.5}
                className={c.animated ? "flow-line" : ""}
                markerEnd="url(#arrow)"
              />
            );
          })}
        </svg>

        {agents.map((a) => (
          <Link
            key={a.id}
            to="/agents/$id"
            params={{ id: a.id }}
            className="absolute group"
            style={{ left: a.xPosition, top: a.yPosition }}
          >
            <div className="relative w-20 h-20 rounded-full grid place-items-center font-semibold text-sm glow-node border-2"
              style={{
                background: `radial-gradient(circle at 30% 30%, ${a.color}, oklch(0.18 0.04 270))`,
                borderColor: STATUS_COLORS[a.status],
                color: STATUS_COLORS[a.status],
                boxShadow: `0 0 24px ${STATUS_COLORS[a.status]}55`,
              }}
            >
              <span className="text-foreground drop-shadow">{a.name.slice(0, 2).toUpperCase()}</span>
              {a.status === "speaking" && <span className="pulse-ring" style={{ left: "50%", top: "50%", color: STATUS_COLORS.speaking }} />}
            </div>
            <div className="mt-1 text-center text-xs">
              <div className="font-medium">{a.name}</div>
              <div className="text-muted-foreground">{a.role}</div>
            </div>
          </Link>
        ))}

        {agents.length === 0 && (
          <div className="absolute inset-0 grid place-items-center text-center text-muted-foreground">
            <div>
              <p className="mb-2">No agents yet.</p>
              <Link to="/agents/new" className="text-primary underline">Create the first agent →</Link>
            </div>
          </div>
        )}
      </div>

      <div className="panel p-3 max-h-48 overflow-auto">
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Recent transmissions</div>
        {messages.slice(0, 8).map((m) => (
          <div key={m.id} className="text-sm py-1 border-b border-border/40 last:border-0 flex justify-between gap-3">
            <span>{m.content}</span>
            <span className="text-xs text-muted-foreground whitespace-nowrap">conf {Math.round(m.confidence * 100)}%</span>
          </div>
        ))}
        {messages.length === 0 && <div className="text-sm text-muted-foreground">Run a cycle to generate messages.</div>}
      </div>
    </div>
  );
}
