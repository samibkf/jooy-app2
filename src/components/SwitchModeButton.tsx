import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import type { RegionData, GuidanceItem } from "@/types/worksheet";

interface SwitchModeButtonProps {
  worksheetId: string;
  pageNumber: number;
  shouldDisplay: boolean;
  initialActiveContent?: RegionData | GuidanceItem;
  initialCurrentStepIndex?: number;
}

const SwitchModeButton: React.FC<SwitchModeButtonProps> = ({ 
  worksheetId, 
  pageNumber,
  shouldDisplay,
  initialActiveContent,
  initialCurrentStepIndex = 0
}) => {
  const navigate = useNavigate();

  if (!shouldDisplay) return null;

  const handleClick = () => {
    navigate(`/worksheet/${worksheetId}/${pageNumber}`, {
      state: {
        initialActiveContent,
        initialCurrentStepIndex
      }
    });
  };

  return (
    <Button
      onClick={handleClick}
      className="fixed bottom-20 left-4 z-70 rounded-full bg-gradient-orange-magenta hover:bg-gradient-orange-magenta text-white shadow-lg"
      size="icon"
      aria-label="Switch to Worksheet View"
    >
      <Sparkles className="h-5 w-5" />
    </Button>
  );
};

export default SwitchModeButton;