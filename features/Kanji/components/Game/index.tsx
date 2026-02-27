'use client';
import { useEffect, useState } from 'react';
import Return from '@/shared/components/Game/ReturnFromGame';
import Pick from './Pick';
import Input from './Input';
import WordBuildingGame from './WordBuildingGame';
import useKanjiStore from '@/features/Kanji/store/useKanjiStore';
import { useStatsStore } from '@/features/Progress';
import { useShallow } from 'zustand/react/shallow';
import Stats from '@/shared/components/Game/Stats';
import ClassicSessionSummary from '@/shared/components/Game/ClassicSessionSummary';
import { useRouter } from '@/core/i18n/routing';
import { finalizeSession, startSession } from '@/shared/lib/sessionHistory';

const Game = () => {
  const {
    showStats,
    resetStats,
    recordDojoUsed,
    recordModeUsed,
    recordChallengeModeUsed,
    numCorrectAnswers,
    numWrongAnswers,
    currentStreak,
    stars,
  } =
    useStatsStore(
      useShallow(state => ({
        showStats: state.showStats,
        resetStats: state.resetStats,
        recordDojoUsed: state.recordDojoUsed,
        recordModeUsed: state.recordModeUsed,
        recordChallengeModeUsed: state.recordChallengeModeUsed,
        numCorrectAnswers: state.numCorrectAnswers,
        numWrongAnswers: state.numWrongAnswers,
        currentStreak: state.currentStreak,
        stars: state.stars,
      })),
    );

  const gameMode = useKanjiStore(state => state.selectedGameModeKanji);
  const selectedKanjiObjs = useKanjiStore(state => state.selectedKanjiObjs);
  const router = useRouter();
  const [view, setView] = useState<'playing' | 'summary'>('playing');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionNonce, setSessionNonce] = useState(0);

  useEffect(() => {
    resetStats();
    // Track dojo and mode usage for achievements (Requirements 8.1-8.3)
    recordDojoUsed('kanji');
    recordModeUsed(gameMode.toLowerCase());
    recordChallengeModeUsed('classic');
    startSession({
      sessionType: 'classic',
      dojoType: 'kanji',
      gameMode: gameMode.toLowerCase(),
      route: '/kanji/train',
    }).then(setSessionId);
  }, [
    sessionNonce,
    resetStats,
    recordDojoUsed,
    recordModeUsed,
    recordChallengeModeUsed,
    gameMode,
  ]);

  const handleQuit = async () => {
    if (sessionId) {
      await finalizeSession({
        sessionId,
        endedReason: 'manual_quit',
        endedAbruptly: true,
        correct: numCorrectAnswers,
        wrong: numWrongAnswers,
        bestStreak: currentStreak,
        stars,
      });
    }
    setView('summary');
  };

  const handleNewSession = () => {
    resetStats();
    setView('playing');
    setSessionNonce(prev => prev + 1);
  };

  return (
    <>
      <div
        key={sessionNonce}
        className='flex min-h-[100dvh] max-w-[100dvw] flex-col items-center gap-4 px-4 md:gap-6'
      >
        {showStats && <Stats />}
        <Return isHidden={showStats} gameMode={gameMode} onQuit={handleQuit} />
        {gameMode.toLowerCase() === 'pick' ? (
          <Pick
            selectedKanjiObjs={selectedKanjiObjs}
            isHidden={showStats || view !== 'playing'}
          />
        ) : gameMode.toLowerCase() === 'type' ? (
          <Input
            selectedKanjiObjs={selectedKanjiObjs}
            isHidden={showStats || view !== 'playing'}
          />
        ) : gameMode.toLowerCase() === 'anti-type' ? (
          <Input
            selectedKanjiObjs={selectedKanjiObjs}
            isHidden={showStats || view !== 'playing'}
            isReverse={true}
          />
        ) : gameMode.toLowerCase() === 'word-building' ? (
          <WordBuildingGame
            selectedKanjiObjs={selectedKanjiObjs}
            isHidden={showStats || view !== 'playing'}
          />
        ) : null}
      </div>
      {view === 'summary' && (
        <ClassicSessionSummary
          correct={numCorrectAnswers}
          wrong={numWrongAnswers}
          bestStreak={currentStreak}
          stars={stars}
          onNewSession={handleNewSession}
          onBackToSelection={() => router.push('/kanji')}
        />
      )}
    </>
  );
};

export default Game;
