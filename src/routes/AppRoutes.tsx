import { Routes, Route } from 'react-router-dom';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" />
      <Route path="/profile"  />
      <Route path="/settings" />
    </Routes>
  );
}
