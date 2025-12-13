import { Routes, Route } from 'react-router-dom';
import CameraApp from '../pages/MainCamera/Camera';
import WelcomePage from '../pages/WelcomePage/WelcomePage';


export default function AppRoutes() {
  return (
    <Routes>

      <Route path="welcome" element={<WelcomePage/>} />
      <Route path="/camera" element={<CameraApp/>} />
      
    </Routes>
  );
}

