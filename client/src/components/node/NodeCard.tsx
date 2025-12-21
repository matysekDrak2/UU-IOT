import { useNavigate } from "react-router-dom";
import EntityCard from "../ui/EntityCard";
import type { Node } from "../../api/types";
import { formatDuration, shortId } from "../../utils/format";

type Props = {
  readonly node: Node;
};

export default function NodeCard({ node }: Props) {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/nodes/${node.id}`);
  };

  return (
    <EntityCard
      title={node.name ?? "My Node"}
      subtitle={node.note?.trim() ? node.note : undefined}
      status={node.status}
      metaLeft={`ID: ${shortId(node.id)}`}
      metaRight={
        node.dataArchiving
          ? `Archive: ${formatDuration(node.dataArchiving)}`
          : undefined
      }
      onClick={handleClick}
    />
  );
}
