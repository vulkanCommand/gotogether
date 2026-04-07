import { ChevronRight, Bell, Shield, HelpCircle, LogOut, MapPin, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

const stats = [
  { label: "Trips", value: "12", icon: MapPin },
  { label: "Friends", value: "34", icon: Users },
];

const settings = [
  { label: "Notifications", icon: Bell },
  { label: "Privacy & Security", icon: Shield },
  { label: "Help & Support", icon: HelpCircle },
];

const ProfileScreen = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="px-5 pt-14 pb-6">
        <div className="flex items-center gap-4">
          <img src="https://i.pravatar.cc/120?img=1" className="w-16 h-16 rounded-full shadow-elevated" alt="Profile" width={120} height={120} />
          <div>
            <h1 className="text-xl font-bold text-foreground">Kalyan Reddy</h1>
            <p className="text-sm text-muted-foreground">@kalyanr · Joined 2023</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="px-5 mb-6">
        <div className="flex gap-3">
          {stats.map((s) => (
            <div key={s.label} className="flex-1 bg-card rounded-2xl p-4 shadow-card text-center">
              <s.icon className="w-5 h-5 text-accent mx-auto mb-1" />
              <p className="text-xl font-bold text-foreground tracking-tight">{s.value}</p>
              <p className="text-[10px] text-muted-foreground font-medium">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Settings */}
      <div className="px-5">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Settings</h2>
        <div className="bg-card rounded-2xl shadow-card overflow-hidden">
          {settings.map((s, i) => (
            <button key={s.label} className={`w-full flex items-center gap-3 p-4 text-left ${
              i < settings.length - 1 ? "border-b border-border" : ""
            }`}>
              <s.icon className="w-5 h-5 text-muted-foreground" />
              <span className="flex-1 text-sm font-medium text-foreground">{s.label}</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          ))}
        </div>

        <button
          onClick={() => navigate("/onboarding")}
          className="w-full flex items-center gap-3 p-4 mt-3 bg-destructive/5 rounded-2xl"
        >
          <LogOut className="w-5 h-5 text-destructive" />
          <span className="text-sm font-medium text-destructive">Log Out</span>
        </button>
      </div>
    </div>
  );
};

export default ProfileScreen;
