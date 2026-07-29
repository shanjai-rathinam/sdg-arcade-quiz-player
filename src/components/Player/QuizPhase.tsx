import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { SDGGoal, SDGQuestion, AnswerRecord } from '../../types/game';
import { TimerBar } from '../TimerBar';
import { Trophy, Pause, CheckCircle, XCircle, Lightbulb, Clock } from 'lucide-react';
import { audioService } from '../../services/audioService';

interface QuizPhaseProps {
  sdg: SDGGoal;
  currentQuestionIndex: number;
  score: number;
  isPaused: boolean;
  onAnswerSubmitted: (record: AnswerRecord) => void;
  onNextQuestion: () => void;
  onQuizCompleted: () => void;
}

export const QuizPhase: React.FC<QuizPhaseProps> = ({
  sdg,
  currentQuestionIndex,
  score,
  isPaused,
  onAnswerSubmitted,
  onNextQuestion,
  onQuizCompleted
}) => {
  const currentQuestion: SDGQuestion = sdg.questions[currentQuestionIndex] || sdg.questions[0];
  const isFinalQuestion = currentQuestionIndex >= (sdg.questions.length - 1);

  // 30-Second Question Duration
  const [timeRemaining, setTimeRemaining] = useState(30);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [pointsEarned, setPointsEarned] = useState<number | null>(null);
  const [transitionCountdown, setTransitionCountdown] = useState<number | null>(null);

  const timeRemainingRef = useRef(30);
  const isAnsweredRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transitionRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timeRemainingRef.current = timeRemaining;
  }, [timeRemaining]);

  const handleSelectOption = useCallback((optionIdx: number | null) => {
    if (isAnsweredRef.current || isPaused) return;

    isAnsweredRef.current = true;
    setIsAnswered(true);
    setSelectedOption(optionIdx);

    if (timerRef.current) clearInterval(timerRef.current);

    const isCorrect = optionIdx === currentQuestion.answerIndex;
    const remTime = timeRemainingRef.current;
    const earned = isCorrect ? 100 + (remTime * 5) : 0;
    setPointsEarned(earned);

    if (isCorrect) {
      audioService.playCorrect();
    } else {
      audioService.playWrong();
    }

    const record: AnswerRecord = {
      questionId: currentQuestion.id,
      selectedIndex: optionIdx !== null ? optionIdx : -1,
      isCorrect,
      timeRemaining: remTime,
      pointsEarned: earned
    };

    onAnswerSubmitted(record);

    setTransitionCountdown(5);
    if (transitionRef.current) clearInterval(transitionRef.current);
    let remTransition = 5;

    transitionRef.current = setInterval(() => {
      remTransition -= 1;
      setTransitionCountdown(remTransition);

      if (remTransition <= 0) {
        if (transitionRef.current) clearInterval(transitionRef.current);
        if (currentQuestionIndex + 1 >= sdg.questions.length) {
          onQuizCompleted();
        } else {
          onNextQuestion();
        }
      } else {
        audioService.playTimerTick();
      }
    }, 1000);
  }, [isPaused, currentQuestion, onAnswerSubmitted, currentQuestionIndex, sdg.questions.length, onQuizCompleted, onNextQuestion]);

  useEffect(() => {
    isAnsweredRef.current = false;
    setIsAnswered(false);
    setSelectedOption(null);
    setPointsEarned(null);
    setTransitionCountdown(null);
    setTimeRemaining(30);
    timeRemainingRef.current = 30;

    if (timerRef.current) clearInterval(timerRef.current);
    if (transitionRef.current) clearInterval(transitionRef.current);

    timerRef.current = setInterval(() => {
      if (isPaused) return;

      setTimeRemaining((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleSelectOption(null);
          return 0;
        }
        if (prev <= 5) {
          audioService.playTimerTick();
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (transitionRef.current) clearInterval(transitionRef.current);
    };
  }, [currentQuestionIndex, isPaused, handleSelectOption]);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-3 sm:space-y-4 animate-slide-up relative my-auto">
      {/* Paused Overlay */}
      {isPaused && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-6 bg-slate-950/95 backdrop-blur-md rounded-3xl text-center text-white animate-scale-in">
          <Pause className="w-16 h-16 text-amber-400 animate-pulse mb-3" />
          <h3 className="text-2xl sm:text-3xl font-black text-amber-400 tracking-tight font-heading">GAME PAUSED BY OPERATOR</h3>
          <p className="text-base text-slate-300 mt-2 font-semibold">Please wait for the host to resume...</p>
        </div>
      )}

      {/* Header Bar */}
      <div className="glass-panel p-3.5 sm:p-4 rounded-2xl border-2 border-slate-700/60 light:border-slate-300 flex items-center justify-between shadow-lg">
        <div className="flex items-center space-x-3">
          <div 
            className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-md shrink-0"
            style={{ backgroundColor: sdg.color }}
          >
            #{sdg.sdgNumber}
          </div>
          <div>
            <div className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-slate-400 light:text-slate-500">
              QUESTION {currentQuestionIndex + 1} OF 5
            </div>
            <div className="text-base sm:text-xl font-black text-white light:text-slate-900 font-heading line-clamp-1">
              {sdg.title}
            </div>
          </div>
        </div>

        {/* Live Score Counter */}
        <div className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-amber-500/10 border-2 border-amber-500/40 text-amber-400 font-black text-base sm:text-xl shadow-sm">
          <Trophy className="w-5 h-5" />
          <span>{score} pts</span>
        </div>
      </div>

      {/* 30-Second Timer Bar */}
      <div className="glass-panel p-3 rounded-xl border-2 border-slate-700/60 light:border-slate-300 shadow-sm">
        <TimerBar timeRemaining={timeRemaining} totalTime={30} color={sdg.color} />
      </div>

      {/* Main Question Card */}
      <div 
        className="glass-panel p-5 sm:p-7 rounded-3xl border-2 shadow-xl space-y-4 relative overflow-hidden transition-all"
        style={{ borderColor: `${sdg.color}66` }}
      >
        <h3 className="text-lg sm:text-2xl font-black text-white light:text-slate-900 leading-snug tracking-tight font-heading">
          {currentQuestion.question}
        </h3>

        {/* 2x2 Option Buttons Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {currentQuestion.options.map((opt, idx) => {
            const isSelected = selectedOption === idx;
            const isCorrectOption = idx === currentQuestion.answerIndex;

            let buttonStyle = 'bg-slate-950/70 light:bg-white border-slate-800 light:border-slate-300 text-slate-100 light:text-slate-900 hover:border-unblue';
            
            if (isAnswered) {
              if (isCorrectOption) {
                buttonStyle = 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-lg shadow-emerald-500/20 ring-2 ring-emerald-500';
              } else if (isSelected && !isCorrectOption) {
                buttonStyle = 'bg-rose-500/20 border-rose-500 text-rose-300 animate-shake';
              } else {
                buttonStyle = 'opacity-40 bg-slate-950/40 border-transparent text-slate-500';
              }
            }

            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectOption(idx)}
                disabled={isAnswered || isPaused}
                className={`w-full text-left p-4 sm:p-5 rounded-2xl border-2 font-extrabold text-sm sm:text-base transition-all duration-200 flex items-center justify-between space-x-3 shadow-md transform active:scale-98 ${buttonStyle}`}
              >
                <div className="flex items-center space-x-3">
                  <span className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-slate-800 light:bg-slate-200 text-slate-200 light:text-slate-800 text-sm font-black shrink-0">
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span className="leading-tight">{opt}</span>
                </div>

                {isAnswered && isCorrectOption && (
                  <CheckCircle className="w-6 h-6 text-emerald-400 shrink-0" />
                )}
                {isAnswered && isSelected && !isCorrectOption && (
                  <XCircle className="w-6 h-6 text-rose-400 shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {/* 5-Second Window Fast Fact & Countdown Box */}
        {isAnswered && (
          <div className="pt-3 border-t border-slate-700/60 light:border-slate-200 animate-scale-in space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className={`text-xs sm:text-sm font-black uppercase tracking-wider ${pointsEarned && pointsEarned > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {pointsEarned && pointsEarned > 0 ? `+${pointsEarned} POINTS EARNED!` : '0 POINTS'}
              </span>
              
              <span className="text-xs sm:text-sm font-black text-amber-400 flex items-center space-x-1.5 animate-pulse">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>
                  {isFinalQuestion
                    ? `Exiting to Results Lobby in ${transitionCountdown ?? 5}s...`
                    : `Next question in ${transitionCountdown ?? 5}s...`}
                </span>
              </span>
            </div>

            {/* Fact Box */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs sm:text-sm font-medium space-y-1 shadow-md">
              <div className="font-black uppercase text-amber-400 text-xs tracking-wider flex items-center space-x-1.5 font-heading">
                <Lightbulb className="w-4 h-4 text-amber-400" />
                <span>DID YOU KNOW?</span>
              </div>
              <p className="leading-snug text-slate-100 light:text-slate-900 font-semibold">
                {currentQuestion.explanation}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
