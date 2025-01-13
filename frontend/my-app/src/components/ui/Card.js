import React from 'react';

export const Card = ({ children, className = '', ...props }) => (
  <div 
    className={`border rounded-lg shadow-sm p-4 bg-white ${className}`} 
    {...props}
  >
    {children}
  </div>
);

export const CardHeader = ({ children, className = '', ...props }) => (
  <div 
    className={`border-b pb-2 mb-2 ${className}`} 
    {...props}
  >
    {children}
  </div>
);

export const CardTitle = ({ children, className = '', ...props }) => (
  <h3 
    className={`text-lg font-semibold text-gray-800 ${className}`} 
    {...props}
  >
    {children}
  </h3>
);

export const CardContent = ({ children, className = '', ...props }) => (
  <div 
    className={`${className}`} 
    {...props}
  >
    {children}
  </div>
);