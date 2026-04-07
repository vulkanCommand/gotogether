import { ReactNode } from "react";

const AppShell = ({ children }: { children: ReactNode }) => {
  return (
    <div className="max-w-lg mx-auto min-h-screen bg-background relative">
      {children}
    </div>
  );
};

export default AppShell;
