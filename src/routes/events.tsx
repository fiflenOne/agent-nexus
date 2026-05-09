import { createFileRoute } from "@tanstack/react-router";
import { useNetwork } from "@/lib/network-store";

export const Route = createFileRoute("/events")({
  component: EventLog,
});

function EventLog() {
  const { events } = useNetwork();
  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-2xl font-semibold mb-1">Event Log</h1>
      <p className="text-sm text-muted-foreground mb-6">Immutable trail of network actions (most recent 500).</p>

      <div className="panel divide-y divide-border/40">
        {events.length === 0 && <div className="p-4 text-sm text-muted-foreground">No events yet. Run a cycle.</div>}
        {events.map((e) => (
          <div key={e.id} className="p-3 grid grid-cols-[160px_140px_100px_1fr] gap-3 text-sm items-baseline">
            <span className="text-xs text-muted-foreground font-mono">{new Date(e.timestamp).toLocaleString()}</span>
            <span className="text-foreground">{e.agentNameSnapshot}</span>
            <span className="text-primary font-mono text-xs">{e.actionType}</span>
            <span className="text-muted-foreground">{e.details}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
