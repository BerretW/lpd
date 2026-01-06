
import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

const Card: React.FC<CardProps> = ({ children, className = '', onClick }) => {
  return (
    <div
      className={`bg-white p-6 rounded-lg shadow-md border border-transparent transition-shadow ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

export default Card;
