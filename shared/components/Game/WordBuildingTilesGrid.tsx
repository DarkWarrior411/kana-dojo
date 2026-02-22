'use client';

import { motion } from 'framer-motion';
import clsx from 'clsx';
import { cn } from '@/shared/lib/utils';
import {
  ActiveTile,
  BlankTile,
  celebrationBounceVariants,
  celebrationContainerVariants,
  tileContainerVariants,
  tileEntryVariants,
} from '@/shared/components/Game/wordBuildingShared';

interface WordBuildingTilesGridProps {
  allTiles: Map<number, string>;
  placedTileIds: number[];
  onTileClick: (id: number, char: string) => void;
  isTileDisabled: boolean;
  isCelebrating: boolean;
  tilesPerRow: number;
  tileSizeClassName: string;
  tileLang?: string;
  answerRowClassName: string;
  tilesContainerClassName?: string;
  tilesWrapperKey?: string;
}

const WordBuildingTilesGrid = ({
  allTiles,
  placedTileIds,
  onTileClick,
  isTileDisabled,
  isCelebrating,
  tilesPerRow,
  tileSizeClassName,
  tileLang,
  answerRowClassName,
  tilesContainerClassName,
  tilesWrapperKey,
}: WordBuildingTilesGridProps) => {
  const tileEntries = Array.from(allTiles.entries());
  const topRowTiles = tileEntries.slice(0, tilesPerRow);
  const bottomRowTiles = tileEntries.slice(tilesPerRow);
  const placedTileIdsSet = new Set(placedTileIds);
  const answerTiles = placedTileIds
    .map(id => {
      const char = allTiles.get(id);
      return char === undefined ? null : ([id, char] as const);
    })
    .filter((tile): tile is readonly [number, string] => tile !== null);

  const renderTile = ([id, char]: readonly [number, string]) => {
    const isPlaced = placedTileIdsSet.has(id);

    return (
      <motion.div
        key={`tile-slot-${id}-${char}`}
        className='relative'
        variants={tileEntryVariants}
        style={{ perspective: 1000 }}
      >
        <BlankTile char={char} sizeClassName={tileSizeClassName} />

        {!isPlaced && (
          <div className='absolute inset-0 z-10'>
            <ActiveTile
              key={`tile-${id}-${char}`}
              id={id}
              char={char}
              layoutId={`tile-${id}-${char}`}
              onClick={() => onTileClick(id, char)}
              isDisabled={isTileDisabled}
              sizeClassName={tileSizeClassName}
              lang={tileLang}
            />
          </div>
        )}
      </motion.div>
    );
  };

  return (
    <>
      <div className='flex w-full flex-col items-center'>
        <div className={clsx(answerRowClassName)}>
          <motion.div
            className='flex flex-row flex-wrap justify-start gap-3'
            variants={celebrationContainerVariants}
            initial='idle'
            animate={isCelebrating ? 'celebrate' : 'idle'}
          >
            {answerTiles.map(([id, char]) => (
              <ActiveTile
                key={`answer-tile-${id}-${char}`}
                id={id}
                char={char}
                layoutId={`tile-${id}-${char}`}
                onClick={() => onTileClick(id, char)}
                isDisabled={isTileDisabled}
                sizeClassName={tileSizeClassName}
                lang={tileLang}
                variants={celebrationBounceVariants}
                motionStyle={{ transformOrigin: '50% 100%' }}
              />
            ))}
          </motion.div>
        </div>
      </div>

      <motion.div
        key={tilesWrapperKey}
        className={cn(
          'flex flex-col items-center gap-3 sm:gap-4',
          tilesContainerClassName,
        )}
        variants={tileContainerVariants}
        initial='hidden'
        animate='visible'
      >
        <motion.div className='flex flex-row justify-center gap-3 sm:gap-4'>
          {topRowTiles.map(renderTile)}
        </motion.div>
        {bottomRowTiles.length > 0 && (
          <motion.div className='flex flex-row justify-center gap-3 sm:gap-4'>
            {bottomRowTiles.map(renderTile)}
          </motion.div>
        )}
      </motion.div>
    </>
  );
};

export default WordBuildingTilesGrid;
