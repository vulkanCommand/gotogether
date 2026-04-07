import { ArrowLeft, Camera, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";

const members = [
  { name: "Kalyan", avatar: "https://i.pravatar.cc/80?img=1", confirmed: true },
  { name: "Priya", avatar: "https://i.pravatar.cc/80?img=5", confirmed: true },
  { name: "Arjun", avatar: "https://i.pravatar.cc/80?img=6", confirmed: false },
  { name: "Sarah", avatar: "https://i.pravatar.cc/80?img=7", confirmed: true },
];

const TripCompletionScreen = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="px-5 pt-14 pb-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-card shadow-card flex items-center justify-center">
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </button>
      </div>

      <div className="px-5 text-center">
        <div className="text-5xl mb-4">🎉</div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Trip Completed!</h1>
        <p className="text-sm text-muted-foreground mt-1">Bali Beach Trip · Apr 12 – 19</p>

        {/* Photo upload */}
        <div className="mt-8 mb-8">
          <button className="w-full aspect-[16/9] rounded-2xl border-2 border-dashed border-border bg-muted/50 flex flex-col items-center justify-center gap-2 active:scale-[0.98] transition-transform">
            <Camera className="w-8 h-8 text-muted-foreground" />
            <span className="text-sm text-muted-foreground font-medium">Upload Group Photo</span>
          </button>
        </div>

        {/* Members */}
        <div className="text-left">
          <h2 className="text-xs font-semibold text-foreground mb-3">Confirmation</h2>
          <div className="space-y-2">
            {members.map((m) => (
              <div key={m.name} className="flex items-center gap-3 p-3 bg-card rounded-xl shadow-card">
                <img src={m.avatar} className="w-9 h-9 rounded-full" alt={m.name} width={80} height={80} />
                <span className="flex-1 text-sm font-medium text-foreground text-left">{m.name}</span>
                {m.confirmed ? (
                  <div className="w-6 h-6 rounded-full bg-success/10 flex items-center justify-center">
                    <Check className="w-3.5 h-3.5 text-success" />
                  </div>
                ) : (
                  <span className="text-[10px] text-muted-foreground font-medium">Pending</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={() => navigate("/")}
          className="w-full py-4 rounded-2xl gradient-primary text-accent-foreground font-semibold text-sm shadow-elevated active:scale-[0.98] transition-transform mt-8"
        >
          Finish Trip
        </button>
      </div>
    </div>
  );
};

export default TripCompletionScreen;
