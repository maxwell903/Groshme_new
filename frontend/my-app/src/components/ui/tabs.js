import React, { useState } from 'react';

export const Tabs = ({ children, defaultValue }) => {
  const [activeTab, setActiveTab] = useState(defaultValue);

  const tabChildren = React.Children.map(children, child => 
    React.cloneElement(child, { 
      activeTab, 
      onTabChange: setActiveTab 
    })
  );

  return <div>{tabChildren}</div>;
};

export const TabsList = ({ children, activeTab, onTabChange }) => {
  return (
    <div className="flex border-b mb-4">
      {React.Children.map(children, child => 
        React.cloneElement(child, { 
          activeTab, 
          onTabChange 
        })
      )}
    </div>
  );
};

export const TabsTrigger = ({ value, children, activeTab, onTabChange }) => {
  const isActive = activeTab === value;
  return (
    <button
      className={`
        px-4 py-2 
        ${isActive 
          ? 'border-b-2 border-blue-500 text-blue-600' 
          : 'text-gray-500 hover:text-gray-700'}
      `}
      onClick={() => onTabChange(value)}
    >
      {children}
    </button>
  );
};

export const TabsContent = ({ value, children, activeTab }) => {
  if (activeTab !== value) return null;

  return (
    <div className="p-4">
      {children}
    </div>
  );
};