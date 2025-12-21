import ProfilePage from "./ProfilePage";
import NodesPage from "./NodesPage";
import PotsPage from "./PotsPage";

interface Props {
  readonly selectedTool: string;
}

export default function DynamicPageForm({ selectedTool }: Props) {
  switch (selectedTool) {
    case "profile":
      return <ProfilePage />;
    case "nodes":
      return <NodesPage />;
    case "pots":
      return <PotsPage />;
    default:
      return <PotsPage />;
  }
}
