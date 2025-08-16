import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import WorksheetViewer from "@/components/WorksheetViewer";
import AIChatButton from "@/components/AIChatButton";
import { Button } from "@/components/ui/button";
import { useWorksheetData } from "@/hooks/useWorksheetData";
import type { RegionData, GuidanceItem } from "@/types/worksheet";

interface StoredContentData {
  currentStepIndex: number;
}

interface SessionPageData {
  lastActiveContentId: string | null;
  content: Record<string, StoredContentData>;
}

const WorksheetPage: React.FC = () => {
  const { t } = useTranslation();
  const { id, n } = useParams<{ id: string; n: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [isTextModeActive, setIsTextModeActive] = useState(false);
  const [currentActiveContent, setCurrentActiveContent] = useState<RegionData | GuidanceItem | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [allContentState, setAllContentState] = useState<Record<string, StoredContentData>>({});
  const [initialActiveContent, setInitialActiveContent] = useState<RegionData | GuidanceItem | null>(null);
  const [initialCurrentStepIndex, setInitialCurrentStepIndex] = useState<number>(0);
  
  // Get initial state from navigation (when returning from AI chat)
  const locationState = location.state as { 
    initialActiveContent?: RegionData | GuidanceItem; 
    initialCurrentStepIndex?: number; 
  } | null;
  
  // Fetch worksheet data once at the page level
  const { data: worksheetData, isLoading, error } = useWorksheetData(id || '');
  
  // Enable zooming for worksheet page
  useEffect(() => {
    const viewportMeta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement;
    if (viewportMeta) {
      // Store original viewport content
      const originalContent = viewportMeta.content;
      
      // Enable zooming for worksheet page
      viewportMeta.content = "width=device-width, initial-scale=1.0, user-scalable=yes, maximum-scale=5.0";
      
      // Cleanup function to restore original viewport when component unmounts
      return () => {
        if (viewportMeta) {
          viewportMeta.content = originalContent;
        }
      };
    }
  }, []);
  
  // Control zooming based on text mode state
  useEffect(() => {
    const viewportMeta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement;
    if (viewportMeta) {
      if (isTextModeActive) {
        // Disable zooming and reset zoom when entering text/audio/video mode
        viewportMeta.content = "width=device-width, initial-scale=1.0, user-scalable=no, maximum-scale=1.0";
        console.log('Zoom disabled and reset due to text mode activation');
      } else {
        // Re-enable zooming when exiting text/audio/video mode
        viewportMeta.content = "width=device-width, initial-scale=1.0, user-scalable=yes, maximum-scale=5.0";
        console.log('Zoom re-enabled due to text mode deactivation');
      }
    }
  }, [isTextModeActive]);
  
  // Load session state when worksheet or page changes
  useEffect(() => {
    if (!id || !n) return;
    
    const sessionKey = `worksheet_page_state_${id}_${n}`;
    console.log('🔍 [DEBUG] Loading session state with key:', sessionKey);
    
    try {
      const storedState = sessionStorage.getItem(sessionKey);
      console.log('🔍 [DEBUG] Raw stored state from sessionStorage:', storedState);
      
      if (storedState) {
        const parsedState = JSON.parse(storedState) as SessionPageData;
        console.log('🔍 [DEBUG] Parsed session state:', parsedState);
        
        // Set all regions state
        setAllContentState(parsedState.content || {});
        console.log('🔍 [DEBUG] Set allContentState to:', parsedState.content || {});
        
        // If we have location state (from AI chat), prioritize that
        if (locationState?.initialActiveContent) {
          console.log('🔍 [DEBUG] Using location state - initialActiveContent:', locationState.initialActiveContent);
          setInitialActiveContent(locationState.initialActiveContent);
          setInitialCurrentStepIndex(locationState.initialCurrentStepIndex || 0);
        } else if (parsedState.lastActiveContentId && worksheetData?.meta?.data) {
          // Find the last active content from the stored data
          let lastActiveContent = null;
          
          if (worksheetData.meta.mode === "regions") {
            lastActiveContent = (worksheetData.meta.data as RegionData[]).find(
              region => region.id === parsedState.lastActiveContentId
            );
          } else if (worksheetData.meta.mode === "auto") {
            // For auto mode, find guidance item by constructing ID
            const pageData = (worksheetData.meta.data as any[]).find(page => page.page_number === parseInt(n));
            if (pageData) {
              const guidanceIndex = parseInt(parsedState.lastActiveContentId.split('_')[1]);
              lastActiveContent = pageData.guidance[guidanceIndex];
              if (lastActiveContent) {
                (lastActiveContent as any).id = parsedState.lastActiveContentId;
              }
            }
          }
          
          if (lastActiveContent) {
            const contentState = parsedState.content[parsedState.lastActiveContentId];
            console.log('🔍 [DEBUG] Found last active content:', parsedState.lastActiveContentId, 'with state:', contentState);
            setInitialActiveContent(lastActiveContent);
            setInitialCurrentStepIndex(contentState?.currentStepIndex || 0);
          }
        }
      } else {
        console.log('🔍 [DEBUG] No session state found for key:', sessionKey);
        setAllContentState({});
        
        // Use location state if available
        if (locationState?.initialActiveContent) {
          console.log('🔍 [DEBUG] Using location state (no session) - initialActiveContent:', locationState.initialActiveContent);
          setInitialActiveContent(locationState.initialActiveContent);
          setInitialCurrentStepIndex(locationState.initialCurrentStepIndex || 0);
        }
      }
    } catch (error) {
      console.warn('🔍 [DEBUG] Failed to load session state:', error);
      setAllContentState({});
      
      // Use location state if available
      if (locationState?.initialActiveContent) {
        console.log('🔍 [DEBUG] Using location state (error fallback) - initialActiveContent:', locationState.initialActiveContent);
        setInitialActiveContent(locationState.initialActiveContent);
        setInitialCurrentStepIndex(locationState.initialCurrentStepIndex || 0);
      }
    }
  }, [id, n, locationState, worksheetData]);
  
  const goBack = () => {
    navigate("/");
  };

  // Memoize the handleRegionStateChange function to prevent unnecessary re-renders
  const handleContentStateChange = useCallback((content: RegionData | GuidanceItem | null, stepIndex: number) => {
    const contentId = content ? ((content as any).id || `guidance_${(content as any).index}`) : null;
    console.log('🔍 [DEBUG] handleContentStateChange called with content:', contentId, 'stepIndex:', stepIndex);
    
    // Only update state if there's an actual change
    setCurrentActiveContent(prevContent => {
      const prevId = prevContent ? ((prevContent as any).id || `guidance_${(prevContent as any).index}`) : null;
      const contentChanged = prevId !== contentId;
      if (contentChanged) {
        console.log('🔍 [DEBUG] Content changed from', prevId, 'to', contentId);
      }
      return contentChanged ? content : prevContent;
    });
    
    setCurrentStepIndex(prevStepIndex => {
      const stepChanged = prevStepIndex !== stepIndex;
      if (stepChanged) {
        console.log('🔍 [DEBUG] Step index changed from', prevStepIndex, 'to', stepIndex);
      }
      return stepChanged ? stepIndex : prevStepIndex;
    });
    
    // Update all content state and save to session storage
    if (id && n) {
      const sessionKey = `worksheet_page_state_${id}_${n}`;
      console.log('🔍 [DEBUG] Using session key for save:', sessionKey);
      
      // Use functional update to ensure we have the latest state
      setAllContentState(currentAllContentState => {
        console.log('🔍 [DEBUG] Current allContentState before update:', currentAllContentState);
        
        if (content) {
          // Update the state for this specific content
          const updatedAllContentState = {
            ...currentAllContentState,
            [contentId]: {
              currentStepIndex: stepIndex
            }
          };
          console.log('🔍 [DEBUG] Updated content state for:', contentId, 'with stepIndex:', stepIndex);
          
          const stateToSave: SessionPageData = {
            lastActiveContentId: contentId,
            content: updatedAllContentState
          };
          
          console.log('🔍 [DEBUG] About to save state to sessionStorage:', stateToSave);
          
          try {
            sessionStorage.setItem(sessionKey, JSON.stringify(stateToSave));
            console.log('🔍 [DEBUG] Successfully saved state to sessionStorage with key:', sessionKey);
            
            // Verify the save by immediately reading it back
            const verifyState = sessionStorage.getItem(sessionKey);
            console.log('🔍 [DEBUG] Verification - state read back from sessionStorage:', verifyState);
          } catch (error) {
            console.warn('🔍 [DEBUG] Failed to save page state to session:', error);
          }
          
          console.log('🔍 [DEBUG] Returning updated allContentState:', updatedAllContentState);
          return updatedAllContentState;
        } else {
          // When no active content, check if we need to update sessionStorage
          try {
            const currentStoredState = sessionStorage.getItem(sessionKey);
            let currentSessionData: SessionPageData | null = null;
            
            if (currentStoredState) {
              currentSessionData = JSON.parse(currentStoredState);
            }
            
            // Only update sessionStorage if lastActiveContentId is not already null
            if (currentSessionData?.lastActiveContentId !== null) {
              const stateToSave: SessionPageData = {
                lastActiveContentId: null,
                content: currentAllContentState
              };
              
              console.log('🔍 [DEBUG] About to save state (no active content) to sessionStorage:', stateToSave);
              
              sessionStorage.setItem(sessionKey, JSON.stringify(stateToSave));
              console.log('🔍 [DEBUG] Successfully updated last active content in session with key:', sessionKey);
              
              // Verify the save by immediately reading it back
              const verifyState = sessionStorage.getItem(sessionKey);
              console.log('🔍 [DEBUG] Verification - state read back from sessionStorage:', verifyState);
            } else {
              console.log('🔍 [DEBUG] No sessionStorage update needed - lastActiveContentId already null');
            }
          } catch (error) {
            console.warn('🔍 [DEBUG] Failed to update session state:', error);
          }
          
          console.log('🔍 [DEBUG] Returning unchanged allContentState:', currentAllContentState);
          // Return the same object reference to prevent unnecessary re-renders
          return currentAllContentState;
        }
      });
    }
  }, [id, n]); // Only depend on id and n, which are stable

  if (!id || !n) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold text-red-500 mb-4" dir={t('common.language') === 'العربية' ? 'rtl' : 'ltr'}>
          {t('aiChat.missingInfo')}
        </h1>
        <Button onClick={goBack} className="bg-gradient-orange-magenta hover:bg-gradient-orange-magenta text-white" dir={t('common.language') === 'العربية' ? 'rtl' : 'ltr'}>
          {t('worksheet.returnToScanner')}
        </Button>
      </div>
    );
  }

  const pageIndex = parseInt(n, 10);
  
  if (isNaN(pageIndex)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold text-red-500 mb-4" dir={t('common.language') === 'العربية' ? 'rtl' : 'ltr'}>
          {t('worksheet.invalidPage')}
        </h1>
        <Button onClick={goBack} className="bg-gradient-orange-magenta hover:bg-gradient-orange-magenta text-white" dir={t('common.language') === 'العربية' ? 'rtl' : 'ltr'}>
          {t('worksheet.returnToScanner')}
        </Button>
      </div>
    );
  }

  // Show loading state while fetching data
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="text-center" dir={t('common.language') === 'العربية' ? 'rtl' : 'ltr'}>
          <p className="text-lg">{t('worksheet.loading')}</p>
        </div>
      </div>
    );
  }

  // Show error if worksheet not found
  if (error || !worksheetData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="text-center" dir={t('common.language') === 'العربية' ? 'rtl' : 'ltr'}>
          <h1 className="text-2xl font-bold text-red-500 mb-4">
            {error?.message || t('worksheet.notFound')}
          </h1>
          <Button onClick={goBack} className="bg-gradient-orange-magenta hover:bg-gradient-orange-magenta text-white">
            {t('worksheet.returnToScanner')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <WorksheetViewer 
        worksheetId={id} 
        pageIndex={pageIndex} 
        worksheetMeta={worksheetData.meta}
        pdfUrl={worksheetData.pdfUrl}
        onTextModeChange={setIsTextModeActive}
        initialActiveContent={initialActiveContent}
        initialCurrentStepIndex={initialCurrentStepIndex}
        onContentStateChange={handleContentStateChange}
        allContentState={allContentState}
      />
      <AIChatButton 
        worksheetId={id} 
        pageNumber={pageIndex} 
        isTextModeActive={isTextModeActive}
        activeContent={currentActiveContent}
        currentStepIndex={currentStepIndex}
        pdfUrl={worksheetData.pdfUrl}
        worksheetMeta={worksheetData.meta}
      />
    </div>
  );
};

export default WorksheetPage;