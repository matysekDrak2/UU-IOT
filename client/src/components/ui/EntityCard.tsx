type Status = "active" | "inactive" | "unknown";

type Props = {
  title: string;
  subtitle?: string;
  status?: Status;
  metaLeft?: string;
  metaRight?: string;
  onClick?: () => void;
  actions?: React.ReactNode;
};

function statusLabel(status?: Status) {
  if (!status) return "";
  if (status === "active") return "Active";
  if (status === "inactive") return "Inactive";
  return "Unknown";
}

export default function EntityCard({
  title,
  subtitle,
  status,
  metaLeft,
  metaRight,
  onClick,
  actions,
}: Props) {
  return (
    <div
      className={`entity-card ${onClick ? "entity-card-clickable" : ""}`}
      onClick={onClick}
    >
      <div className="entity-card-top">
        <div className="entity-card-main">
          <div className="entity-card-title">{title}</div>
          {subtitle ? (
            <div className="entity-card-subtitle">{subtitle}</div>
          ) : null}
        </div>

        <div className="entity-card-right">
          {status ? (
            <span className={`badge badge-${status}`}>
              {statusLabel(status)}
            </span>
          ) : null}
          {actions ? (
            <div
              className="entity-card-actions"
              onClick={(e) => e.stopPropagation()}
            >
              {actions}
            </div>
          ) : null}
        </div>
      </div>

      {metaLeft || metaRight ? (
        <div className="entity-card-meta">
          <span className="entity-card-meta-left">{metaLeft ?? ""}</span>
          <span className="entity-card-meta-right">{metaRight ?? ""}</span>
        </div>
      ) : null}
    </div>
  );
}
