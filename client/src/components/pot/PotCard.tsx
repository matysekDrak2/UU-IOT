import EntityCard from "../ui/EntityCard";
import type { Pot } from "../../api/types";
import { formatRelativeTime } from "../../utils/format";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

type Props = {
  readonly pot: Pot;
  readonly onOpen?: (id: string) => void;
  readonly showNodeId?: boolean;
  readonly warningCount?: number;
};

export default function PotCard({ pot, onOpen, showNodeId, warningCount = 0 }: Props) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleClick = () => {
    navigate(`/pot/${pot.id}`);
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
          {pot.name ?? "My Pot"}
          {warningBadge}
        </>
      }
      subtitle={pot.note?.trim() ? pot.note : undefined}
      status={pot.status}
      metaLeft={pot.latestMeasurement
        ? `${pot.latestMeasurement.type}: ${pot.latestMeasurement.value}%`
        : t("POT.no_data")}
      metaRight={pot.latestMeasurement
        ? formatRelativeTime(pot.latestMeasurement.timestamp)
        : undefined}
      onClick={handleClick}
    />
  );
}
