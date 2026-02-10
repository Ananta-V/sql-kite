'use client'

import { useState, useEffect, useCallback } from 'react'
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  ConnectionLineType,
  Panel,
  Position,
  Handle,
  MarkerType
} from 'reactflow'
import dagre from 'dagre'
import { getERDiagram } from '@/lib/api'
import { Loader, Key, Link2 } from 'lucide-react'
import { useAppContext } from '@/contexts/AppContext'
import 'reactflow/dist/style.css'

interface Column {
  name: string
  type: string
  pk: boolean
  notnull: boolean
  dflt_value: any
}

interface Table {
  name: string
  columns: Column[]
}

interface Relation {
  from: string
  to: string
  fromTable: string
  toTable: string
  fromColumn: string
  toColumn: string
  isInferred?: boolean
}

interface ERData {
  tables: Table[]
  relations: Relation[]
}

// Custom Table Node Component
function TableNode({ data }: { data: { label: string; columns: Column[]; foreignKeys: string[] } }) {
  return (
    <div className="bg-app-sidebar border-2 border-app-border rounded-lg shadow-lg min-w-[220px]">
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-transparent !border-0 !w-2 !h-2"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-transparent !border-0 !w-2 !h-2"
      />
      {/* Table Header */}
      <div className="px-3 py-2 bg-app-bg border-b border-app-border rounded-t-lg">
        <div className="font-semibold text-sm text-app-text">{data.label}</div>
      </div>

      {/* Columns */}
      <div className="py-1">
        {data.columns.map((col, idx) => {
          const isForeignKey = data.foreignKeys.includes(col.name)
          return (
            <div
              key={idx}
              className="px-3 py-1.5 hover:bg-app-bg/50 transition-colors text-xs font-mono flex items-center gap-2"
            >
              {col.pk ? (
                <Key className="w-3 h-3 text-yellow-400 flex-shrink-0" />
              ) : isForeignKey ? (
                <Link2 className="w-3 h-3 text-indigo-400 flex-shrink-0" />
              ) : (
                <div className="w-3" />
              )}
              <span className={col.pk ? 'text-app-text font-semibold' : isForeignKey ? 'text-indigo-400' : 'text-app-text-dim'}>
                {col.name}
              </span>
              <span className="text-app-text-dim/60 text-[10px] ml-auto">
                {col.type}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const nodeTypes = {
  tableNode: TableNode
}

// Layout algorithm using dagre
const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'LR') => {
  const dagreGraph = new dagre.graphlib.Graph()
  dagreGraph.setDefaultEdgeLabel(() => ({}))
  dagreGraph.setGraph({ rankdir: direction, ranksep: 100, nodesep: 80 })

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 220, height: node.data.columns.length * 28 + 50 })
  })

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target)
  })

  dagre.layout(dagreGraph)

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id)
    node.targetPosition = direction === 'LR' ? Position.Left : Position.Top
    node.sourcePosition = direction === 'LR' ? Position.Right : Position.Bottom

    node.position = {
      x: nodeWithPosition.x - 110,
      y: nodeWithPosition.y - (node.data.columns.length * 14 + 25)
    }

    return node
  })

  return { nodes, edges }
}

export default function ERDiagramPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const { projectInfo } = useAppContext()

  const loadERDiagram = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      const data: ERData = await getERDiagram()

      // Build a map of foreign key columns per table
      const foreignKeysMap: Record<string, string[]> = {}
      data.relations.forEach(rel => {
        if (!foreignKeysMap[rel.fromTable]) {
          foreignKeysMap[rel.fromTable] = []
        }
        foreignKeysMap[rel.fromTable].push(rel.fromColumn)
      })

      // Create nodes from tables
      const initialNodes: Node[] = data.tables.map((table) => ({
        id: table.name,
        type: 'tableNode',
        data: { 
          label: table.name, 
          columns: table.columns,
          foreignKeys: foreignKeysMap[table.name] || []
        },
        position: { x: 0, y: 0 } // Will be set by layout
      }))

      // Create edges from relations
      const initialEdges: Edge[] = data.relations.map((rel, idx) => ({
        id: `edge-${idx}`,
        source: rel.fromTable,
        target: rel.toTable,
        type: 'smoothstep',
        animated: false,
        style: {
          stroke: rel.isInferred ? '#94a3b8' : '#6366f1',
          strokeWidth: 2.5,
          strokeDasharray: rel.isInferred ? '6 6' : undefined
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: rel.isInferred ? '#94a3b8' : '#6366f1',
          width: 20,
          height: 20
        },
        label: `${rel.fromColumn} → ${rel.toColumn}`,
        labelStyle: {
          fontSize: 11,
          fill: rel.isInferred ? '#94a3b8' : '#e4e4e7',
          fontWeight: 500
        },
        labelBgStyle: { fill: '#18181b', fillOpacity: 0.9, rx: 4, ry: 4 }
      }))

      // Apply layout
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        initialNodes,
        initialEdges
      )

      setNodes(layoutedNodes)
      setEdges(layoutedEdges)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [setNodes, setEdges])

  useEffect(() => {
    loadERDiagram()
  }, [loadERDiagram, projectInfo?.currentBranch])

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-app-bg">
        <Loader className="w-6 h-6 animate-spin text-app-accent mb-3" />
        <p className="text-app-text-dim">Loading ER diagram...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-app-bg">
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded text-red-400 max-w-md">
          <p className="font-semibold mb-1">Failed to load ER diagram</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    )
  }

  if (nodes.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-app-bg text-app-text-dim">
        <Link2 className="w-12 h-12 mb-3 opacity-50" />
        <p className="text-lg">No tables yet</p>
        <p className="text-sm mt-1">Create tables to see the ER diagram</p>
      </div>
    )
  }

  return (
    <div className="h-full w-full bg-app-bg">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        connectionLineType={ConnectionLineType.SmoothStep}
        fitView
        attributionPosition="bottom-left"
        minZoom={0.1}
        maxZoom={1.5}
        defaultEdgeOptions={{
          type: ConnectionLineType.SmoothStep,
          animated: false
        }}
        nodesDraggable={true}
        nodesConnectable={false}
        elementsSelectable={true}
      >
        <Background color="#27272a" gap={16} size={1} />
        <Controls className="bg-app-sidebar border border-app-border rounded" />
        <MiniMap
          className="bg-app-sidebar border border-app-border rounded"
          nodeColor="#3f3f46"
          maskColor="rgba(0, 0, 0, 0.6)"
        />
        <Panel position="top-left" className="bg-app-sidebar border border-app-border rounded-lg px-4 py-2 shadow-lg">
          <div className="flex items-center gap-2 text-sm">
            <Link2 className="w-4 h-4 text-app-accent" />
            <span className="font-semibold text-app-text">Entity Relationship Diagram</span>
            {projectInfo?.currentBranch && (
              <>
                <span className="text-app-text-dim">•</span>
                <span className="text-app-text-dim">Branch: {projectInfo.currentBranch}</span>
              </>
            )}
            <span className="text-app-text-dim">•</span>
            <span className="text-app-text-dim">{nodes.length} table{nodes.length !== 1 ? 's' : ''}</span>
            <span className="text-app-text-dim">•</span>
            <span className="text-app-text-dim">{edges.length} relation{edges.length !== 1 ? 's' : ''}</span>
          </div>
          {edges.length === 0 && nodes.length > 0 && (
            <div className="mt-2 text-xs text-yellow-400/80">
              💡 No foreign key relations found. Add FOREIGN KEY constraints to see connections.
            </div>
          )}
          {edges.length > 0 && (
            <div className="mt-2 text-xs text-app-text-dim">
              Dashed links are inferred from primary key name matches.
            </div>
          )}
        </Panel>
      </ReactFlow>
    </div>
  )
}
