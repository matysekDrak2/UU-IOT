import "./App.css";
import { useState } from "react";
import Sidebar from "./components/ui/sidebar/Sidebar";
import SGLogo from "./assets/icons/smart-garden.svg?react";

const tools = [
  { label: "Profile", key: "profile" },
  { label: "Nodes", key: "nodes" },
  { label: "Pots", key: "pots" },
  { label: "Settings", key: "settings" },
];

function App() {
  const [selectedTool, setSelectedTool] = useState("pots");

  const handleToolSelect = (toolKey: string) => {
    setSelectedTool(toolKey);
  };
  return (
    <div id="main-container" className="main-container">
      <div className="header-container">
        <SGLogo className="header-logo" />
        <Sidebar
          tools={tools}
          selected={selectedTool}
          onSelect={handleToolSelect}
        />
      </div>
      <div id="content-container" className="content-container">
        <div id="content-box" className="content-box"></div>
        <footer className="footer-box">
          <span className="footer-copyright">
            © 2025 Tým 4 & Unicorn University
          </span>
          <SGLogo className="icon" />
        </footer>
      </div>
    </div>
  );
}

export default App;
