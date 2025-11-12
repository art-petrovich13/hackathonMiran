import { Routes, Route } from 'react-router-dom';
import Breakdowns from '../pages/Breakdowns/Breakdowns';
import App from '../App';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" />
      <Route path="/profile"  />
      <Route path="/settings" />
      <Route path="/breakdowns" element={<Breakdowns/>} />
    </Routes>
  );
}

