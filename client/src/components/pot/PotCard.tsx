import EntityCard from "../ui/EntityCard";
import type { Pot } from "../../api/types";
import { shortId } from "../../utils/format";
import { useNavigate } from "react-router-dom";

type Props = {
  readonly pot: Pot;
  readonly onOpen?: (id: string) => void;
  readonly showNodeId?: boolean;
};

export default function PotCard({ pot, onOpen, showNodeId }: Props) {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/pot/${pot.id}`);
  };
  return (
    <EntityCard
      title={pot.name ?? "My Pot"}
      subtitle={pot.note?.trim() ? pot.note : undefined}
      status={pot.status}
      metaLeft={`ID: ${shortId(pot.id)}`}
      metaRight={showNodeId ? `Node: ${shortId(pot.nodeId)}` : undefined}
      onClick={handleClick}
    />
  );
}
