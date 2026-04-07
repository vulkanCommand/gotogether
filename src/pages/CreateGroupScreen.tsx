import { useState } from "react";
import { ArrowLeft, Search, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

const allFriends = [
  { id: 1, name: "Priya Sharma", avatar: "https://i.pravatar.cc/80?img=5" },
  { id: 2, name: "Arjun Patel", avatar: "https://i.pravatar.cc/80?img=6" },
  { id: 3, name: "Sarah Chen", avatar: "https://i.pravatar.cc/80?img=7" },
  { id: 4, name: "Mike Johnson", avatar: "https://i.pravatar.cc/80?img=8" },
  { id: 5, name: "Aisha Khan", avatar: "https://i.pravatar.cc/80?img=9" },
  { id: 6, name: "Dev Rajan", avatar: "https://i.pravatar.cc/80?img=10" },
];

const CreateGroupScreen = () => {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<number[]>([]);
  const [search, setSearch] = useState("");

  const filtered = allFriends.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (id: number) =>
    setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="px-5 pt-14 pb-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-card shadow-card flex items-center justify-center">
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </button>
        <h1 className="text-lg font-bold text-foreground">Create Group</h1>
      </div>

      {/* Selected avatars */}
      {selected.length > 0 && (
        <div className="px-5 pb-3 flex gap-2 overflow-x-auto hide-scrollbar">
          {selected.map((id) => {
            const f = allFriends.find((x) => x.id === id)!;
            return (
              <div key={id} className="flex flex-col items-center gap-1 animate-scale-in">
                <div className="relative">
                  <img src={f.avatar} className="w-12 h-12 rounded-full border-2 border-accent" alt={f.name} width={80} height={80} />
                  <button
                    onClick={() => toggle(id)}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-destructive rounded-full flex items-center justify-center"
                  >
                    <X className="w-3 h-3 text-destructive-foreground" />
                  </button>
                </div>
                <span className="text-[10px] text-muted-foreground max-w-[50px] truncate">{f.name.split(" ")[0]}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Search */}
      <div className="px-5 mb-4">
        <div className="flex items-center gap-2 bg-card rounded-xl px-4 py-3 shadow-card">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search friends..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>
      </div>

      {/* Friends list */}
      <div className="px-5 space-y-2">
        {filtered.map((f) => {
          const isSelected = selected.includes(f.id);
          return (
            <button
              key={f.id}
              onClick={() => toggle(f.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                isSelected ? "bg-accent/10 border border-accent/30" : "bg-card shadow-card"
              }`}
            >
              <img src={f.avatar} className="w-10 h-10 rounded-full" alt={f.name} width={80} height={80} />
              <span className="flex-1 text-left text-sm font-medium text-foreground">{f.name}</span>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                isSelected ? "bg-accent border-accent" : "border-border"
              }`}>
                {isSelected && (
                  <svg className="w-3 h-3 text-accent-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* CTA */}
      {selected.length > 0 && (
        <div className="fixed bottom-24 left-0 right-0 px-5 max-w-lg mx-auto animate-slide-up">
          <button
            onClick={() => navigate("/trip-create")}
            className="w-full py-4 rounded-2xl gradient-primary text-accent-foreground font-semibold text-sm shadow-float active:scale-[0.98] transition-transform"
          >
            Create Group · {selected.length} members
          </button>
        </div>
      )}
    </div>
  );
};

export default CreateGroupScreen;
