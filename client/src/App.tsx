import "./App.css";
import Sidebar from "./components/ui/sidebar/Sidebar";
import SGLogo from "./assets/icons/smart-garden.svg?react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import ProfilePage from "./components/pages/ProfilePage";
import NodesPage from "./components/pages/NodesPage";
import NodeDetail from "./components/node/NodeDetail";
import PotsPage from "./components/pages/PotsPage";
import PotDetail from "./components/pot/PotDetail";

const tools = [
  { key: "profile", label: "Profile", path: "/profile" },
  { key: "nodes", label: "Nodes", path: "/nodes" },
  { key: "pots", label: "Pots", path: "/pots" },
];

function App() {
  return (
    <BrowserRouter>
      <div id="main-container" className="main-container">
        <div className="header-container">
          <SGLogo className="header-logo" />
          <Sidebar tools={tools} />
        </div>

        <div
          id="content-container"
          className="content-container scrollable-hidden-scrollbar"
        >
          <div className="content-box">
            <Routes>
              <Route path="/" element={<Navigate to="/pots" replace />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/nodes" element={<NodesPage />} />
              <Route path="/nodes/:nodeId" element={<NodeDetail />} />
              <Route path="/pots" element={<PotsPage />} />
              <Route path="/pot/:potId" element={<PotDetail />} />
            </Routes>
          </div>
          <footer className="footer-box">
            <span className="footer-copyright">
              © 2025 Tým 4 & Unicorn University
            </span>
            <SGLogo className="icon" />
          </footer>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
