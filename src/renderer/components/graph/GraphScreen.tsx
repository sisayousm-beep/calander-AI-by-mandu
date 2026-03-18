import { useEffect, useRef, useState } from "react";
import cytoscape from "cytoscape";
import { useNavigate } from "react-router-dom";
import type { GraphEdge, GraphNode } from "@shared/types/ipc";
import { useGraphStore } from "@renderer/stores/useGraphStore";

export function GraphScreen(): JSX.Element {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { graphFilters, selectedNodeId, patchFilters, setSelectedNodeId } = useGraphStore();
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] }>({ nodes: [], edges: [] });

  useEffect(() => {
    void window.calendarApi.graph.get(graphFilters).then(setGraphData);
  }, [graphFilters]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements: [
        ...graphData.nodes.map((node) => ({ data: { id: node.id, label: node.label, color: node.color } })),
        ...graphData.edges.map((edge) => ({ data: { id: edge.id, source: edge.source, target: edge.target, label: edge.label } })),
      ],
      style: [
        {
          selector: "node",
          style: {
            label: "data(label)",
            "background-color": "data(color)",
            color: "#e5eefb",
            "font-size": "11px",
            "text-wrap": "wrap",
            "text-max-width": "120px",
          },
        },
        {
          selector: "edge",
          style: {
            width: 2,
            "line-color": "#64748b",
            "target-arrow-color": "#64748b",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            label: "data(label)",
            "font-size": "10px",
            color: "#94a3b8",
          },
        },
      ],
      layout: {
        name: "cose",
        animate: false,
        padding: 24,
      },
    });

    cy.on("tap", "node", (event) => {
      setSelectedNodeId(event.target.id());
    });

    return () => {
      cy.destroy();
    };
  }, [graphData, setSelectedNodeId]);

  const selectedNode = graphData.nodes.find((item) => item.id === selectedNodeId) ?? null;

  return (
    <section className="screen grid-2">
      <div className="panel stack">
        <div className="section-title">
          <strong>그래프 캔버스</strong>
          <span className="badge">{graphData.nodes.length} nodes</span>
        </div>
        <div className="toolbar-group">
          <input
            className="field"
            placeholder="그래프 검색"
            value={graphFilters.query}
            onChange={(event) => patchFilters({ query: event.target.value })}
          />
          <label className="badge">
            <input type="checkbox" checked={graphFilters.showEvents} onChange={(event) => patchFilters({ showEvents: event.target.checked })} />
            events
          </label>
          <label className="badge">
            <input type="checkbox" checked={graphFilters.showNotes} onChange={(event) => patchFilters({ showNotes: event.target.checked })} />
            notes
          </label>
          <label className="badge">
            <input type="checkbox" checked={graphFilters.showAnnotations} onChange={(event) => patchFilters({ showAnnotations: event.target.checked })} />
            annotations
          </label>
          <label className="badge">
            <input type="checkbox" checked={graphFilters.showTags} onChange={(event) => patchFilters({ showTags: event.target.checked })} />
            tags
          </label>
        </div>
        <div ref={containerRef} style={{ minHeight: 620, borderRadius: 18, overflow: "hidden" }} />
      </div>

      <div className="panel stack">
        <div className="section-title">
          <strong>선택 노드</strong>
          <span className="badge">{selectedNode?.entityType ?? "none"}</span>
        </div>
        {selectedNode ? (
          <>
            <strong>{selectedNode.label}</strong>
            <div className="muted">{selectedNode.id}</div>
            <button
              className="button"
              onClick={() => {
                if (selectedNode.id.startsWith("note:")) {
                  navigate("/notes");
                } else if (selectedNode.id.startsWith("event:")) {
                  navigate("/calendar");
                }
              }}
            >
              원본 화면으로 이동
            </button>
          </>
        ) : (
          <p className="muted">노드를 클릭하면 상세 정보가 표시됩니다.</p>
        )}
      </div>
    </section>
  );
}
