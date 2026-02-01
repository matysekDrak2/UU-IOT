import React, { useEffect, useId, useMemo, useState } from "react";
import type { Node, Pot, PotWarning } from "../../api/types";
import { listNodes, listNodeWarnings } from "../../api/enpoints/node";
import { listPotsByNode } from "../../api/enpoints/pot";
import PotDetail from "../pot/PotDetail";
import PotCreateDialog from "../pot/PotCreateDialog";
import PotCard from "../pot/PotCard";

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export default function PotsPage() {
  const nodeSelectId = useId();
  const searchInputId = useId();

  const [nodes, setNodes] = useState<Node[]>([]);
  const [pots, setPots] = useState<Pot[]>([]);
  const [warnings, setWarnings] = useState<PotWarning[]>([]);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedPotId, setSelectedPotId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [loadingNodes, setLoadingNodes] = useState(true);
  const [loadingPots, setLoadingPots] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);

  // Calculate warning counts per pot
  const warningCountByPot = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const warning of warnings) {
      counts[warning.potId] = (counts[warning.potId] || 0) + 1;
    }
    return counts;
  }, [warnings]);

  useEffect(() => {
    let cancelled = false;

    async function loadNodes() {
      setLoadingNodes(true);
      setError(null);

      try {
        const data = await listNodes();
        const list = safeArray<Node>(data);

        if (!cancelled) {
          setNodes(list);

          if (list.length > 0 && selectedNodeId === null) {
            setSelectedNodeId(list[0].id);
          }
        }
      } catch (e: any) {
        if (!cancelled) {
          setNodes([]);
          setError(e?.message ?? "Failed to load nodes");
        }
      } finally {
        if (!cancelled) {
          setLoadingNodes(false);
        }
      }
    }

    void loadNodes();

    return () => {
      cancelled = true;
    };
  }, [selectedNodeId]);

  useEffect(() => {
    if (selectedNodeId === null) {
      setPots([]);
      setWarnings([]);
      return;
    }

    let cancelled = false;

    async function loadPots(nodeId: string) {
      setLoadingPots(true);
      setError(null);

      try {
        const [potsData, warningsData] = await Promise.all([
          listPotsByNode(nodeId),
          listNodeWarnings(nodeId)
        ]);
        if (!cancelled) {
          setPots(safeArray<Pot>(potsData));
          setWarnings(warningsData);
        }
      } catch (e: any) {
        if (!cancelled) {
          setPots([]);
          setWarnings([]);
          setError(e?.message ?? "Failed to load pots");
        }
      } finally {
        if (!cancelled) {
          setLoadingPots(false);
        }
      }
    }

    void loadPots(selectedNodeId);

    return () => {
      cancelled = true;
    };
  }, [selectedNodeId]);

  const filteredPots = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (query.length === 0) return pots;

    return pots.filter((p) => (p.name ?? "").toLowerCase().includes(query));
  }, [pots, search]);

  async function handleCreatePot(payload: { name: string; note?: string }) {
    const newPot: Pot = {
      id: crypto.randomUUID(),
      nodeId: selectedNodeId as string,
      name: payload.name,
      note: payload.note ?? "",
      status: "unknown",
    };

    setPots((prev) => [newPot, ...prev]);
  }

  if (selectedPotId !== null) {
    return (
      <PotDetail potId={selectedPotId} onBack={() => setSelectedPotId(null)} />
    );
  }

  let content: React.ReactNode;

  if (selectedNodeId === null) {
    content = (
      <div className="card">
        <h2 className="card-title">Select a node</h2>
      </div>
    );
  } else if (loadingPots && pots.length === 0) {
    content = <p>Loading…</p>;
  } else if (filteredPots.length === 0) {
    content = (
      <div className="card" id="no_pots">
        <h2 className="card-title">No pots</h2>
        <p style={{ margin: 0, opacity: 0.7 }}>
          {search.length > 0
            ? "No pots match your search."
            : "This node has no pots yet."}
        </p>
      </div>
    );
  } else {
    content = (
      <div className="list" id="pots_list">
        {filteredPots.map((pot) => (
          <PotCard
            key={pot.id}
            pot={pot}
            onOpen={setSelectedPotId}
            showNodeId={false}
            warningCount={warningCountByPot[pot.id] || 0}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="page" id="pots_page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Pots</h1>
          <p className="page-subtitle">Pots under selected node</p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setCreateOpen(true)}
          >
            Create pot
          </button>
        </div>
      </div>

      {error !== null && (
        <div className="alert alert-error">
          <div className="alert-title">Error</div>
          <div>{error}</div>
        </div>
      )}

      <div className="card" id="pots_card_action">
        <div className="field">
          <label htmlFor={nodeSelectId} className="field-label">
            Node:
          </label>
          <select
            id={nodeSelectId}
            className="select"
            value={selectedNodeId ?? ""}
            onChange={(e) => setSelectedNodeId(e.target.value || null)}
            disabled={loadingNodes}
          >
            {nodes.length === 0 && <option value="">No nodes</option>}
            {nodes.map((node) => (
              <option key={node.id} value={node.id}>
                {node.name ?? "My Node"}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor={searchInputId} className="field-label">
            Search:
          </label>
          <input
            id={searchInputId}
            className="input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by pot name"
          />
        </div>
      </div>

      {content}

      <PotCreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreatePot}
      />
    </div>
  );
}
