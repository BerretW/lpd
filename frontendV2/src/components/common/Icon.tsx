

import React from 'react';

interface IconProps {
  name: string;
  className?: string;
  // FIX: Add optional title prop to support tooltips, resolving an error in Inventory.tsx.
  title?: string;
}

const Icon: React.FC<IconProps> = ({ name, className, title }) => {
  return <i className={`fas ${name} ${className || ''}`} title={title}></i>;
};

export default Icon;
