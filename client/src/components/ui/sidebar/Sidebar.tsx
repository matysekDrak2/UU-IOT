import styles from "./Sidebar.module.css";

type Tool = { key: string; label: string };

type SidebarProps = {
  readonly tools: Tool[];
  readonly selected: string;
  readonly onSelect: (key: string) => void;
};

function Sidebar({ tools, selected, onSelect }: SidebarProps) {
  return (
    <div className="sidebar">
      {tools.map((tool) => (
        <button
          key={tool.key}
          className={[
            styles["sidebar-button"],
            selected === tool.key ? styles["selected-sidebar-button"] : "",
          ].join(" ")}
          onClick={() => onSelect(tool.key)}
        >
          {tool.label}
        </button>
      ))}
    </div>
  );
}

export default Sidebar;
