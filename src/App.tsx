import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ControlDashboard } from "./control/ControlDashboard";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ControlDashboard />} />
        {/* Old tourist-demo paths redirect home so bookmarks don't 404. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
