import { ChevronUp, ChevronDown } from "lucide-react";

interface MobilePanelToggleProps {
  panelOpen: boolean;
  onToggle: () => void;
}

export function MobilePanelToggle({ panelOpen, onToggle }: MobilePanelToggleProps) {
  return (
    <button
      className="absolute bottom-4 left-1/2 -translate-x-1/2 md:hidden z-[1000] bg-card border border-border rounded-full px-4 py-2.5 shadow-lg flex items-center gap-2"
      onClick={onToggle}
      data-testid="toggle-panel"
    >
      {panelOpen ? (
        <ChevronDown className="w-4 h-4" />
      ) : (
        <ChevronUp className="w-4 h-4" />
      )}
      <span className="text-sm font-medium">
        {panelOpen ? "Hide" : "Nearby Buses"}
      </span>
    </button>
  );
}
