import { useEffect, useMemo, useState } from "react";
import { getNode } from "../../api/enpoints/node";
import { listPotsByNode } from "../../api/enpoints/pot";
import type { Node, Pot } from "../../api/types";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";

type Props = {
  readonly onBack?: () => void;
};

export default function NodeDetail({ onBack }: Props) {
  const { nodeId: nodeIdParam } = useParams<{ nodeId?: string }>();
  if (!nodeIdParam) return <div>Node not found</div>;
  const nodeId = nodeIdParam;
  if (!nodeId) return <div>Node not found</div>;
  const { t } = useTranslation();
  const [node, setNode] = useState<Node | null>(null);
  const [pots, setPots] = useState<Pot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const potCount = useMemo(() => pots.length, [pots]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);

      try {
        const [nodeData, potsData] = await Promise.all([
          getNode(nodeId),
          listPotsByNode(nodeId),
        ]);

        if (!cancelled) {
          setNode(nodeData);
          setPots(potsData);
        }
      } catch (e: any) {
        if (!cancelled)
          setError(e?.message ?? t("NOTIFICATION.failed_load_node_det"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [nodeId, t]);

  async function copyNodeId() {
    try {
      await navigator.clipboard.writeText(nodeId);
      setCopied(true);
      setTimeout(() => setCopied(false), 900);
    } catch {
      // ignore
    }
  }

  if (loading) return <p>Loading…</p>;

  if (error || !node)
    return (
      <div className="alert alert-error">
        {error ?? t("NOTIFICATION.not_found", { field: "Node" })}
      </div>
    );

  return (
    <div className="page" id="detail_node">
      <div className="page-header">
        <h1 className="page-title">{node.name ?? "My Node"}</h1>
        <p className="page-subtitle">
          Status: {node.status} • Pots: {potCount}
        </p>
        {onBack && (
          <button className="btn btn-secondary" onClick={onBack}>
            Back
          </button>
        )}
      </div>

      <div className="card">
        <h2 className="card-title">{t("NODE.device_info")}</h2>
        <div>ID: {node.id}</div>
        <button onClick={copyNodeId}>{copied ? "Copied" : "Copy"}</button>
        <div>Status: {node.status}</div>
        <div>Data archiving: {node.dataArchiving}</div>
        <div>Note: {node.note ?? "—"}</div>
      </div>

      <div className="card">
        <h2 className="card-title">Pots under this node:</h2>
        {pots.length === 0 ? (
          <p>No pots yet.</p>
        ) : (
          <ul>
            {pots.map((p) => (
              <li key={p.id}>
                {p.name ?? "My Pot"} — {p.note ?? "—"} — {p.status}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
