import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { IOSFrame } from "./components/IOSFrame";
import { DemoIndex } from "./screens/DemoIndex";
import { Phase3Home } from "./screens/Phase3Home";
import { Phase3Wallet } from "./screens/Phase3Wallet";
import { Phase3Map } from "./screens/Phase3Map";
import { Phase2Onboarding } from "./screens/Phase2Onboarding";
import { Phase2PreBook } from "./screens/Phase2PreBook";
import { Phase1Landing } from "./screens/Phase1Landing";
import { Phase1ExternalSite } from "./screens/Phase1ExternalSite";
import { Phase4TripSummary } from "./screens/Phase4TripSummary";
import { Phase4Memory } from "./screens/Phase4Memory";
import { Phase4ComeBack } from "./screens/Phase4ComeBack";
import { TakeControlHome } from "./screens/TakeControlHome";
import { Walkthrough } from "./screens/Walkthrough";
import { Phase3Trip } from "./screens/Phase3Trip";
import { Landing } from "./screens/Landing";
import { Phase3PayGlass as Phase3Pay } from "./screens/glass/Phase3PayGlass";
import { Phase2EstimatedQCashGlass as Phase2EstimatedQCash } from "./screens/glass/Phase2EstimatedQCashGlass";

/** True when this app is rendered inside an iframe (e.g. the walkthrough).
 *  In embed mode we drop the iOS bezel + dev chrome so each iframe is just
 *  the screen content, sized to the iframe viewport. */
const isEmbedded =
  typeof window !== "undefined" && window.self !== window.top;

function MobileRoute({ children }: { children: React.ReactNode }) {
  if (isEmbedded) {
    return (
      <div style={{ width: "100vw", height: "100vh", overflow: "hidden", background: "var(--q-paper)" }}>
        {children}
      </div>
    );
  }
  return (
    <IOSFrame>
      {children}
      <BackToIndex />
    </IOSFrame>
  );
}

function DesktopRoute({ children }: { children: React.ReactNode }) {
  if (isEmbedded) {
    return <div style={{ width: "100vw", height: "100vh", overflow: "hidden" }}>{children}</div>;
  }
  return (
    <div style={{ minHeight: "100vh", background: "var(--gx-app-bg)", padding: 20, display: "flex", justifyContent: "center" }}>
      <div style={{ width: 1100, maxWidth: "100%", height: 720, borderRadius: 14, overflow: "hidden", boxShadow: "0 30px 80px rgba(0,0,0,0.55)" }}>
        {children}
      </div>
      <BackToIndex />
    </div>
  );
}

function BackToIndex() {
  return (
    <Link
      to="/"
      style={{
        position: "fixed",
        top: 20,
        left: 20,
        padding: "8px 14px",
        background: "var(--gx-surface)",
        color: "var(--gx-text-1)",
        borderRadius: 999,
        fontSize: 12,
        textDecoration: "none",
        fontFamily: "'JetBrains Mono', monospace",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        border: "1px solid var(--gx-border)",
        boxShadow: "inset 0 1px 0 var(--gx-highlight)",
        zIndex: 200,
      }}
    >
      ← All screens
    </Link>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DemoIndex />} />
        <Route path="/walkthrough" element={<Walkthrough />} />
        <Route path="/landing" element={<Landing />} />

        {/* Mobile screens */}
        <Route path="/p3/trip" element={<MobileRoute><Phase3Trip /></MobileRoute>} />
        <Route path="/p3/home" element={<MobileRoute><Phase3Home /></MobileRoute>} />
        <Route path="/p3/wallet" element={<MobileRoute><Phase3Wallet /></MobileRoute>} />
        <Route path="/p3/pay" element={<MobileRoute><Phase3Pay /></MobileRoute>} />
        <Route path="/p3/map" element={<MobileRoute><Phase3Map /></MobileRoute>} />

        <Route path="/p2/onboarding" element={<MobileRoute><Phase2Onboarding /></MobileRoute>} />
        <Route path="/p2/home" element={<MobileRoute><Phase2EstimatedQCash /></MobileRoute>} />
        <Route path="/p2/prebook" element={<MobileRoute><Phase2PreBook /></MobileRoute>} />

        <Route path="/p4/summary" element={<MobileRoute><Phase4TripSummary /></MobileRoute>} />
        <Route path="/p4/memory" element={<MobileRoute><Phase4Memory /></MobileRoute>} />
        <Route path="/p4/comeback" element={<MobileRoute><Phase4ComeBack /></MobileRoute>} />

        <Route path="/takecontrol" element={<MobileRoute><TakeControlHome /></MobileRoute>} />

        {/* Desktop screens */}
        <Route path="/p1/landing" element={<DesktopRoute><Phase1Landing /></DesktopRoute>} />
        <Route path="/p1/checkout" element={<DesktopRoute><Phase1ExternalSite /></DesktopRoute>} />
      </Routes>
    </BrowserRouter>
  );
}
