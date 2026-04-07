import { ArrowLeft, Check, Clock, MapPin, Calendar, Users, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import tripHero from "@/assets/trip-hero.jpg";

const avatars = Array.from({ length: 5 }, (_, i) => `https://i.pravatar.cc/80?img=${i + 1}`);

const milestones = [
  { label: "Dates", done: true },
  { label: "Destination", done: true },
  { label: "Lead", done: true },
  { label: "Itinerary", done: false },
];

const TripOverviewScreen = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Hero */}
      <div className="relative">
        <img src={tripHero} className="w-full h-56 object-cover" alt="Trip destination" width={800} height={512} />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
        <button
          onClick={() => navigate(-1)}
          className="absolute top-12 left-5 w-9 h-9 rounded-full glass flex items-center justify-center"
        >
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </button>
      </div>

      <div className="px-5 -mt-12 relative z-10">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Bali Beach Trip</h1>

        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Apr 12 – 19</span>
          <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Bali, Indonesia</span>
        </div>

        {/* Avatars */}
        <div className="flex items-center gap-3 mt-4">
          <div className="flex -space-x-2">
            {avatars.map((a, i) => (
              <img key={i} src={a} className="w-8 h-8 rounded-full border-2 border-background" alt="" loading="lazy" width={80} height={80} />
            ))}
          </div>
          <span className="text-xs text-muted-foreground">5 members</span>
        </div>

        {/* Progress */}
        <div className="mt-6 bg-card rounded-2xl p-4 shadow-card">
          <h2 className="text-xs font-semibold text-foreground mb-3">Trip Progress</h2>
          <div className="flex items-center gap-1">
            {milestones.map((m, i) => (
              <div key={m.label} className="flex items-center gap-1 flex-1">
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    m.done ? "gradient-primary text-accent-foreground" : "bg-muted text-muted-foreground"
                  }`}>
                    {m.done ? <Check className="w-3.5 h-3.5" /> : i + 1}
                  </div>
                  <span className={`text-[10px] ${m.done ? "text-accent font-medium" : "text-muted-foreground"}`}>{m.label}</span>
                </div>
                {i < milestones.length - 1 && (
                  <div className={`flex-1 h-0.5 rounded-full mb-4 ${m.done ? "bg-accent" : "bg-border"}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <button
            onClick={() => navigate("/itinerary")}
            className="py-4 rounded-2xl bg-card shadow-card flex flex-col items-center gap-1.5 active:scale-[0.97] transition-transform"
          >
            <Clock className="w-5 h-5 text-accent" />
            <span className="text-xs font-semibold text-foreground">View Itinerary</span>
          </button>
          <button
            onClick={() => navigate("/live")}
            className="py-4 rounded-2xl gradient-primary flex flex-col items-center gap-1.5 active:scale-[0.97] transition-transform shadow-elevated"
          >
            <MapPin className="w-5 h-5 text-accent-foreground" />
            <span className="text-xs font-semibold text-accent-foreground">Open Live</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default TripOverviewScreen;
