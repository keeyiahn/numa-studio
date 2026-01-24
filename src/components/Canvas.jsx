import { 
    ReactFlow,
    useReactFlow,
    Background,
    MiniMap,
    Controls,
} from "@xyflow/react";
import '@xyflow/react/dist/style.css';
import {
    useCallback,
    useRef,
    useState,
    useEffect
} from "react";
import { Download, Upload, FileText, GitCommit } from 'lucide-react';

import { nameGen } from '../utils/nameGen';
import { exportPipeline, importYaml } from '../utils/yamlTools';
import yaml from 'js-yaml';

export default function Canvas({ pipelineHook, modalHook, repositoryHook }) {

    const { nodes, edges, handleNodesChange, handleEdgesChange, handleConnect, addNode, setNodes, setEdges, isPipelineLoaded, currentPipelinePath, clearPipelineLoaded } = pipelineHook;
    const { isOpen, modalContent, openModal, closeModal } = modalHook;
    const { isInitialized, updatePipeline, repository } = repositoryHook || {};
    const { screenToFlowPosition } = useReactFlow();
    const fileInputRef = useRef(null);
    const [isImporting, setIsImporting] = useState(false);
    const [isCommitting, setIsCommitting] = useState(false);

    const onDragOver = useCallback((event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
    }, []);

    const onDrop = useCallback(
        (event) => {
          event.preventDefault();
    
          const nodeTemplate = event.dataTransfer.getData("application/reactflow");
          const newNode = JSON.parse(nodeTemplate);
          const newName = nameGen(nodes, newNode.data.label);
          newNode.id = newName;
          console.log(newNode);
          console.log(newName);
          if (!nodeTemplate) return;
    
          const position = screenToFlowPosition({
            x: event.clientX,
            y: event.clientY
          });
    
          addNode(newNode, position);
        },
        [nodes]
    );

    const onNodeClick = useCallback((event, node) => {
        event.preventDefault();
        openModal("node", node.id, node.data.config);
        console.log('node click', node);
    }, []);

    const onNodeRightClick = useCallback((event, node) => {
        event.preventDefault();
        setNodes((nds) => nds.filter((n) => n.id !== node.id));
        setEdges((eds) =>
          eds.filter((e) => e.source !== node.id && e.target !== node.id)
        );
    }, [setEdges]);

    const onEdgeClick = useCallback((event, edge) => { 
        event.preventDefault();

        const conditionsYaml = {
            ...(edge.data?.conditions ? edge.data.conditions : { conditions: {} })
          };

        openModal("edge", `from: ${edge.source} to: ${edge.target}`, conditionsYaml);
    }, []);

    const onEdgeRightClick = useCallback((event, edge) => {
        event.preventDefault();
        console.log(`edge id: ${edge.id}`);
        setEdges((eds) => eds.filter((e) => e.id !== edge.id));
    }, [setNodes, setEdges]);

    const onClickExport = () => {
        const pipeline = exportPipeline(nodes, edges);
        openModal("exported pipeline", "my-pipeline", yaml.load(pipeline) );
    };

    const onClickImport = async (event) => {
        const file = event.target.files[0];
        if (!file) return;
    
        setIsImporting(true);
        try {
          await importYaml(file, setNodes, setEdges);
          // Mark pipeline as loaded when imported (no file path since it's from external file)
          if (pipelineHook?.markPipelineLoaded) {
            pipelineHook.markPipelineLoaded(null);
          }
        } catch (err) {
          alert("Import failed: " + err.message);
        } finally {
          setIsImporting(false);
          // Reset file input
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    // Clear pipeline loaded state when repository changes
    useEffect(() => {
        if (!isInitialized || !repository) {
            clearPipelineLoaded();
        }
    }, [isInitialized, repository?.name, clearPipelineLoaded]);

    const onClickCommit = async () => {
        if (!isInitialized) {
            alert('Please initialize a repository first');
            return;
        }
        
        // Allow commit even if pipeline not explicitly loaded (for new pipelines)
        // But require at least some nodes/edges to be meaningful
        if (nodes.length === 0 && edges.length === 0) {
            alert('Please add at least one node to the pipeline before committing.');
            return;
        }
        
        // If creating a new pipeline, prompt for filename
        let pipelinePath = currentPipelinePath;
        if (!pipelinePath) {
            const fileName = prompt('Enter filename for the pipeline (e.g., pipeline.yaml):', 'pipeline.yaml');
            if (!fileName) {
                // User cancelled
                return;
            }
            
            // Validate and sanitize filename
            let sanitized = fileName.trim();
            if (!sanitized) {
                alert('Filename cannot be empty');
                return;
            }
            
            // Ensure it ends with .yaml or .yml
            if (!sanitized.endsWith('.yaml') && !sanitized.endsWith('.yml')) {
                sanitized += '.yaml';
            }
            
            // Basic validation: no path separators (for now, save in root)
            if (sanitized.includes('/') || sanitized.includes('\\')) {
                alert('Filename cannot contain path separators. Please enter just the filename.');
                return;
            }
            
            pipelinePath = sanitized;
        }
        
        setIsCommitting(true);
        try {
            const pipelineYaml = exportPipeline(nodes, edges);
            // If currentPipelinePath is null, we're creating a new pipeline
            // Otherwise, we're updating an existing one
            const isNewPipeline = !currentPipelinePath;
            await updatePipeline(pipelineYaml, isNewPipeline, pipelinePath);
            
            // If this was a new pipeline, mark it as loaded with the provided path
            if (isNewPipeline && pipelineHook?.markPipelineLoaded) {
                pipelineHook.markPipelineLoaded(pipelinePath);
            }
            
            // Show success feedback
            setTimeout(() => {
                setIsCommitting(false);
            }, 500);
        } catch (err) {
            alert("Commit failed: " + err.message);
            setIsCommitting(false);
        }
    };

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            {/* Toolbar */}
            <div style={styles.toolbar}>
                <div style={styles.toolbarGroup}>
                    <button
                        onClick={onClickExport}
                        style={styles.toolbarButton}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#2563eb';
                            e.currentTarget.style.transform = 'translateY(-1px)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#3b82f6';
                            e.currentTarget.style.transform = 'translateY(0)';
                        }}
                        title="Export pipeline as YAML"
                    >
                        <Download size={16} style={{ marginRight: '8px' }} />
                        Export Pipeline
                    </button>
                    
                    <button
                        onClick={onClickCommit}
                        disabled={!isInitialized || isCommitting}
                        style={{
                            ...styles.toolbarButton,
                            ...styles.toolbarButtonCommit,
                            opacity: (!isInitialized || isCommitting) ? 0.6 : 1,
                            cursor: (!isInitialized || isCommitting) ? 'not-allowed' : 'pointer'
                        }}
                        onMouseEnter={(e) => {
                            if (isInitialized && !isCommitting) {
                                e.currentTarget.style.background = '#059669';
                                e.currentTarget.style.transform = 'translateY(-1px)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (isInitialized && !isCommitting) {
                                e.currentTarget.style.background = '#10b981';
                                e.currentTarget.style.transform = 'translateY(0)';
                            }
                        }}
                        title={
                            !isInitialized 
                                ? "Initialize a repository first" 
                                : currentPipelinePath
                                    ? `Update ${currentPipelinePath} in repository`
                                    : "Create pipeline.yaml in repository"
                        }
                    >
                        <GitCommit size={16} style={{ marginRight: '8px' }} />
                        {isCommitting 
                            ? 'Committing...' 
                            : currentPipelinePath 
                                ? 'Commit Pipeline' 
                                : 'Create Pipeline'}
                    </button>
                    
                    <button
                        onClick={handleImportClick}
                        disabled={isImporting}
                        style={{
                            ...styles.toolbarButton,
                            ...styles.toolbarButtonSecondary,
                            opacity: isImporting ? 0.6 : 1,
                            cursor: isImporting ? 'not-allowed' : 'pointer'
                        }}
                        onMouseEnter={(e) => {
                            if (!isImporting) {
                                e.currentTarget.style.background = '#e2e8f0';
                                e.currentTarget.style.transform = 'translateY(-1px)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (!isImporting) {
                                e.currentTarget.style.background = '#f1f5f9';
                                e.currentTarget.style.transform = 'translateY(0)';
                            }
                        }}
                        title="Import pipeline from YAML file"
                    >
                        <Upload size={16} style={{ marginRight: '8px' }} />
                        {isImporting ? 'Importing...' : 'Import Pipeline'}
                    </button>
                </div>
                
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".yaml,.yml"
                    onChange={onClickImport}
                    style={styles.hiddenFileInput}
                />
            </div>
            
            {/* Current Pipeline Indicator */}
            {isInitialized && isPipelineLoaded && (
                <div style={{
                    position: 'absolute',
                    top: '60px',
                    left: '20px',
                    right: '20px',
                    padding: '8px 12px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    fontSize: '13px',
                    color: '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    zIndex: 10,
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
                }}>
                    <FileText size={14} color="#64748b" />
                    <span style={{ fontWeight: 500, color: '#475569' }}>Editing:</span>
                    {currentPipelinePath ? (
                        <span style={{ 
                            fontFamily: 'monospace',
                            color: '#0f172a',
                            background: '#f1f5f9',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '12px'
                        }}>
                            {currentPipelinePath}
                        </span>
                    ) : (
                        <span style={{ 
                            color: '#94a3b8',
                            fontStyle: 'italic'
                        }}>
                            Imported pipeline (not from repository)
                        </span>
                    )}
                </div>
            )}
            
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={handleNodesChange}
                onEdgesChange={handleEdgesChange}
                onConnect={handleConnect}
                fitView
                onDragOver={onDragOver}
                onDrop={onDrop}
                onNodeClick={onNodeClick}
                onEdgeClick={onEdgeClick}
                onNodeContextMenu={onNodeRightClick}
                onEdgeContextMenu={onEdgeRightClick}
            >
                <Background />
                <MiniMap />
                <Controls />
            </ReactFlow>
        </div>
    );
}

const styles = {
    toolbar: {
        position: 'absolute',
        top: '16px',
        left: '16px',
        zIndex: 10,
        display: 'flex',
        gap: '12px',
        alignItems: 'center',
        background: '#ffffff',
        padding: '8px 12px',
        borderRadius: '12px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        border: '1px solid #e2e8f0'
    },
    toolbarGroup: {
        display: 'flex',
        gap: '8px',
        alignItems: 'center'
    },
    toolbarButton: {
        display: 'flex',
        alignItems: 'center',
        padding: '10px 16px',
        background: '#3b82f6',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '13px',
        fontWeight: '600',
        transition: 'all 0.2s ease',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
        fontFamily: 'inherit'
    },
    toolbarButtonSecondary: {
        background: '#f1f5f9',
        color: '#475569',
        border: '1px solid #e2e8f0'
    },
    toolbarButtonCommit: {
        background: '#10b981',
        color: 'white'
    },
    hiddenFileInput: {
        display: 'none'
    }
};