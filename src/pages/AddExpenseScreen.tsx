import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const members = [
  { id: 1, name: "Kalyan", avatar: "https://i.pravatar.cc/80?img=1" },
  { id: 2, name: "Priya", avatar: "https://i.pravatar.cc/80?img=5" },
  { id: 3, name: "Arjun", avatar: "https://i.pravatar.cc/80?img=6" },
  { id: 4, name: "Sarah", avatar: "https://i.pravatar.cc/80?img=7" },
  { id: 5, name: "Mike", avatar: "https://i.pravatar.cc/80?img=8" },
];

const splitOptions = ["Equal", "Custom", "Percentage"];

const AddExpenseScreen = () => {
  const navigate = useNavigate();
  const [amount, setAmount] = useState("0");
  const [splitType, setSplitType] = useState(0);
  const [selectedMembers, setSelectedMembers] = useState<number[]>([1, 2, 3, 4, 5]);

  const toggleMember = (id: number) =>
    setSelectedMembers((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  const handleDigit = (d: string) => {
    if (d === "." && amount.includes(".")) return;
    setAmount((p) => (p === "0" && d !== "." ? d : p + d));
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="px-5 pt-14 pb-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-card shadow-card flex items-center justify-center">
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </button>
        <h1 className="text-lg font-bold text-foreground">Add Expense</h1>
      </div>

      <div className="flex-1 px-5">
        {/* Amount display */}
        <div className="text-center py-8">
          <p className="text-xs text-muted-foreground mb-2 font-medium">Amount</p>
          <div className="flex items-center justify-center gap-1">
            <span className="text-4xl font-bold text-foreground tracking-tight">$</span>
            <span className="text-5xl font-bold text-foreground tracking-tight">{amount}</span>
          </div>
        </div>

        {/* Description */}
        <input
          placeholder="What's this expense for?"
          className="w-full py-3.5 px-4 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 shadow-card mb-4"
        />

        {/* Split type */}
        <div className="flex gap-1 bg-muted rounded-xl p-1 mb-4">
          {splitOptions.map((s, i) => (
            <button
              key={s}
              onClick={() => setSplitType(i)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                splitType === i ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Members */}
        <p className="text-xs font-semibold text-foreground mb-2">Split with</p>
        <div className="flex gap-2 flex-wrap mb-6">
          {members.map((m) => {
            const isSelected = selectedMembers.includes(m.id);
            return (
              <button
                key={m.id}
                onClick={() => toggleMember(m.id)}
                className={`flex items-center gap-2 py-2 px-3 rounded-full transition-all text-xs font-medium ${
                  isSelected
                    ? "bg-accent/10 text-accent border border-accent/30"
                    : "bg-card text-muted-foreground shadow-card"
                }`}
              >
                <img src={m.avatar} className="w-5 h-5 rounded-full" alt={m.name} width={80} height={80} />
                {m.name}
              </button>
            );
          })}
        </div>

        {selectedMembers.length > 0 && amount !== "0" && (
          <div className="bg-accent/10 rounded-xl p-3 mb-4 animate-scale-in">
            <p className="text-xs text-accent font-medium">
              ${(parseFloat(amount) / selectedMembers.length).toFixed(2)} per person
            </p>
          </div>
        )}
      </div>

      {/* Numpad */}
      <div className="px-5 pb-8">
        <div className="grid grid-cols-3 gap-2 mb-3">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"].map((d) => (
            <button
              key={d}
              onClick={() => {
                if (d === "⌫") setAmount((p) => (p.length <= 1 ? "0" : p.slice(0, -1)));
                else handleDigit(d);
              }}
              className="py-3 rounded-xl bg-card shadow-card text-lg font-semibold text-foreground active:scale-95 transition-transform"
            >
              {d}
            </button>
          ))}
        </div>
        <button
          onClick={() => navigate(-1)}
          className="w-full py-4 rounded-2xl gradient-primary text-accent-foreground font-semibold text-sm shadow-elevated active:scale-[0.98] transition-transform"
        >
          Add Expense
        </button>
      </div>
    </div>
  );
};

export default AddExpenseScreen;
