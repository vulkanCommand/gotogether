import { Plus, ChevronRight, Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import tripHero from "@/assets/trip-hero.jpg";

const avatars = [
  "https://i.pravatar.cc/80?img=1",
  "https://i.pravatar.cc/80?img=2",
  "https://i.pravatar.cc/80?img=3",
  "https://i.pravatar.cc/80?img=4",
];

const HomeScreen = () => {
  const navigate = useNavigate();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="pb-24 bg-background min-h-screen">
      {/* Header */}
      <div className="px-5 pt-14 pb-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground font-medium">{greeting},</p>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Kalyan</h1>
        </div>
        <button className="w-10 h-10 rounded-full bg-card shadow-card flex items-center justify-center relative">
          <Bell className="w-5 h-5 text-foreground stroke-[1.5]" />
          <span className="absolute top-2 right-2.5 w-2 h-2 bg-accent rounded-full" />
        </button>
      </div>

      {/* Active Trip Card */}
      <div className="px-5 mb-6">
        <button
          onClick={() => navigate("/trip-overview")}
          className="w-full rounded-2xl overflow-hidden shadow-elevated relative group active:scale-[0.98] transition-transform"
        >
          <img src={tripHero} alt="Beach trip" className="w-full h-44 object-cover" width={800} height={512} />
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-5">
            <div className="flex items-center gap-1 mb-1">
              <span className="px-2 py-0.5 text-[10px] font-semibold bg-success text-success-foreground rounded-full">
                Active
              </span>
            </div>
            <h3 className="text-lg font-bold text-card tracking-tight">Bali Beach Trip</h3>
            <p className="text-card/70 text-xs">Apr 12 – 19 · 6 members</p>
            <div className="flex items-center mt-3 -space-x-2">
              {avatars.map((a, i) => (
                <img key={i} src={a} className="w-7 h-7 rounded-full border-2 border-card" alt="" loading="lazy" width={80} height={80} />
              ))}
              <span className="w-7 h-7 rounded-full bg-accent text-accent-foreground text-[10px] font-bold flex items-center justify-center border-2 border-card">
                +2
              </span>
            </div>
          </div>
        </button>
      </div>

      {/* Upcoming */}
      <div className="px-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">Upcoming</h2>
          <button className="text-xs text-accent font-medium flex items-center gap-0.5">
            See all <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex gap-3 overflow-x-auto hide-scrollbar">
          {[
            { title: "Swiss Alps Hike", date: "May 3 – 10", members: 4 },
            { title: "Tokyo Getaway", date: "Jun 15 – 22", members: 5 },
          ].map((trip) => (
            <div key={trip.title} className="min-w-[200px] bg-card rounded-xl p-4 shadow-card">
              <h3 className="text-sm font-semibold text-foreground">{trip.title}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{trip.date}</p>
              <div className="flex items-center gap-1 mt-3">
                <div className="flex -space-x-1.5">
                  {Array.from({ length: Math.min(trip.members, 3) }).map((_, i) => (
                    <img key={i} src={`https://i.pravatar.cc/40?img=${i + 10}`} className="w-5 h-5 rounded-full border border-card" alt="" loading="lazy" width={40} height={40} />
                  ))}
                </div>
                <span className="text-[10px] text-muted-foreground ml-1">{trip.members} members</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Activity Feed */}
      <div className="px-5">
        <h2 className="text-sm font-semibold text-foreground mb-3">Recent Activity</h2>
        <div className="space-y-3">
          {[
            { user: "Priya", action: "voted for Bali", time: "2m ago" },
            { user: "Arjun", action: "added an expense", time: "1h ago" },
            { user: "Sarah", action: "joined Swiss Alps trip", time: "3h ago" },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3 bg-card rounded-xl p-3 shadow-card">
              <img src={`https://i.pravatar.cc/40?img=${i + 5}`} className="w-9 h-9 rounded-full" alt="" loading="lazy" width={40} height={40} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground">
                  <span className="font-semibold">{item.user}</span>{" "}
                  <span className="text-muted-foreground">{item.action}</span>
                </p>
              </div>
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">{item.time}</span>
            </div>
          ))}
        </div>
      </div>

      {/* FAB */}
      <button
        onClick={() => navigate("/create-group")}
        className="fixed bottom-24 right-6 w-14 h-14 gradient-primary rounded-full shadow-float flex items-center justify-center active:scale-90 transition-transform z-40"
      >
        <Plus className="w-6 h-6 text-accent-foreground" />
      </button>
    </div>
  );
};

export default HomeScreen;
