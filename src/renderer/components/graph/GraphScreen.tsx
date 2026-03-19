import { useEffect, useRef, useState } from "react";
import cytoscape from "cytoscape";
import { useNavigate } from "react-router-dom";
import type { GraphEdge, GraphNode } from "@shared/types/ipc";
import { waitForCalendarApi } from "@renderer/lib/calendarApi";
import { useGraphStore } from "@renderer/stores/useGraphStore";

type GraphData = { nodes: GraphNode[]; edges: GraphEdge[] };

const emptyGraphData: GraphData = { nodes: [], edges: [] };
const entityTypeLabels: Record<string, string> = {
  event: "일정",
  note: "메모",
  annotation: "주석",
  tag: "태그",
};

export function GraphScreen(): JSX.Element {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const graphFilters = useGraphStore((state) => state.graphFilters);
  const selectedNodeId = useGraphStore((state) => state.selectedNodeId);
  const patchFilters = useGraphStore((state) => state.patchFilters);
  const setSelectedNodeId = useGraphStore((state) => state.setSelectedNodeId);

  const [graphData, setGraphData] = useState<GraphData>(emptyGraphData);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("관계도는 일정, 메모, 태그 사이의 연결을 보여줍니다.");
  const [canvasError, setCanvasError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;

    const loadGraph = async () => {
      try {
        setLoading(true);
        setCanvasError(null);
        const calendarApi = await waitForCalendarApi();
        const nextData = await calendarApi.graph.get(graphFilters);
        if (!active) {
          return;
        }

        setGraphData(nextData);
        setMessage(
          nextData.nodes.length > 0
            ? "노드를 클릭하면 오른쪽에서 자세한 정보를 볼 수 있습니다."
            : "아직 연결된 일정이나 메모가 없습니다. 먼저 일정이나 메모를 만든 뒤 연결이 쌓이면 여기서 확인할 수 있습니다.",
        );
      } catch (error) {
        if (!active) {
          return;
        }

        setGraphData(emptyGraphData);
        setCanvasError(error instanceof Error ? error.message : "관계도를 불러오지 못했습니다.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadGraph();

    return () => {
      active = false;
    };
  }, [graphFilters, reloadToken]);

  useEffect(() => {
    if (!selectedNodeId) {
      return;
    }

    const exists = graphData.nodes.some((item) => item.id === selectedNodeId);
    if (!exists) {
      setSelectedNodeId(null);
    }
  }, [graphData.nodes, selectedNodeId, setSelectedNodeId]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    if (canvasError || graphData.nodes.length === 0) {
      containerRef.current.innerHTML = "";
      return;
    }

    let cy: cytoscape.Core | null = null;

    try {
      cy = cytoscape({
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
    } catch (error) {
      setCanvasError(error instanceof Error ? error.message : "그래프 캔버스를 준비하지 못했습니다.");
    }

    return () => {
      cy?.destroy();
    };
  }, [canvasError, graphData, setSelectedNodeId]);

  const selectedNode = graphData.nodes.find((item) => item.id === selectedNodeId) ?? null;
  const hasNodes = graphData.nodes.length > 0;

  return (
    <section className="screen grid-2">
      <div className="panel stack">
        <div className="section-title">
          <strong>관계도</strong>
          <span className="badge">
            {graphData.nodes.length}개 노드 / {graphData.edges.length}개 연결
          </span>
        </div>
        <p className="muted">{message}</p>
        <div className="toolbar-group">
          <input
            className="field"
            placeholder="일정/메모/태그 이름으로 찾기"
            value={graphFilters.query}
            onChange={(event) => patchFilters({ query: event.target.value })}
          />
          <label className="badge">
            <input type="checkbox" checked={graphFilters.showEvents} onChange={(event) => patchFilters({ showEvents: event.target.checked })} />
            일정
          </label>
          <label className="badge">
            <input type="checkbox" checked={graphFilters.showNotes} onChange={(event) => patchFilters({ showNotes: event.target.checked })} />
            메모
          </label>
          <label className="badge">
            <input
              type="checkbox"
              checked={graphFilters.showAnnotations}
              onChange={(event) => patchFilters({ showAnnotations: event.target.checked })}
            />
            주석
          </label>
          <label className="badge">
            <input type="checkbox" checked={graphFilters.showTags} onChange={(event) => patchFilters({ showTags: event.target.checked })} />
            태그
          </label>
        </div>

        {loading ? (
          <div className="empty-state">
            <strong>관계도를 불러오는 중입니다.</strong>
            <p className="muted">일정, 메모, 태그를 모아서 연결 지도를 만들고 있습니다.</p>
          </div>
        ) : canvasError ? (
          <div className="empty-state">
            <strong>관계도를 열지 못했습니다.</strong>
            <p className="muted">{canvasError}</p>
            <div className="quick-actions">
              <button className="button" onClick={() => patchFilters({ query: "" })}>
                검색 초기화
              </button>
              <button className="button secondary" onClick={() => setReloadToken((value) => value + 1)}>
                다시 시도
              </button>
            </div>
          </div>
        ) : !hasNodes ? (
          <div className="empty-state">
            <strong>아직 표시할 연결이 없습니다.</strong>
            <p className="muted">먼저 일정이나 메모를 만들고, 태그나 링크가 생기면 이 화면이 채워집니다.</p>
            <div className="quick-actions">
              <button className="button primary" onClick={() => navigate("/calendar")}>
                일정 만들기
              </button>
              <button className="button" onClick={() => navigate("/notes")}>
                메모 만들기
              </button>
              <button className="button" onClick={() => navigate("/functions")}>
                함수 보기
              </button>
              <button className="button secondary" onClick={() => navigate("/settings")}>
                설정 열기
              </button>
            </div>
          </div>
        ) : (
          <div ref={containerRef} style={{ minHeight: 620, borderRadius: 18, overflow: "hidden" }} />
        )}
      </div>

      <div className="panel stack">
        <div className="section-title">
          <strong>선택한 항목</strong>
          <span className="badge">{selectedNode ? entityTypeLabels[selectedNode.entityType] ?? selectedNode.entityType : "없음"}</span>
        </div>
        {selectedNode ? (
          <>
            <strong>{selectedNode.label}</strong>
            <div className="muted">{selectedNode.id}</div>
            <p className="muted">원본 화면으로 이동해서 내용을 바로 수정할 수 있습니다.</p>
            <button
              className="button"
              onClick={() => {
                if (selectedNode.id.startsWith("note:")) {
                  navigate("/notes");
                  return;
                }

                if (selectedNode.id.startsWith("event:")) {
                  navigate("/calendar");
                }
              }}
            >
              원본 화면으로 이동
            </button>
          </>
        ) : (
          <div className="empty-state compact">
            <strong>아직 선택한 항목이 없습니다.</strong>
            <p className="muted">왼쪽 관계도에서 노드를 클릭하면 이곳에 설명이 나타납니다.</p>
          </div>
        )}
      </div>
    </section>
  );
}
