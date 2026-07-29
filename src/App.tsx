import { useState, useEffect, useCallback } from 'react';
import type { RoleMode, ThemeMode, PlayerState, AnswerRecord, SyncPayload } from './types/game';
import { syncService } from './services/syncService';
import { Navbar } from './components/Navbar';
import { PlayerView } from './components/Player/PlayerView';
import { InstitutionFooter } from './components/InstitutionFooter';

export function App() {
  // Player Client App (Always Player Role)
  const [role] = useState<RoleMode>('PLAYER');

  const [theme, setTheme] = useState<ThemeMode>('DARK');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  const [playerState, setPlayerState] = useState<PlayerState>({
    playerName: 'Eco Player',
    phase: 'NAME_INPUT',
    currentSdgNumber: 13,
    currentQuestionIndex: 0,
    score: 0,
    answers: [],
    isPaused: false,
    quizStartTime: null,
    completedTimeSeconds: 0
  });

  // Sync theme class on HTML element
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'LIGHT') {
      root.classList.add('light');
    } else {
      root.classList.remove('light');
    }
  }, [theme]);

  // Initialize Global Real-Time Player Channel Connection
  useEffect(() => {
    syncService.initGlobalChannel(false);
    const unsubConn = syncService.onConnectionChange((status) => {
      setIsConnected(status);
    });
    return () => unsubConn();
  }, []);

  // Sync state broadcast listener
  useEffect(() => {
    const unsubscribe = syncService.subscribe((payload: SyncPayload) => {
      switch (payload.event) {
        case 'SELECT_SDG':
          if (payload.sdgNumber) {
            setPlayerState(prev => ({
              ...prev,
              currentSdgNumber: payload.sdgNumber ?? null
            }));
          }
          break;

        case 'START_QUIZ':
          setPlayerState(prev => ({
            ...prev,
            phase: 'SPLASH',
            currentSdgNumber: payload.sdgNumber || prev.currentSdgNumber || 13,
            currentQuestionIndex: 0,
            score: 0,
            answers: [],
            isPaused: false,
            quizStartTime: Date.now()
          }));
          break;

        case 'PAUSE_GAME':
          setPlayerState(prev => ({ ...prev, isPaused: true }));
          break;

        case 'RESUME_GAME':
          setPlayerState(prev => ({ ...prev, isPaused: false }));
          break;

        case 'NEXT_QUESTION':
          setPlayerState(prev => ({
            ...prev,
            currentQuestionIndex: Math.min(4, prev.currentQuestionIndex + 1)
          }));
          break;

        case 'RESET_QUIZ':
          setPlayerState(prev => ({
            ...prev,
            phase: 'NAME_INPUT',
            currentQuestionIndex: 0,
            score: 0,
            answers: [],
            isPaused: false
          }));
          break;

        case 'RESET_SESSION':
          setPlayerState({
            playerName: 'Eco Player',
            phase: 'NAME_INPUT',
            currentSdgNumber: null,
            currentQuestionIndex: 0,
            score: 0,
            answers: [],
            isPaused: false,
            quizStartTime: null,
            completedTimeSeconds: 0
          });
          break;

        case 'UPDATE_PLAYER_STATE':
          if (payload.playerState) {
            setPlayerState(prev => ({ ...prev, ...payload.playerState }));
          }
          break;

        default:
          break;
      }
      setIsConnected(true);
    });

    return () => unsubscribe();
  }, []);

  // Player Actions
  const handleNameSubmitted = (name: string) => {
    setPlayerState(prev => ({
      ...prev,
      playerName: name,
      phase: 'SPIN_PROMPT'
    }));
    syncService.publish({
      event: 'UPDATE_PLAYER_STATE',
      playerState: { playerName: name, phase: 'SPIN_PROMPT' }
    });
  };

  const handleFinishSplash = useCallback(() => {
    setPlayerState(prev => ({ ...prev, phase: 'QUIZ' }));
    syncService.publish({
      event: 'UPDATE_PLAYER_STATE',
      playerState: { phase: 'QUIZ' }
    });
  }, []);

  const handleAnswerSubmitted = useCallback((record: AnswerRecord) => {
    setPlayerState(prev => {
      const updatedAnswers = [...prev.answers, record];
      const updatedScore = prev.score + record.pointsEarned;
      const newState: PlayerState = {
        ...prev,
        score: updatedScore,
        answers: updatedAnswers
      };
      syncService.publish({
        event: 'UPDATE_PLAYER_STATE',
        playerState: { score: updatedScore, answers: updatedAnswers }
      });
      return newState;
    });
  }, []);

  const handleNextQuestion = useCallback(() => {
    setPlayerState(prev => ({
      ...prev,
      currentQuestionIndex: Math.min(4, prev.currentQuestionIndex + 1)
    }));
  }, []);

  const handleQuizCompleted = useCallback(() => {
    setPlayerState(prev => {
      const newState: PlayerState = {
        ...prev,
        phase: 'SUMMARY',
        completedTimeSeconds: prev.quizStartTime ? Math.round((Date.now() - prev.quizStartTime) / 1000) : 30
      };
      syncService.publish({
        event: 'UPDATE_PLAYER_STATE',
        playerState: { phase: 'SUMMARY' }
      });
      return newState;
    });
  }, []);

  return (
    <div className={`h-[100dvh] max-h-[100dvh] w-screen overflow-hidden flex flex-col justify-between select-none transition-colors duration-300 ${theme === 'DARK' ? 'bg-arcadeDark text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      {/* Top Navbar */}
      <Navbar
        role={role}
        theme={theme}
        setTheme={setTheme}
        isMuted={isMuted}
        setIsMuted={setIsMuted}
        isConnected={isConnected}
      />

      {/* Main Container - Zero Scroll iPad Viewport */}
      <main className="flex-1 flex flex-col justify-center items-center overflow-hidden p-3 sm:p-4 max-w-7xl mx-auto w-full my-auto">
        <PlayerView
          playerState={playerState}
          onNameSubmitted={handleNameSubmitted}
          onFinishSplash={handleFinishSplash}
          onAnswerSubmitted={handleAnswerSubmitted}
          onNextQuestion={handleNextQuestion}
          onQuizCompleted={handleQuizCompleted}
        />
      </main>

      {/* Institution Footer */}
      <InstitutionFooter />
    </div>
  );
}

export default App;
