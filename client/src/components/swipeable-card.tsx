import React, { useState, useRef, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface SwipeableCardProps {
  children: React.ReactNode;
  onDelete: () => void;
  className?: string;
  'data-testid'?: string;
}

export function SwipeableCard({ children, onDelete, className = '', 'data-testid': testId }: SwipeableCardProps) {
  const [translateX, setTranslateX] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const currentX = useRef(0);
  const DELETE_BUTTON_WIDTH = 80; // Width of the delete button area
  const SWIPE_THRESHOLD = DELETE_BUTTON_WIDTH * 0.5; // Threshold to auto-reveal delete button

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    startX.current = e.touches[0].clientX;
    currentX.current = translateX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    
    const clientX = e.touches[0].clientX;
    const deltaX = startX.current - clientX; // Positive when swiping left
    const newTranslateX = Math.max(0, Math.min(DELETE_BUTTON_WIDTH, currentX.current + deltaX));
    
    setTranslateX(newTranslateX);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    
    // Snap to revealed or closed state based on threshold
    if (translateX > SWIPE_THRESHOLD) {
      setTranslateX(DELETE_BUTTON_WIDTH);
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
    
    // Prevent text selection while dragging
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    
    const deltaX = startX.current - e.clientX; // Positive when swiping left
    const newTranslateX = Math.max(0, Math.min(DELETE_BUTTON_WIDTH, currentX.current + deltaX));
    
    setTranslateX(newTranslateX);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    
    // Snap to revealed or closed state based on threshold
    if (translateX > SWIPE_THRESHOLD) {
      setTranslateX(DELETE_BUTTON_WIDTH);
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

      {/* Delete button revealed on swipe */}
      <div 
        className="absolute top-0 right-0 h-full flex items-center justify-center bg-red-500 text-white"
        style={{ 
          width: `${DELETE_BUTTON_WIDTH}px`,
          transform: `translateX(${DELETE_BUTTON_WIDTH - translateX}px)`,
        }}
      >
        <Button
          variant="ghost"
          size="sm"
          className="h-full w-full text-white hover:bg-red-600 hover:text-white rounded-none"
          onClick={handleDeleteClick}
          data-testid={testId ? `${testId}-delete` : undefined}
        >
          <Trash2 className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
