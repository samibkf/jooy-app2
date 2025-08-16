import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Sparkles, UserRound } from "lucide-react";
import { getTextDirection } from "@/lib/textDirection";
import VirtualTutorSelectionModal from "./VirtualTutorSelectionModal";
import type { AutoModeMetadata, AutoModeGuidanceItem } from "@/types/worksheet";

interface AutoModeContentDisplayProps {
  worksheetId: string;
  pageNumber: number;
  worksheetMeta: AutoModeMetadata;
  onTextModeChange?: (isTextMode: boolean) => void;
  onRegionStateChange?: (region: any | null, stepIndex: number) => void;
}

const AutoModeContentDisplay: React.FC<AutoModeContentDisplayProps> = ({
  worksheetId,
  pageNumber,
  worksheetMeta,
  onTextModeChange,
  onRegionStateChange
}) => {
  const { t } = useTranslation();
  
  const [isTextMode, setIsTextMode] = useState<boolean>(false);
  const [activeGuidanceItem, setActiveGuidanceItem] = useState<AutoModeGuidanceItem | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [displayedMessages, setDisplayedMessages] = useState<string[]>([]);
  const [isAudioPlaying, setIsAudioPlaying] = useState<boolean>(false);
  const [audioAvailable, setAudioAvailable] = useState<boolean>(true);
  const [audioCheckPerformed, setAudioCheckPerformed] = useState<boolean>(false);
  
  // Virtual tutor selection state
  const [selectedTutorVideoUrl, setSelectedTutorVideoUrl] = useState<string>(() => {
    return localStorage.getItem('selectedVirtualTutor') || '/video/1.mp4';
  });
  const [showTutorSelectionModal, setShowTutorSelectionModal] = useState<boolean>(false);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const textDisplayRef = useRef<HTMLDivElement>(null);

  // Find the current page data
  const currentPage = worksheetMeta.pages.find(page => page.page_number === pageNumber);

  // Initial audio availability check
  useEffect(() => {
    if (!audioCheckPerformed && currentPage?.guidance.length > 0) {
      const firstGuidance = currentPage.guidance[0];
      if (!firstGuidance) {
        setAudioAvailable(false);
        setAudioCheckPerformed(true);
        return;
      }
      
      // Create a simple audio path based on guidance index
      const audioPath = `/audio/${worksheetId}/${pageNumber}_1_1.mp3`;
      
      const testAudio = new Audio();
      let checkCompleted = false;
      
      const completeCheck = (available: boolean) => {
        if (checkCompleted) return;
        checkCompleted = true;
        
        setAudioAvailable(available);
        setAudioCheckPerformed(true);
        
        testAudio.removeEventListener('canplaythrough', handleCanPlay);
        testAudio.removeEventListener('error', handleError);
      };
      
      const handleCanPlay = () => {
        completeCheck(true);
      };
      
      const handleError = () => {
        completeCheck(false);
      };
      
      testAudio.addEventListener('canplaythrough', handleCanPlay);
      testAudio.addEventListener('error', handleError);
      
      const timeout = setTimeout(() => {
        completeCheck(false);
      }, 3000);
      
      testAudio.src = audioPath;
      testAudio.load();
      
      return () => {
        clearTimeout(timeout);
        testAudio.removeEventListener('canplaythrough', handleCanPlay);
        testAudio.removeEventListener('error', handleError);
        if (!checkCompleted) {
          testAudio.src = '';
        }
      };
    }
  }, [worksheetId, pageNumber, currentPage, audioCheckPerformed]);

  // Scroll to bottom when new messages are added
  useEffect(() => {
    if (textDisplayRef.current && displayedMessages.length > 0) {
      const textDisplay = textDisplayRef.current;
      textDisplay.scrollTop = textDisplay.scrollHeight;
    }
  }, [displayedMessages]);

  // Audio and video synchronization
  useEffect(() => {
    if (!videoRef.current || !audioRef.current) return;
    
    const video = videoRef.current;
    const audio = audioRef.current;
    
    const handleAudioPlaying = () => {
      setIsAudioPlaying(true);
      
      if (videoRef.current && video.paused) {
        video.currentTime = 10;
        video.play().catch(err => {
          if (err.name !== 'AbortError' && !err.message.includes('media was removed from the document')) {
            // Suppress non-debug logs
          }
        });
      }
    };
    
    const handleAudioPause = () => {
      setIsAudioPlaying(false);
    };
    
    const handleAudioEnded = () => {
      setIsAudioPlaying(false);
    };
    
    const handleVideoTimeUpdate = () => {
      if (video.currentTime >= 20) {
        video.currentTime = 10;
      }
      
      if (video.currentTime >= 9.9 && !isAudioPlaying) {
        video.currentTime = 0;
      }
      
      if (isAudioPlaying && video.currentTime < 10) {
        video.currentTime = 10;
      }
    };
    
    audio.addEventListener('playing', handleAudioPlaying);
    audio.addEventListener('pause', handleAudioPause);
    audio.addEventListener('ended', handleAudioEnded);
    video.addEventListener('timeupdate', handleVideoTimeUpdate);
    
    return () => {
      audio.removeEventListener('playing', handleAudioPlaying);
      audio.removeEventListener('pause', handleAudioPause);
      audio.removeEventListener('ended', handleAudioEnded);
      video.removeEventListener('timeupdate', handleVideoTimeUpdate);
    };
  }, [videoRef.current, audioRef.current, isAudioPlaying]);

  const formatTitle = (title: string): string => {
    // Remove asterisks from titles
    return title.replace(/^\*\*(.*)\*\*$/, '$1');
  };

  const isClickableTitle = (item: AutoModeGuidanceItem): boolean => {
    // Check if description is empty or contains only <br> tags
    if (!item.description || item.description.length === 0) {
      return false;
    }
    
    const hasContent = item.description.some(desc => 
      desc.trim() !== '' && desc.trim() !== '<br>' && desc.trim() !== '<br/>'
    );
    
    return hasContent;
  };

  const getTitleClasses = (item: AutoModeGuidanceItem): string => {
    const baseClasses = "p-4 rounded-lg border transition-all duration-200 text-left";
    
    if (!isClickableTitle(item)) {
      return `${baseClasses} font-bold text-green-600 bg-green-50 border-green-200 cursor-default`;
    }
    
    return `${baseClasses} bg-white border-gray-200 hover:border-blue-400 hover:bg-blue-50 cursor-pointer shadow-sm hover:shadow-md`;
  };

  const playAudioSegment = (guidanceIndex: number, stepIndex: number) => {
    if (!audioRef.current) return;
    
    // Create audio path based on guidance and step indices
    const audioPath = `/audio/${worksheetId}/${pageNumber}_${guidanceIndex + 1}_${stepIndex + 1}.mp3`;
    
    audioRef.current.src = audioPath;
    
    audioRef.current.onerror = () => {
      setIsAudioPlaying(false);
    };
    
    audioRef.current.play().catch(err => {
      setIsAudioPlaying(false);
    });
  };

  const handleGuidanceClick = (item: AutoModeGuidanceItem, index: number) => {
    if (!isClickableTitle(item)) return;
    
    setActiveGuidanceItem(item);
    setCurrentStepIndex(0);
    setDisplayedMessages([item.description[0]]);
    setIsTextMode(true);
    
    if (onTextModeChange) {
      onTextModeChange(true);
    }
    
    if (onRegionStateChange) {
      onRegionStateChange({ id: `guidance_${index}`, name: item.title }, 0);
    }
    
    if (videoRef.current && audioAvailable) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(err => {
        if (err.name !== 'AbortError' && !err.message.includes('media was removed from the document')) {
          // Suppress non-debug logs
        }
      });
    }
    
    if (audioAvailable) {
      setTimeout(() => {
        playAudioSegment(index, 0);
      }, 500);
    }
  };

  const handleNextStep = () => {
    if (activeGuidanceItem && currentStepIndex < activeGuidanceItem.description.length - 1) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      
      const nextStepIndex = currentStepIndex + 1;
      setCurrentStepIndex(nextStepIndex);
      
      setDisplayedMessages(prevMessages => [
        ...prevMessages,
        activeGuidanceItem.description[nextStepIndex]
      ]);
      
      if (audioAvailable) {
        const guidanceIndex = currentPage?.guidance.findIndex(g => g === activeGuidanceItem) || 0;
        setTimeout(() => {
          playAudioSegment(guidanceIndex, nextStepIndex);
        }, 500);
      }
    }
  };

  const handleBackButtonClick = () => {
    setIsTextMode(false);
    
    if (onTextModeChange) {
      onTextModeChange(false);
    }
    
    setActiveGuidanceItem(null);
    setCurrentStepIndex(0);
    setDisplayedMessages([]);
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    
    if (videoRef.current) {
      videoRef.current.pause();
    }
    
    setIsAudioPlaying(false);
  };

  const handleMessageClick = (index: number) => {
    if (!activeGuidanceItem || !audioAvailable) return;
    
    if (audioRef.current) {
      audioRef.current.pause();
    }
    
    const guidanceIndex = currentPage?.guidance.findIndex(g => g === activeGuidanceItem) || 0;
    playAudioSegment(guidanceIndex, index);
    
    const messageElement = document.querySelector(`[data-message-index="${index}"]`);
    if (messageElement) {
      messageElement.classList.add('message-highlight');
      setTimeout(() => {
        messageElement.classList.remove('message-highlight');
      }, 200);
    }
  };

  const handleTutorSelected = (videoUrl: string) => {
    setSelectedTutorVideoUrl(videoUrl);
    localStorage.setItem('selectedVirtualTutor', videoUrl);
    setShowTutorSelectionModal(false);
    
    if (videoRef.current) {
      videoRef.current.load();
      if (isAudioPlaying) {
        videoRef.current.play().catch(err => {
          if (err.name !== 'AbortError' && !err.message.includes('media was removed from the document')) {
            // Suppress non-debug logs
          }
        });
      }
    }
  };

  const handleVideoContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  if (!currentPage) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg text-gray-600">Page not found</p>
      </div>
    );
  }

  const hasNextStep = activeGuidanceItem && currentStepIndex < activeGuidanceItem.description.length - 1;

  return (
    <div className={`worksheet-container ${isTextMode ? 'text-mode' : ''}`}>
      <audio ref={audioRef} className="hidden" />
      
      {isTextMode && (
        <Button
          onClick={handleBackButtonClick}
          className="fixed top-4 left-4 z-70 rounded-full bg-gradient-orange-magenta hover:bg-gradient-orange-magenta text-white shadow-lg"
          size="icon"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
      )}
      
      {isTextMode && audioAvailable && (
        <Button
          onClick={() => setShowTutorSelectionModal(true)}
          className="fixed top-24 right-4 z-70 rounded-full bg-gradient-orange-magenta hover:bg-gradient-orange-magenta text-white shadow-lg h-8 w-8"
          aria-label="Select Virtual Tutor"
        >
          <UserRound className="h-4 w-4" />
        </Button>
      )}
      
      {!isTextMode && (
        <div className="max-w-4xl mx-auto p-6">
          <h1 className="text-2xl font-bold text-center mb-8 text-gradient-clip">
            {currentPage.page_description}
          </h1>
          
          <div className="space-y-4">
            {currentPage.guidance.map((item, index) => (
              <div
                key={index}
                className={getTitleClasses(item)}
                onClick={() => handleGuidanceClick(item, index)}
                dir={getTextDirection(item.title)}
              >
                <h3 className="text-lg font-medium">
                  {formatTitle(item.title)}
                </h3>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {activeGuidanceItem && (
        <div className={`worksheet-text-display-container ${isTextMode ? 'active' : 'hidden'}`}>
          {audioAvailable && (
            <video 
              ref={videoRef}
              className="video-element"
              src={selectedTutorVideoUrl}
              muted
              autoPlay
              playsInline
              preload="auto"
              onContextMenu={handleVideoContextMenu}
            />
          )}
          
          <div 
            className="worksheet-text-display"
            ref={textDisplayRef}
          >
            <div className="text-content chat-messages">
              {displayedMessages.map((message, index) => (
                <div 
                  key={index} 
                  className="chat-message"
                  onClick={() => handleMessageClick(index)}
                  data-message-index={index}
                  role="button"
                  tabIndex={0}
                  dir={getTextDirection(message)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleMessageClick(index);
                    }
                  }}
                >
                  <p>{message}</p>
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
      
      <VirtualTutorSelectionModal
        isOpen={showTutorSelectionModal}
        onClose={() => setShowTutorSelectionModal(false)}
        onSelectTutor={handleTutorSelected}
      />
    </div>
  );
};

export default AutoModeContentDisplay;