import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Sparkles } from "lucide-react";
import { getTextDirection } from "@/lib/textDirection";
import type { AutoModeMetadata, AutoModePageData, AutoModeGuidanceItem } from "@/types/worksheet";

interface AutoModeViewerProps {
  worksheetId: string;
  pageIndex: number;
  worksheetMeta: AutoModeMetadata;
  pdfUrl: string;
  onTextModeChange?: (isTextMode: boolean) => void;
}

const AutoModeViewer: React.FC<AutoModeViewerProps> = ({
  worksheetId,
  pageIndex,
  worksheetMeta,
  pdfUrl,
  onTextModeChange
}) => {
  const { t } = useTranslation();
  const [isTextMode, setIsTextMode] = useState<boolean>(false);
  const [activeGuidance, setActiveGuidance] = useState<AutoModeGuidanceItem | null>(null);
  const [currentParagraphIndex, setCurrentParagraphIndex] = useState<number>(0);
  const [displayedParagraphs, setDisplayedParagraphs] = useState<string[]>([]);
  
  const textDisplayRef = useRef<HTMLDivElement>(null);

  // Get current page data
  const currentPageData = worksheetMeta.data.find(
    (page: AutoModePageData) => page.page_number === pageIndex
  );

  // Reset state when page changes
  useEffect(() => {
    setIsTextMode(false);
    setActiveGuidance(null);
    setCurrentParagraphIndex(0);
    setDisplayedParagraphs([]);
    
    if (onTextModeChange) {
      onTextModeChange(false);
    }
  }, [pageIndex, worksheetId, onTextModeChange]);

  // Scroll to bottom when new paragraphs are added
  useEffect(() => {
    if (textDisplayRef.current && displayedParagraphs.length > 0) {
      const textDisplay = textDisplayRef.current;
      textDisplay.scrollTop = textDisplay.scrollHeight;
    }
  }, [displayedParagraphs]);

  // Helper function to clean title (remove ** markers)
  const cleanTitle = (title: string): string => {
    return title.replace(/\*\*/g, '');
  };

  // Helper function to check if guidance item should be non-clickable
  const isNonClickable = (guidance: AutoModeGuidanceItem): boolean => {
    const description = guidance.description.trim();
    return description === '' || description === '<br>' || description === '<br/>';
  };

  // Helper function to split description into paragraphs
  const splitIntoParagraphs = (description: string): string[] => {
    return description
      .split('\n')
      .map(p => p.trim())
      .filter(p => p !== '' && p !== '<br>' && p !== '<br/>');
  };

  const handleGuidanceClick = (guidance: AutoModeGuidanceItem) => {
    if (isNonClickable(guidance)) return;

    const paragraphs = splitIntoParagraphs(guidance.description);
    if (paragraphs.length === 0) return;

    setActiveGuidance(guidance);
    setCurrentParagraphIndex(0);
    setDisplayedParagraphs([paragraphs[0]]);
    setIsTextMode(true);

    if (onTextModeChange) {
      onTextModeChange(true);
    }
  };

  const handleNextStep = () => {
    if (!activeGuidance) return;

    const paragraphs = splitIntoParagraphs(activeGuidance.description);
    if (currentParagraphIndex < paragraphs.length - 1) {
      const nextIndex = currentParagraphIndex + 1;
      setCurrentParagraphIndex(nextIndex);
      setDisplayedParagraphs(prev => [...prev, paragraphs[nextIndex]]);
    }
  };

  const handleBackButtonClick = () => {
    setIsTextMode(false);
    setActiveGuidance(null);
    setCurrentParagraphIndex(0);
    setDisplayedParagraphs([]);

    if (onTextModeChange) {
      onTextModeChange(false);
    }
  };

  if (!currentPageData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold text-red-500 mb-4" dir={t('common.language') === 'العربية' ? 'rtl' : 'ltr'}>
          No data available for page {pageIndex}
        </h1>
      </div>
    );
  }

  const hasNextStep = activeGuidance && currentParagraphIndex < splitIntoParagraphs(activeGuidance.description).length - 1;

  return (
    <div className={`worksheet-container ${isTextMode ? 'text-mode' : ''}`}>
      {isTextMode && (
        <Button
          onClick={handleBackButtonClick}
          className="fixed top-4 left-4 z-70 rounded-full bg-gradient-orange-magenta hover:bg-gradient-orange-magenta text-white shadow-lg"
          size="icon"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
      )}

      {!isTextMode && (
        <div className="auto-mode-guidance-list">
          <div className="max-w-4xl mx-auto p-6">
            <h1 className="text-2xl font-bold text-center mb-8 text-gradient-clip" dir={getTextDirection(currentPageData.page_description)}>
              Page {pageIndex} Guidance
            </h1>
            
            <div className="space-y-4">
              {currentPageData.guidance.map((guidance, index) => {
                const cleanedTitle = cleanTitle(guidance.title);
                const nonClickable = isNonClickable(guidance);
                
                return (
                  <div
                    key={index}
                    className={`guidance-item p-4 rounded-lg border-2 transition-all duration-200 ${
                      nonClickable
                        ? 'border-green-300 bg-green-50 cursor-default'
                        : 'border-blue-200 bg-blue-50 cursor-pointer hover:border-blue-400 hover:bg-blue-100'
                    }`}
                    onClick={() => handleGuidanceClick(guidance)}
                    dir={getTextDirection(cleanedTitle)}
                  >
                    <h3 className={`text-lg font-semibold ${
                      nonClickable ? 'text-green-700 font-bold' : 'text-blue-800'
                    }`}>
                      {cleanedTitle}
                    </h3>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeGuidance && (
        <div className={`worksheet-text-display-container ${isTextMode ? 'active' : 'hidden'}`}>
          <div 
            className="worksheet-text-display"
            ref={textDisplayRef}
          >
            <div className="text-content chat-messages">
              <div className="mb-4 p-4 bg-blue-100 rounded-lg">
                <h2 className="text-xl font-semibold text-blue-800" dir={getTextDirection(activeGuidance.title)}>
                  {cleanTitle(activeGuidance.title)}
                </h2>
              </div>
              
              {displayedParagraphs.map((paragraph, index) => (
                <div 
                  key={index} 
                  className="chat-message"
                  dir={getTextDirection(paragraph)}
                >
                  <p>{paragraph}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {hasNextStep && isTextMode && (
        <Button 
          onClick={handleNextStep} 
          className="next-button"
          variant="default"
        >
          <Sparkles className="!h-6 !w-6" />
        </Button>
      )}
    </div>
  );
};

export default AutoModeViewer;