import "./App.css";
import { useState } from "react";
import Sidebar from "./components/ui/sidebar/Sidebar";
import SGLogo from "./assets/icons/smart-garden.svg?react";

const tools = [
  { label: "Profile", key: "profile" },
  { label: "Nodes", key: "nodes" },
  { label: "Settings", key: "settings" },
];

function App() {
  const [selectedTool, setSelectedTool] = useState("nodes");

  const handleToolSelect = (toolKey: string) => {
    setSelectedTool(toolKey);
  };
  return (
    <div>
      <div></div>
      <Sidebar
        tools={tools}
        selected={selectedTool}
        onSelect={handleToolSelect}
      />
      <footer className="footer-box">
        <span className="footer-copyright">
          © 2025 Tým 4 & Unicorn University
        </span>
        <SGLogo className="icon" />
      </footer>
    </div>
  );
}

export default App;
