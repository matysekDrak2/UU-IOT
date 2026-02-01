import React, { useEffect, useState } from "react";
import { listNodes } from "../../api/enpoints/node";
import type { Node } from "../../api/types";
import NodeCard from "../node/NodeCard";
import NodeDetailPage from "../node/NodeDetail";

function normalizeNodes(data: unknown): Node[] {
  return Array.isArray(data) ? (data as Node[]) : [];
}

export default function NodesPage() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const data = await listNodes();
      setNodes(normalizeNodes(data));
    } catch (e: any) {
      setNodes([]);
      setError(e?.message ?? "Failed to load nodes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await listNodes();
        if (!cancelled) setNodes(normalizeNodes(data));
      } catch (e: any) {
        if (!cancelled) {
          setNodes([]);
          setError(e?.message ?? "Failed to load nodes");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (selectedNodeId) {
    // NOTE: your NodeDetailPage currently doesn't receive nodeId, so it likely uses useParams().
    // If you want to open details from list without routing, you should pass nodeId similarly to PotDetail.
    return <NodeDetailPage onBack={() => setSelectedNodeId(null)} />;
  }

  let content: React.ReactNode;

  if (loading && nodes.length === 0) {
    content = <p>Loading…</p>;
  } else if (nodes.length === 0) {
    content = (
      <div id="no_nodes" className="card">
        <h2 className="card-title">No nodes</h2>
        <p style={{ margin: 0, opacity: 0.7 }}>
          You don't have any devices yet.
        </p>
      </div>
    );
  } else {
    content = (
      <div className="list" id="nodes_list">
        {nodes.map((node) => (
          <NodeCard
            key={node.id}
            node={node}
            // If NodeCard supports opening:
            // onOpen={() => setSelectedNodeId(node.id)}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="page" id="nodes_page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Nodes</h1>
          <p className="page-subtitle">Your devices</p>
        </div>

        <button
          className="btn btn-secondary"
          onClick={load}
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="alert alert-error">
          <div className="alert-title">Error</div>
          <div>{error}</div>
        </div>
      )}

      {content}
    </div>
  );
}
