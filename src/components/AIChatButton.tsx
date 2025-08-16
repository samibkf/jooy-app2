import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MessageSquareText } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import type { RegionData, WorksheetMetadata } from "@/types/worksheet";

interface AIChatButtonProps {
  worksheetId: string;
  pageNumber: number;
  isTextModeActive: boolean;
  activeRegion?: RegionData | null;
  currentStepIndex?: number;
  pdfUrl: string;
  worksheetMeta: WorksheetMetadata;
  pageDescription?: string;
}

const AIChatButton: React.FC<AIChatButtonProps> = ({ 
  worksheetId, 
  pageNumber, 
  isTextModeActive,
  activeRegion,
  currentStepIndex = 0,
  pdfUrl,
  worksheetMeta,
  pageDescription
}) => {
  const navigate = useNavigate();

  const handleClick = () => {
    // Check if API key exists in localStorage
    const apiKey = localStorage.getItem('gemini-api-key');
    
    if (!apiKey) {
      // Prompt user for API key
      const userApiKey = prompt(
        'Please enter your Google Gemini API key to use AI chat:\n\n' +
        'You can get your API key from: https://aistudio.google.com/app/apikey'
      );
      
      if (!userApiKey) {
        toast({
          title: "API Key Required",
          description: "You need to provide a Gemini API key to use AI chat.",
          variant: "destructive"
        });
        return;
      }
      
      // Save API key to localStorage
      localStorage.setItem('gemini-api-key', userApiKey.trim());
      
      toast({
        title: "API Key Saved",
        description: "Your Gemini API key has been saved successfully.",
      });
    }
    
    // DEBUG: Check session state before navigating to AI chat
    const sessionKey = `worksheet_page_state_${worksheetId}_${pageNumber}`;
    const currentSessionState = sessionStorage.getItem(sessionKey);
    console.log('🔍 [DEBUG] AIChatButton - Session state BEFORE navigating to AI chat:', {
      sessionKey,
      currentSessionState,
      parsedState: currentSessionState ? JSON.parse(currentSessionState) : null
    });
    
    // Navigate to chat page with state including worksheet data
    navigate(`/chat/${worksheetId}/${pageNumber}`, { 
      state: { 
        fromTextMode: isTextModeActive,
        activeRegion: activeRegion,
        currentStepIndex: currentStepIndex,
        pdfUrl: pdfUrl,
        worksheetMeta: worksheetMeta,
        pageDescription: pageDescription
      } 
    });
  };

  const buttonClasses = cn(
    "fixed bottom-4 z-50 rounded-full bg-gradient-orange-magenta hover:bg-gradient-orange-magenta text-white shadow-lg",
    isTextModeActive ? "left-4 h-10 w-10" : "left-1/2 -translate-x-1/2 h-14 w-14 p-0"
  );

  return (
    <Button
      onClick={handleClick}
      className={buttonClasses}
      aria-label="AI Chat"
    >
      <MessageSquareText className={isTextModeActive ? "h-5 w-5" : "h-8 w-8"} />
    </Button>
  );
};

export default AIChatButton;