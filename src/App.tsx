import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ControlDashboard } from "./control/ControlDashboard";
import { EquityConsole } from "./equity/EquityConsole";
import { IpadControl } from "./ipad/IpadControl";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ControlDashboard />} />
        <Route path="/equity" element={<EquityConsole />} />
        {/* iPad lever console (add-to-home-screen PWA) — mirrors to the web view. */}
        <Route path="/ipad" element={<IpadControl />} />
        {/* Old tourist-demo paths redirect home so bookmarks don't 404. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
