import { ArrowLeft, Navigation, Clock, ChevronUp } from "lucide-react";
import { useNavigate } from "react-router-dom";

const users = [
  { name: "Kalyan", avatar: "https://i.pravatar.cc/80?img=1", eta: "2 min", x: 35, y: 40 },
  { name: "Priya", avatar: "https://i.pravatar.cc/80?img=5", eta: "8 min", x: 55, y: 55 },
  { name: "Arjun", avatar: "https://i.pravatar.cc/80?img=6", eta: "15 min", x: 70, y: 30 },
  { name: "Sarah", avatar: "https://i.pravatar.cc/80?img=7", eta: "Arrived", x: 40, y: 60 },
];

const LiveScreen = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background relative">
      {/* Map area */}
      <div className="absolute inset-0 bg-gradient-to-b from-muted to-background">
        {/* Simulated map grid */}
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
          backgroundSize: "40px 40px"
        }} />

        {/* Map road lines */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.08]" viewBox="0 0 400 800">
          <path d="M50 0 L200 400 L350 800" stroke="hsl(var(--foreground))" strokeWidth="3" fill="none" />
          <path d="M0 300 L400 250" stroke="hsl(var(--foreground))" strokeWidth="2" fill="none" />
          <path d="M0 500 L400 550" stroke="hsl(var(--foreground))" strokeWidth="2" fill="none" />
        </svg>

        {/* User pins */}
        {users.map((u) => (
          <div
            key={u.name}
            className="absolute flex flex-col items-center gap-1 animate-fade-in"
            style={{ left: `${u.x}%`, top: `${u.y}%`, transform: "translate(-50%, -50%)" }}
          >
            <div className="relative">
              <img src={u.avatar} className="w-10 h-10 rounded-full border-2 border-card shadow-elevated" alt={u.name} width={80} height={80} />
              {u.eta === "Arrived" ? (
                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-success rounded-full border-2 border-card" />
              ) : (
                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-accent rounded-full border-2 border-card animate-pulse-soft" />
              )}
            </div>
            <div className="bg-card/90 backdrop-blur-sm rounded-lg px-2 py-0.5 shadow-sm">
              <span className="text-[10px] font-semibold text-foreground">{u.eta}</span>
            </div>
          </div>
        ))}

        {/* Destination pin */}
        <div className="absolute left-[42%] top-[62%] flex flex-col items-center gap-1">
          <div className="w-5 h-5 gradient-primary rounded-full flex items-center justify-center shadow-float animate-pulse-soft">
            <Navigation className="w-2.5 h-2.5 text-accent-foreground" />
          </div>
          <div className="w-3 h-3 gradient-primary rounded-full opacity-20 -mt-1.5" />
        </div>
      </div>

      {/* Header */}
      <div className="relative z-10 px-5 pt-14 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full glass flex items-center justify-center shadow-card">
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </button>
        <div className="flex-1 glass rounded-xl px-4 py-2.5 shadow-card">
          <div className="flex items-center gap-2">
            <Navigation className="w-4 h-4 text-accent" />
            <div>
              <p className="text-xs font-semibold text-foreground">Next: Beach Trail</p>
              <p className="text-[10px] text-muted-foreground">1.2 km away</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-20">
        <div className="max-w-lg mx-auto">
          <div className="bg-card rounded-t-3xl shadow-float p-5 safe-bottom">
            <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4" />

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
                <Clock className="w-5 h-5 text-accent-foreground" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-foreground">Beach Trail Hike</h3>
                <p className="text-xs text-muted-foreground">Nusa Penida · 10:00 AM</p>
              </div>
            </div>

            <div className="flex items-center gap-3 mb-5">
              <div className="flex -space-x-2">
                {users.slice(0, 3).map((u) => (
                  <img key={u.name} src={u.avatar} className="w-7 h-7 rounded-full border-2 border-card" alt={u.name} width={80} height={80} />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">
                {users.filter((u) => u.eta === "Arrived").length} arrived · {users.filter((u) => u.eta !== "Arrived").length} on the way
              </span>
            </div>

            <button className="w-full py-4 rounded-2xl gradient-primary text-accent-foreground font-semibold text-sm shadow-elevated active:scale-[0.98] transition-transform">
              Let's Go
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveScreen;
