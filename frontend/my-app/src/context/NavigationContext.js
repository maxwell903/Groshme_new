
import React, { createContext, useContext, useState } from 'react';

const NavigationContext = createContext();

export function NavigationProvider({ children }) {
  const [previousPath, setPreviousPath] = useState('/');

  const updatePreviousPath = (path) => {
    setPreviousPath(path);
  };

  return (
    <NavigationContext.Provider value={{ previousPath, updatePreviousPath }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
}
