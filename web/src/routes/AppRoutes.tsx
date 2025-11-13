import { Routes, Route } from 'react-router-dom';
import Breakdowns from '../pages/Breakdowns/Breakdowns';
import CameraApp from '../pages/MainCamera/Camera';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<CameraApp/>} />
      <Route path="/camera" element={<CameraApp/>} />
      <Route path="/settings" />
      <Route path="/breakdowns" element={<Breakdowns/>} />
    </Routes>
  );
}

