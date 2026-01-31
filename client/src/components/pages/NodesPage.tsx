import React, { useEffect, useState } from "react";
import { listNodes, createNode } from "../../api/enpoints/node";
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

  async function handleAddNode() {
    const name = window.prompt("Node name (min 3 chars):", "SmartGarden");
    if (!name) return;
  
    setLoading(true);
    setError(null);
  
    try {
      await createNode({ name }); // NodeCreate má minimálně name
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Failed to create node");
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
          You don’t have any devices yet.
        </p>
      </div>
    );
  } else {
    content = (
      <div className="list" id="nodes_list">
        {nodes.map((node) => (
          <NodeCard key={node.id} node={node} />
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

        <div style={{ display: "flex", gap: 10 }}>
          <button
            className="btn btn-secondary"
            onClick={load}
            disabled={loading}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>

          <button className="btn btn-secondary" onClick={handleAddNode} disabled={loading}>
            Add new node
          </button>

        </div>
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
