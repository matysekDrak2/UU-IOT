import { NavLink, useLocation } from "react-router-dom";
import styles from "./Sidebar.module.css";

type Tool = { key: string; label: string; path: string };

type SidebarProps = {
  readonly tools: Tool[];
};

export default function Sidebar({ tools }: SidebarProps) {
  const location = useLocation();

  return (
    <div className="sidebar">
      {tools.map((tool) => {
        const isSelected = location.pathname === tool.path;

        return (
          <NavLink
            key={tool.key}
            to={tool.path}
            className={[
              styles["sidebar-button"],
              isSelected ? styles["selected-sidebar-button"] : "",
            ].join(" ")}
          >
            {tool.label}
          </NavLink>
        );
      })}
    </div>
  );
}
