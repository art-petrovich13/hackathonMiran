import React from 'react';
import { Routes, Route } from 'react-router-dom';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/" />
      
      <Route path="*" />
    </Routes>
  );
};