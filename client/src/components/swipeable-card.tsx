import React, { useState, useRef, useEffect } from 'react';
import { Trash2, Pencil } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface SwipeableCardProps {
  children: React.ReactNode;
  onDelete: () => void;
  onEdit?: () => void;
  className?: string;
  'data-testid'?: string;
}

export function SwipeableCard({ children, onDelete, onEdit, className = '', 'data-testid': testId }: SwipeableCardProps) {
  const BUTTON_WIDTH = 80;
  const TOTAL_ACTION_WIDTH = onEdit ? BUTTON_WIDTH * 2 : BUTTON_WIDTH;
  const SWIPE_THRESHOLD = TOTAL_ACTION_WIDTH * 0.5;

  const [translateX, setTranslateX] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const currentX = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    startX.current = e.touches[0].clientX;
    currentX.current = translateX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const deltaX = startX.current - e.touches[0].clientX;
    const newTranslateX = Math.max(0, Math.min(TOTAL_ACTION_WIDTH, currentX.current + deltaX));
    setTranslateX(newTranslateX);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (translateX > SWIPE_THRESHOLD) {
      setTranslateX(TOTAL_ACTION_WIDTH);
      setIsRevealed(true);
    } else {
      setTranslateX(0);
      setIsRevealed(false);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    startX.current = e.clientX;
    currentX.current = translateX;
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    const deltaX = startX.current - e.clientX;
    const newTranslateX = Math.max(0, Math.min(TOTAL_ACTION_WIDTH, currentX.current + deltaX));
    setTranslateX(newTranslateX);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    if (translateX > SWIPE_THRESHOLD) {
      setTranslateX(TOTAL_ACTION_WIDTH);
      setIsRevealed(true);
    } else {
      setTranslateX(0);
      setIsRevealed(false);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete();
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resetCard();
    onEdit?.();
  };

  const resetCard = () => {
    setTranslateX(0);
    setIsRevealed(false);
  };

  // Add mouse event listeners to document when dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, translateX]);

  // Close card when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isRevealed && cardRef.current && !cardRef.current.contains(event.target as Node)) {
        resetCard();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isRevealed]);

  return (
    <div
      ref={cardRef}
      className="relative overflow-hidden"
      data-testid={testId}
    >
      {/* Main card content */}
      <div
        className={`transform transition-transform ${isDragging ? '' : 'duration-300 ease-out'}`}
        style={{ transform: `translateX(-${translateX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
      >
        <Card className={className}>
          {children}
        </Card>
      </div>

      {/* Action buttons revealed on swipe */}
      <div
        className="absolute top-0 right-0 h-full flex items-stretch"
        style={{
          width: `${TOTAL_ACTION_WIDTH}px`,
          transform: `translateX(${TOTAL_ACTION_WIDTH - translateX}px)`,
          transition: isDragging ? 'none' : 'transform 300ms ease-out',
        }}
      >
        {onEdit && (
          <Button
            variant="ghost"
            size="sm"
            className="h-full flex-1 bg-indigo-500 text-white hover:bg-indigo-600 hover:text-white rounded-none flex flex-col items-center justify-center gap-1"
            onClick={handleEditClick}
            data-testid={testId ? `${testId}-edit` : undefined}
          >
            <Pencil className="h-5 w-5" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-full flex-1 bg-red-500 text-white hover:bg-red-600 hover:text-white rounded-none flex flex-col items-center justify-center gap-1"
          onClick={handleDeleteClick}
          data-testid={testId ? `${testId}-delete` : undefined}
        >
          <Trash2 className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
