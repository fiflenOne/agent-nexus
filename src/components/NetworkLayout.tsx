import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useNetwork } from "@/lib/network-store";
import { Button } from "@/components/ui/button";
import {
  Network, UserPlus, Link2, Play, Pause, Repeat, Brain, ScrollText, Activity,
} from "lucide-react";

const NAV = [
  { to: "/", label: "Network", icon: Network },
  { to: "/memory", label: "Shared Memory", icon: Brain },
  { to: "/events", label: "Event Log", icon: ScrollText },
];

export function NetworkLayout() {
  const loc = useLocation();
  const { runOneCycle, autoRunning, setAutoRunning, agents, seedDemo } = useNetwork();

  useEffect(() => {
    if (agents.length === 0) seedDemo();
  }, []);

  useEffect(() => {
    if (!autoRunning) return;
    const t = setInterval(() => runOneCycle(), 1800);
    return () => clearInterval(t);
  }, [autoRunning, runOneCycle]);

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 shrink-0 border-r border-border bg-sidebar/70 backdrop-blur-md p-4 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-primary/20 border border-primary/40 grid place-items-center text-primary glow-node" style={{ color: "var(--primary)" }}>
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="font-semibold leading-tight">AgentNet</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Local Simulation Mode</div>
          </div>
        </div>

        <nav className="flex flex-col gap-1">
          {NAV.map((n) => {
            const active = loc.pathname === n.to;
            const Icon = n.icon;
            return (
              <Link key={n.to} to={n.to}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition ${
                  active ? "bg-primary/15 text-foreground border border-primary/40" : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                }`}>
                <Icon className="w-4 h-4" />{n.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-2 flex flex-col gap-2">
          <Link to="/agents/new"><Button className="w-full justify-start" variant="secondary"><UserPlus className="w-4 h-4 mr-2" />Create Agent</Button></Link>
          <Link to="/connect"><Button className="w-full justify-start" variant="secondary"><Link2 className="w-4 h-4 mr-2" />Connect Agents</Button></Link>
          <Button className="w-full justify-start" onClick={() => runOneCycle()}><Repeat className="w-4 h-4 mr-2" />Run One Cycle</Button>
          {autoRunning ? (
            <Button className="w-full justify-start" variant="destructive" onClick={() => setAutoRunning(false)}>
              <Pause className="w-4 h-4 mr-2" />Pause Network
            </Button>
          ) : (
            <Button className="w-full justify-start" variant="default" onClick={() => setAutoRunning(true)}>
              <Play className="w-4 h-4 mr-2" />Auto Run
            </Button>
          )}
        </div>

        <div className="mt-auto text-[10px] text-muted-foreground border-t border-border pt-3">
          <div>Agents: <span className="text-foreground">{agents.length}</span></div>
          <div>Status: <span className="text-foreground">{autoRunning ? "Auto-running" : "Idle"}</span></div>
          <div className="mt-2 italic">No external AI. Pure simulation.</div>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
