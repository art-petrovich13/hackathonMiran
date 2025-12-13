import { Routes, Route } from 'react-router-dom';
import CameraApp from '../pages/MainCamera/Camera';
import Map from '../pages/MapPage/Map';
import WelcomePage from '../pages/WelcomePage/WelcomePage';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/camera" element={<CameraApp/>} />
      <Route path="/map" element={<Map/>} />
      <Route path="/welcome" element={<WelcomePage/>} />
    </Routes>
  );
}

