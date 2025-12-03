import { useState, useCallback, useEffect } from "react";
import { 
    applyNodeChanges, 
    applyEdgeChanges, 
    addEdge,
    useNodesState,
    useEdgesState
 } from "@xyflow/react";

export default function usePipeline() {
  
  const [nodes, setNodes, handleNodesChange] = useNodesState([]);
  const [edges, setEdges, handleEdgesChange] = useEdgesState([]);

  const handleConnect = useCallback((connection) => {
    setEdges((eds) => addEdge(connection, eds));
    //console.log(`connection: ${connection.source} to ${connection.target}`);
  }, []);

  const addNode = useCallback((node, position) => {
    setNodes((nds) => [
      ...nds,
      {
        id: node.id,
        type: node.type,
        position: {
          x: position.x ?? 0,
          y: position.y ?? 0,
        },
        data: { 
            label: node.id,
            config: node.data.config || {}
         },
      },
    ]);
  }, []);

  const editNode = useCallback((nodeId, newId, newData) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId ? { ...node, id: newId, data: { ...node.data, label: newId, config: newData } } : node
      )
    );
  });

  const editEdge = useCallback((edgeId, newData) => {
    setEdges((eds) =>
      eds.map((edge) =>
        edge.id === edgeId ? { ...edge, data: { ...edge.data, config: newData } } : edge
      )
    );
  });

  return {
    nodes,
    edges,
    handleNodesChange,
    handleEdgesChange,
    handleConnect,
    addNode,
    editNode,
    setNodes,
    setEdges,
    editEdge,
  };
}