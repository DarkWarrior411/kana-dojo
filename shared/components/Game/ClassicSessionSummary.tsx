'use client';

import clsx from 'clsx';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { ActionButton } from '@/shared/components/ui/ActionButton';

interface ClassicSessionSummaryProps {
  title?: string;
  subtitle?: string;
  correct: number;
  wrong: number;
  bestStreak: number;
  stars: number;
  onBackToSelection: () => void;
  onNewSession: () => void;
}

export default function ClassicSessionSummary({
  title = 'Session Summary',
  subtitle = 'Your session was saved.',
  correct,
  wrong,
  bestStreak,
  stars,
  onBackToSelection,
  onNewSession,
}: ClassicSessionSummaryProps) {
  const total = correct + wrong;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

  return (
    <div className='fixed inset-0 z-50 bg-(--background-color)'>
      <div className='flex min-h-[100dvh] items-center justify-center p-4'>
        <div className='w-full max-w-xl space-y-5 rounded-2xl border border-(--border-color) bg-(--card-color) p-6'>
          <div className='text-center'>
            <h2 className='text-2xl font-bold text-(--main-color)'>{title}</h2>
            <p className='text-sm text-(--secondary-color)'>{subtitle}</p>
          </div>

          <div className='grid grid-cols-2 gap-3'>
            <StatCard label='Correct' value={correct} className='text-green-500' />
            <StatCard label='Wrong' value={wrong} className='text-red-500' />
            <StatCard label='Accuracy' value={`${accuracy}%`} className='text-(--main-color)' />
            <StatCard label='Best Streak' value={bestStreak} className='text-(--secondary-color)' />
            <StatCard label='Stars' value={stars} className='text-(--secondary-color)' />
            <StatCard label='Attempts' value={total} className='text-(--secondary-color)' />
          </div>

          <div className='flex gap-3'>
            <ActionButton
              onClick={onBackToSelection}
              colorScheme='secondary'
              borderColorScheme='secondary'
              borderBottomThickness={10}
              borderRadius='3xl'
              className='flex-1 px-4 py-3'
            >
              <ArrowLeft size={18} />
              Back to Selection
            </ActionButton>
            <ActionButton
              onClick={onNewSession}
              borderBottomThickness={10}
              borderRadius='3xl'
              className='flex-1 px-4 py-3'
            >
              <RotateCcw size={18} />
              New Session
            </ActionButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  className,
}: {
  label: string;
  value: string | number;
  className?: string;
}) {
  return (
    <div className='rounded-xl border border-(--border-color) bg-(--background-color) p-3 text-center'>
      <p className='text-xs text-(--muted-color)'>{label}</p>
      <p className={clsx('text-xl font-bold', className)}>{value}</p>
    </div>
  );
}

