import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PitchCoachApp } from "./app/PitchCoachApp";
import { TooltipProvider } from "./components/ui/Tooltip";
import "./styles/theme.css";
import "./styles/ui.css";
import "./styles/app.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TooltipProvider delayDuration={300}>
      <PitchCoachApp />
    </TooltipProvider>
  </StrictMode>
);
