import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import EntityCard from "../ui/EntityCard";
import type { Node } from "../../api/types";
import { formatDuration } from "../../utils/format";

type Props = {
  readonly node: Node;
  readonly warningCount?: number;
};

export default function NodeCard({ node, warningCount = 0 }: Props) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleClick = () => {
    navigate(`/nodes/${node.id}`);
  };

  const warningBadge = warningCount > 0 ? (
    <span style={{
      background: "#f59e0b",
      color: "#000",
      padding: "2px 6px",
      borderRadius: 10,
      fontSize: 11,
      fontWeight: "bold",
      marginLeft: 8
    }}>
      {warningCount}
    </span>
  ) : null;

  return (
    <EntityCard
      title={
        <>
          {node.name ?? "My Node"}
          {warningBadge}
        </>
      }
      subtitle={node.note?.trim() ? node.note : undefined}
      status={node.status}
      metaLeft={node.potCount !== undefined
        ? `${node.potCount} ${node.potCount === 1 ? t("NODE.pot") : t("NODE.pots")}`
        : undefined}
      metaRight={
        node.dataArchiving
          ? `Archive: ${formatDuration(node.dataArchiving)}`
          : undefined
      }
      onClick={handleClick}
    />
  );
}
