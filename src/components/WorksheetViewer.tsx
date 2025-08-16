import React, { useState, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Document, Page, pdfjs } from "react-pdf";
import "../styles/Worksheet.css";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Sparkles, UserRound } from "lucide-react";
import { getTextDirection } from "@/lib/textDirection";
import VirtualTutorSelectionModal from "./VirtualTutorSelectionModal";
import type { WorksheetMetadata, RegionData, GuidanceItem, AutoModePageData } from "@/types/worksheet";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface StoredContentData {
  currentStepIndex: number;
}

interface WorksheetViewerProps {
  worksheetId: string;
  pageIndex: number;
  worksheetMeta: WorksheetMetadata;
  pdfUrl: string;
  onTextModeChange?: (isTextMode: boolean) => void;
  initialActiveContent?: RegionData | GuidanceItem | null;
  initialCurrentStepIndex?: number;
  onContentStateChange?: (content: RegionData | GuidanceItem | null, stepIndex: number) => void;
  allContentState?: Record<string, StoredContentData>;
}

const WorksheetViewer: React.FC<WorksheetViewerProps> = ({ 
  worksheetId, 
  pageIndex, 
  worksheetMeta,
  pdfUrl,
  onTextModeChange,
  initialActiveContent,
  initialCurrentStepIndex = 0,
  onContentStateChange,
  allContentState = {}
}) => {
  const { t } = useTranslation();
  const [numPages, setNumPages] = useState<number | null>(null);
  
  const [pdfDimensions, setPdfDimensions] = useState({ width: 0, height: 0 });
  const [scaleFactor, setScaleFactor] = useState(1);
  const [pdfPosition, setPdfPosition] = useState({ top: 0, left: 0 });
  
  const [activeContent, setActiveContent] = useState<RegionData | GuidanceItem | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  
  const [isTextMode, setIsTextMode] = useState<boolean>(false);
  const [isGuidanceTextMode, setIsGuidanceTextMode] = useState<boolean>(false);
  
  const [displayedMessages, setDisplayedMessages] = useState<string[]>([]);
  
  const [isCurrentPageDrmProtected, setIsCurrentPageDrmProtected] = useState<boolean>(false);
  
  const [isAudioPlaying, setIsAudioPlaying] = useState<boolean>(false);
  const [audioAvailable, setAudioAvailable] = useState<boolean>(true);
  const [audioCheckPerformed, setAudioCheckPerformed] = useState<boolean>(false);
  
  // Virtual tutor selection state
  const [selectedTutorVideoUrl, setSelectedTutorVideoUrl] = useState<string>(() => {
    // Load saved tutor preference from localStorage, default to Virtual Tutor 1
    return localStorage.getItem('selectedVirtualTutor') || '/video/1.mp4';
  });
  const [showTutorSelectionModal, setShowTutorSelectionModal] = useState<boolean>(false);
  
  // State to track if initial state has been restored for the current worksheet/page
  const [hasRestoredInitialState, setHasRestoredInitialState] = useState<boolean>(false);
  
  // Refs to track previous values for change detection
  const prevWorksheetIdRef = useRef<string>(worksheetId);
  const prevPageIndexRef = useRef<number>(pageIndex);
  
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const textDisplayRef = useRef<HTMLDivElement>(null);

  // Get content for current page based on mode
  const currentPageContent = useMemo(() => {
    if (!worksheetMeta?.data) return [];
    
    if (worksheetMeta.mode === "regions") {
      // Filter regions for current page and ensure description is properly split into paragraphs
      return (worksheetMeta.data as RegionData[])
        .filter((region: RegionData) => region.page === pageIndex)
        .map((region: RegionData) => {
          let processedDescription: string[] = [];
          
          if (Array.isArray(region.description)) {
            // If it's already an array, process each item to split by newlines
            processedDescription = region.description.flatMap(item => 
              typeof item === 'string' 
                ? item.split('\n').filter(paragraph => paragraph.trim() !== '')
                : []
            );
          } else if (typeof region.description === 'string') {
            // If it's a string, split by newlines
            processedDescription = region.description
              .split('\n')
              .filter(paragraph => paragraph.trim() !== '');
          }
          
          return {
            ...region,
            description: processedDescription
          };
        });
    } else if (worksheetMeta.mode === "auto") {
      // Get guidance items for current page
      const pageData = (worksheetMeta.data as AutoModePageData[]).find(
        page => page.page_number === pageIndex
      );
      return pageData ? pageData.guidance.map((guidance, index) => ({
        ...guidance,
        id: `guidance_${index}`,
        index: index
      })) : [];
    }
    
    return [];
  }, [worksheetMeta, pageIndex]);

  // Legacy regions for backward compatibility
  const regions = useMemo(() => {
    if (worksheetMeta?.mode === "regions") {
      return currentPageContent as RegionData[];
    }
    return [];
  }, [worksheetMeta, currentPageContent]);

  // Guidance items for auto mode
  const guidanceItems = useMemo(() => {
    if (worksheetMeta?.mode === "auto") {
      return currentPageContent as (GuidanceItem & { id: string; index: number })[];
    }
    return [];
  }, [worksheetMeta, currentPageContent]);

  // Helper function to clean title text (remove ** markers)
  const cleanTitle = (title: string): string => {
    return title.replace(/\*\*/g, '');
  };

  // Helper function to check if guidance item should be non-clickable
  const isNonClickableGuidance = (guidance: GuidanceItem): boolean => {
    return !guidance.description || 
           guidance.description.trim() === '' || 
           guidance.description.trim() === '<br>';
  };

  // Helper function to format guidance items for display
  const formatGuidanceForDisplay = (guidance: GuidanceItem) => {
    const cleanedTitle = cleanTitle(guidance.title);
    const isNonClickable = isNonClickableGuidance(guidance);
    
    return {
      title: cleanedTitle,
      isNonClickable,
      originalGuidance: guidance
    };
  };

  // Process guidance description into paragraphs
  const processGuidanceDescription = (description: string): string[] => {
    if (!description || description.trim() === '' || description.trim() === '<br>') {
      return [];
    }
    
    return description
      .split('\n')
      .filter(paragraph => paragraph.trim() !== '');
  };

  // Get current page description for auto mode (for AI chat context)
  const currentPageDescription = useMemo(() => {
    if (worksheetMeta?.mode === "auto") {
      const pageData = (worksheetMeta.data as AutoModePageData[]).find(
        page => page.page_number === pageIndex
      );
      return pageData?.page_description || '';
    }
    return '';
  }, [worksheetMeta, pageIndex]);

  // Legacy region processing (keeping for backward compatibility)
  const legacyRegions = useMemo(() => {
    if (worksheetMeta?.mode === "regions" && worksheetMeta.data) {
      return (worksheetMeta.data as RegionData[])
        .filter((region: RegionData) => region.page === pageIndex)
        .map((region: RegionData) => {
        let processedDescription: string[] = [];
        
        if (Array.isArray(region.description)) {
          // If it's already an array, process each item to split by newlines
          processedDescription = region.description.flatMap(item => 
            typeof item === 'string' 
              ? item.split('\n').filter(paragraph => paragraph.trim() !== '')
              : []
          );
        } else if (typeof region.description === 'string') {
          // If it's a string, split by newlines
          processedDescription = region.description
            .split('\n')
            .filter(paragraph => paragraph.trim() !== '');
        }
        
        return {
          ...region,
          description: processedDescription
        };
      });
    }
    return [];
  }, [worksheetMeta, pageIndex]);

  // Check if current page is DRM protected
  useEffect(() => {
    if (worksheetMeta) {
      const { drmProtectedPages } = worksheetMeta;
      const isDrmProtected = drmProtectedPages === true || 
        (Array.isArray(drmProtectedPages) && drmProtectedPages.includes(pageIndex));
      setIsCurrentPageDrmProtected(isDrmProtected);
    }
  }, [worksheetMeta, pageIndex]);

  // Reset component state ONLY when worksheet or page genuinely changes
  useEffect(() => {
    const worksheetChanged = prevWorksheetIdRef.current !== worksheetId;
    const pageChanged = prevPageIndexRef.current !== pageIndex;
    
    if (worksheetChanged || pageChanged) {
      // Reset all state to defaults
      setActiveContent(null);
      setCurrentStepIndex(0);
      setDisplayedMessages([]);
      setIsTextMode(false);
      setIsGuidanceTextMode(false);
      setIsAudioPlaying(false);
      setAudioCheckPerformed(false);
      setHasRestoredInitialState(false);
      
      // Notify parent about text mode change
      if (onTextModeChange) {
        onTextModeChange(false);
      }
      
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
      
      // Update refs for next comparison
      prevWorksheetIdRef.current = worksheetId;
      prevPageIndexRef.current = pageIndex;
    }
  }, [worksheetId, pageIndex, onTextModeChange]);

  // Apply initial state restoration (only once when initialActiveRegion is provided and not yet restored)
  useEffect(() => {
    if (initialActiveContent && currentPageContent.length > 0 && !hasRestoredInitialState) {
      // Find the matching content in the current page content
      const contentId = (initialActiveContent as any).id;
      const matchingContent = currentPageContent.find(content => (content as any).id === contentId);
      
      if (matchingContent) {
        setActiveContent(matchingContent);
        setCurrentStepIndex(initialCurrentStepIndex);
        setIsTextMode(true);
        
        // Set guidance text mode for auto mode
        if (worksheetMeta?.mode === "auto") {
          setIsGuidanceTextMode(true);
        }
        
        // Restore displayed messages up to the current step
        let description: string[] = [];
        if (worksheetMeta?.mode === "regions") {
          description = (matchingContent as RegionData).description || [];
        } else if (worksheetMeta?.mode === "auto") {
          description = processGuidanceDescription((matchingContent as GuidanceItem).description);
        }
        
        if (description.length > 0) {
          const messagesToDisplay = description.slice(0, initialCurrentStepIndex + 1);
          setDisplayedMessages(messagesToDisplay);
          
          // Notify parent about text mode change
          if (onTextModeChange) {
            onTextModeChange(true);
          }
          
          // Start video if available
          if (videoRef.current && audioAvailable) {
            videoRef.current.currentTime = 0;
            videoRef.current.play().catch(err => {
              // Suppress expected errors when video is removed from DOM
              if (err.name !== 'AbortError' && !err.message.includes('media was removed from the document')) {
                // Suppress non-debug logs
              }
            });
          }
          
          // Play audio for current step if available
          if (audioAvailable) {
            setTimeout(() => {
              if (worksheetMeta?.mode === "regions") {
                playAudioSegment((matchingContent as RegionData).name, initialCurrentStepIndex);
              } else if (worksheetMeta?.mode === "auto") {
                playAudioSegment(`${pageIndex}_${(matchingContent as any).index}`, initialCurrentStepIndex);
              }
            }, 500);
          }
        }
        
        // Mark initial state as restored
        setHasRestoredInitialState(true);
      }
    }
  }, [initialActiveContent, initialCurrentStepIndex, currentPageContent, hasRestoredInitialState, onTextModeChange, audioAvailable, worksheetMeta, pageIndex]);

  // Initial audio availability check - performed once when worksheet/page loads
  useEffect(() => {
    if (!audioCheckPerformed && currentPageContent.length > 0) {
      let audioPath = '';
      
      if (worksheetMeta?.mode === "regions") {
        const firstRegion = currentPageContent[0] as RegionData;
        if (!firstRegion || !firstRegion.name) {
          setAudioAvailable(false);
          setAudioCheckPerformed(true);
          return;
        }
        audioPath = `/audio/${worksheetId}/${firstRegion.name}_1.mp3`;
      } else if (worksheetMeta?.mode === "auto") {
        audioPath = `/audio/${worksheetId}/${pageIndex}_0_1.mp3`;
      } else {
        setAudioAvailable(false);
        setAudioCheckPerformed(true);
        return;
      }
      
      // Create a temporary audio object for testing
      const testAudio = new Audio();
      let checkCompleted = false;
      
      const completeCheck = (available: boolean) => {
        if (checkCompleted) return;
        checkCompleted = true;
        
        setAudioAvailable(available);
        setAudioCheckPerformed(true);
        
        // Clean up event listeners
        testAudio.removeEventListener('canplaythrough', handleCanPlay);
        testAudio.removeEventListener('error', handleError);
      };
      
      const handleCanPlay = () => {
        completeCheck(true);
      };
      
      const handleError = () => {
        completeCheck(false);
      };
      
      // Set up event listeners
      testAudio.addEventListener('canplaythrough', handleCanPlay);
      testAudio.addEventListener('error', handleError);
      
      // Set timeout to handle cases where neither event fires
      const timeout = setTimeout(() => {
        completeCheck(false);
      }, 3000); // 3 second timeout
      
      // Start the test
      testAudio.src = audioPath;
      testAudio.load();
      
      // Cleanup function
      return () => {
        clearTimeout(timeout);
        testAudio.removeEventListener('canplaythrough', handleCanPlay);
        testAudio.removeEventListener('error', handleError);
        if (!checkCompleted) {
          testAudio.src = '';
        }
      };
    }
  }, [worksheetId, pageIndex, currentPageContent, audioCheckPerformed, worksheetMeta]);

  // Notify parent when region state changes
  useEffect(() => {
    if (onContentStateChange) {
      onContentStateChange(activeContent, currentStepIndex);
    }
  }, [activeContent, currentStepIndex, onContentStateChange]);

  const handleMessageClick = (index: number) => {
    if (!activeContent || !audioAvailable) return;
    
    if (audioRef.current) {
      audioRef.current.pause();
    }
    
    if (worksheetMeta?.mode === "regions") {
      playAudioSegment((activeContent as RegionData).name, index);
    } else if (worksheetMeta?.mode === "auto") {
      playAudioSegment(`${pageIndex}_${(activeContent as any).index}`, index);
    }
    
    const messageElement = document.querySelector(`[data-message-index="${index}"]`);
    if (messageElement) {
      messageElement.classList.add('message-highlight');
      setTimeout(() => {
        messageElement.classList.remove('message-highlight');
      }, 200);
    }
  };
  
  useEffect(() => {
    const calculatePdfPositionAndScale = () => {
      if (pdfContainerRef.current) {
        const pdfCanvas = pdfContainerRef.current.querySelector('.react-pdf__Page__canvas') as HTMLCanvasElement | null;
        
        if (pdfCanvas && pdfDimensions.width > 0) {
          const containerRect = pdfContainerRef.current.getBoundingClientRect();
          const canvasRect = pdfCanvas.getBoundingClientRect();
          
          const top = canvasRect.top - containerRect.top;
          const left = canvasRect.left - containerRect.left;
          setPdfPosition({ top, left });
          
          const newScaleFactor = canvasRect.width / pdfDimensions.width;
          setScaleFactor(newScaleFactor);
        }
      }
    };
    
    calculatePdfPositionAndScale();
    
    const resizeObserver = new ResizeObserver(() => {
      calculatePdfPositionAndScale();
    });
    
    if (pdfContainerRef.current) {
      resizeObserver.observe(pdfContainerRef.current);
    }
    
    return () => {
      resizeObserver.disconnect();
    };
  }, [pdfDimensions.width, pdfContainerRef.current]);

  useEffect(() => {
    if (textDisplayRef.current && displayedMessages.length > 0) {
      const textDisplay = textDisplayRef.current;
      textDisplay.scrollTop = textDisplay.scrollHeight;
    }
  }, [displayedMessages]);

  useEffect(() => {
    if (!videoRef.current || !audioRef.current) return;
    
    const video = videoRef.current;
    const audio = audioRef.current;
    
    const handleAudioPlaying = () => {
      setIsAudioPlaying(true);
      
      // Check if video element still exists before attempting to play
      if (videoRef.current && video.paused) {
        video.currentTime = 10;
        video.play().catch(err => {
          // Suppress expected errors when video is removed from DOM or interrupted
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

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const onDocumentLoadError = (err: Error) => {
    toast({
      title: "PDF Error",
      description: "PDF not found or unable to load",
      variant: "destructive"
    });
  };
  
  const onPageLoadSuccess = (page: any) => {
    const { width, height } = page.originalWidth 
      ? { width: page.originalWidth, height: page.originalHeight }
      : page.getViewport({ scale: 1 });
      
    setPdfDimensions({ width, height });
    
    setTimeout(() => {
      const pdfCanvas = pdfContainerRef.current?.querySelector('.react-pdf__Page__canvas') as HTMLCanvasElement | null;
      if (pdfCanvas) {
        const containerRect = pdfContainerRef.current!.getBoundingClientRect();
        const canvasRect = pdfCanvas.getBoundingClientRect();
        
        const top = canvasRect.top - containerRect.top;
        const left = canvasRect.left - containerRect.left;
        setPdfPosition({ top, left });
        
        const newScaleFactor = canvasRect.width / width;
        setScaleFactor(newScaleFactor);
      }
    }, 100);
  };
  
  const playAudioSegment = (regionName: string, stepIndex: number) => {
    if (!audioRef.current) return;
    
    const audioPath = `/audio/${worksheetId}/${regionName}_${stepIndex + 1}.mp3`;
    
    audioRef.current.src = audioPath;
    
    audioRef.current.onerror = () => {
      setIsAudioPlaying(false);
    };
    
    audioRef.current.play().catch(err => {
      setIsAudioPlaying(false);
    });
  };
  
  const handleContentClick = (content: RegionData | GuidanceItem) => {
    const contentId = (content as any).id;
    console.log('🔍 [DEBUG] Content clicked:', contentId);
    
    // Get description based on content type
    let description: string[] = [];
    if (worksheetMeta?.mode === "regions") {
      description = (content as RegionData).description || [];
    } else if (worksheetMeta?.mode === "auto") {
      description = processGuidanceDescription((content as GuidanceItem).description);
    }
    
    // Check if content has no description or empty description
    if (!description || description.length === 0) {
      return; // Do nothing if no description
    }
    
    // Check if this content has saved state
    const savedContentState = allContentState[contentId];
    const startingStepIndex = savedContentState?.currentStepIndex || 0;
    
    console.log(`🔍 [DEBUG] Content ${contentId} clicked. Saved state:`, savedContentState, `Starting at step: ${startingStepIndex}`);
    
    setCurrentStepIndex(startingStepIndex);
    
    if (description.length > 0) {
      // Display messages up to the saved step index
      const messagesToDisplay = description.slice(0, startingStepIndex + 1);
      setDisplayedMessages(messagesToDisplay);
      
      if (videoRef.current && audioAvailable) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(err => {
          // Suppress expected errors when video is removed from DOM
          if (err.name !== 'AbortError' && !err.message.includes('media was removed from the document')) {
            // Suppress non-debug logs
          }
        });
      }
      
      // Only try to play audio if it's available (based on initial check)
      if (audioAvailable) {
        setTimeout(() => {
          if (worksheetMeta?.mode === "regions") {
            playAudioSegment((content as RegionData).name, startingStepIndex);
          } else if (worksheetMeta?.mode === "auto") {
            playAudioSegment(`${pageIndex}_${(content as any).index}`, startingStepIndex);
          }
        }, 500);
      }
    } else {
      setDisplayedMessages([]);
    }
    
    setActiveContent(content);
    setIsTextMode(true);
    
    // Set guidance text mode for auto mode
    if (worksheetMeta?.mode === "auto") {
      setIsGuidanceTextMode(true);
    }
    
    // Notify parent about text mode change
    if (onTextModeChange) {
      onTextModeChange(true);
    }
  };
  
  const handleNextStep = () => {
    if (!activeContent) return;
    
    // Get description based on content type
    let description: string[] = [];
    if (worksheetMeta?.mode === "regions") {
      description = (activeContent as RegionData).description || [];
    } else if (worksheetMeta?.mode === "auto") {
      description = processGuidanceDescription((activeContent as GuidanceItem).description);
    }
    
    if (description && currentStepIndex < description.length - 1) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      
      const nextStepIndex = currentStepIndex + 1;
      const contentId = (activeContent as any).id;
      console.log('🔍 [DEBUG] Advancing to next step:', nextStepIndex, 'for content:', contentId);
      
      setCurrentStepIndex(nextStepIndex);
      
      setDisplayedMessages(prevMessages => [
        ...prevMessages,
        description[nextStepIndex]
      ]);
      
      // Only try to play audio if it's available (based on initial check)
      if (audioAvailable) {
        setTimeout(() => {
          if (worksheetMeta?.mode === "regions") {
            playAudioSegment((activeContent as RegionData).name, nextStepIndex);
          } else if (worksheetMeta?.mode === "auto") {
            playAudioSegment(`${pageIndex}_${(activeContent as any).index}`, nextStepIndex);
          }
        }, 500);
      }
    }
  };
  
  const handleBackButtonClick = () => {
    if (worksheetMeta?.mode === "auto" && isGuidanceTextMode) {
      // In auto mode, first go back to guidance list
      setIsGuidanceTextMode(false);
      setDisplayedMessages([]);
      
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      
      if (videoRef.current) {
        videoRef.current.pause();
      }
      
      setIsAudioPlaying(false);
    } else {
      // Exit text mode completely
      setIsTextMode(false);
      setIsGuidanceTextMode(false);
      
      // Notify parent about text mode change
      if (onTextModeChange) {
        onTextModeChange(false);
      }
      
      // Clear the active content and reset state when manually exiting text mode
      setActiveContent(null);
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
    }
  };

  const handleGuidanceClick = (guidance: GuidanceItem & { id: string; index: number }) => {
    // Check if this guidance item is clickable
    if (isNonClickableGuidance(guidance)) {
      return;
    }
    
    handleContentClick(guidance);
  };

  const handleRegionClick = (region: RegionData) => {
    handleContentClick(region);
  };

  // Helper function to get current description for next step check
  const getCurrentDescription = (): string[] => {
    if (!activeContent) return [];
    
    if (worksheetMeta?.mode === "regions") {
      return (activeContent as RegionData).description || [];
    } else if (worksheetMeta?.mode === "auto") {
      return processGuidanceDescription((activeContent as GuidanceItem).description);
    }
    
    return [];
  };

  const handleTutorSelected = (videoUrl: string) => {
    setSelectedTutorVideoUrl(videoUrl);
    // Persist the selected tutor as the new default
    localStorage.setItem('selectedVirtualTutor', videoUrl);
    setShowTutorSelectionModal(false);
    
    // Reload the video with the new source
    if (videoRef.current) {
      videoRef.current.load();
      if (isAudioPlaying) {
        videoRef.current.play().catch(err => {
          // Suppress expected errors when video is removed from DOM
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
  
  const currentDescription = getCurrentDescription();
  const hasNextStep = currentDescription.length > 0 && currentStepIndex < currentDescription.length - 1;

  return (
    <div 
      className={`worksheet-container ${isTextMode ? 'text-mode' : ''}`} 
      ref={pdfContainerRef}
    >
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
      
      {/* Virtual Tutor Selection Button - positioned on right side with distance from QR button */}
      {isTextMode && audioAvailable && (
        <Button
          onClick={() => setShowTutorSelectionModal(true)}
          className="fixed top-24 right-4 z-70 rounded-full bg-gradient-orange-magenta hover:bg-gradient-orange-magenta text-white shadow-lg h-8 w-8"
          aria-label="Select Virtual Tutor"
        >
          <UserRound className="h-4 w-4" />
        </Button>
      )}
      
      <div className={`worksheet-pdf-container ${isTextMode ? 'hidden' : ''} ${isCurrentPageDrmProtected ? 'drm-active' : ''}`}>
        {worksheetMeta?.mode === "auto" ? (
          // Auto Mode: Display guidance titles
          <div className="auto-mode-container p-6 max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold mb-6 text-center text-gradient-clip">
              {t('worksheet.guidanceTitle', 'Step-by-Step Guidance')}
            </h2>
            <div className="space-y-4">
              {guidanceItems.map((guidance, index) => {
                const formatted = formatGuidanceForDisplay(guidance);
                return (
                  <div
                    key={guidance.id}
                    className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                      formatted.isNonClickable
                        ? 'font-bold text-green-600 border-green-300 bg-green-50 cursor-default'
                        : 'border-blue-200 bg-blue-50 hover:border-blue-400 hover:bg-blue-100 cursor-pointer'
                    }`}
                    onClick={() => !formatted.isNonClickable && handleGuidanceClick(guidance)}
                  >
                    <h3 className={`text-lg ${formatted.isNonClickable ? 'font-bold text-green-600' : 'font-medium text-blue-800'}`}>
                      {formatted.title}
                    </h3>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          // Regions Mode: Display PDF with regions
          <>
            <Document
              file={pdfUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={null}
            >
              <Page
                pageNumber={pageIndex}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                className={`worksheet-page ${isCurrentPageDrmProtected ? 'blurred' : ''}`}
                width={window.innerWidth > 768 ? 600 : undefined}
                onLoadSuccess={onPageLoadSuccess}
              />
            </Document>
            
            {isCurrentPageDrmProtected && !isTextMode && regions.map((region) => (
              <div
                key={`clear-${region.id}`}
                className="worksheet-clear-region"
                style={{
                  position: 'absolute',
                  left: `${region.x * scaleFactor + pdfPosition.left}px`,
                  top: `${region.y * scaleFactor + pdfPosition.top}px`,
                  width: `${region.width * scaleFactor}px`,
                  height: `${region.height * scaleFactor}px`,
                  overflow: 'hidden',
                  zIndex: 5,
                  border: '2px solid rgba(255, 255, 255, 0.8)',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                }}
              >
                <Document
                  file={pdfUrl}
                  className="clear-document"
                  loading={null}
                >
                  <div
                    className="clear-page-container"
                    style={{
                      position: 'absolute',
                      left: `-${region.x * scaleFactor}px`,
                      top: `-${region.y * scaleFactor}px`,
                      width: `${pdfDimensions.width * scaleFactor}px`,
                      height: `${pdfDimensions.height * scaleFactor}px`,
                      filter: 'none !important',
                      WebkitFilter: 'none !important',
                    }}
                  >
                    <Page
                      pageNumber={pageIndex}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                      width={window.innerWidth > 768 ? 600 : undefined}
                      className="clear-page"
                    />
                  </div>
                </Document>
              </div>
            ))}
            
            {regions.map((region) => (
              <div
                key={region.id}
                className="worksheet-region"
                style={{
                  position: 'absolute',
                  left: `${region.x * scaleFactor + pdfPosition.left}px`,
                  top: `${region.y * scaleFactor + pdfPosition.top}px`,
                  width: `${region.width * scaleFactor}px`,
                  height: `${region.height * scaleFactor}px`,
                  zIndex: 10,
                }}
                onClick={() => handleRegionClick(region)}
                title={region.name}
              />
            ))}
          </>
        )}
      </div>
      
      {activeContent && (isTextMode || isGuidanceTextMode) && (
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
      
      {numPages && numPages > 0 && (
        <div className="worksheet-info">
          <p className="text-sm text-gray-500 mt-2" dir={t('common.language') === 'العربية' ? 'rtl' : 'ltr'}>
            {worksheetMeta?.mode === "regions" 
              ? t('worksheet.pageInfo', { current: pageIndex, total: numPages })
              : t('worksheet.guidancePage', { current: pageIndex })
            }
          </p>
        </div>
      )}
      
      {/* Virtual Tutor Selection Modal */}
      <VirtualTutorSelectionModal
        isOpen={showTutorSelectionModal}
        onClose={() => setShowTutorSelectionModal(false)}
        onSelectTutor={handleTutorSelected}
      />
    </div>
  );
};

export default WorksheetViewer;