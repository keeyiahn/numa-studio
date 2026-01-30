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
import { toolbarStyles, buttonStyles } from '../styles/components';
import { hoverHandlers } from '../styles/hoverUtils';
import { colors, spacing, borderRadius, typography } from '../styles/theme';

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
        
        // Prompt for commit message
        const defaultMessage = currentPipelinePath 
            ? `Update ${currentPipelinePath}`
            : `Create ${pipelinePath}`;
        const commitMessage = prompt('Enter commit message:', defaultMessage);
        
        // If user cancelled, abort commit
        if (commitMessage === null) {
            return;
        }
        
        // Use default message if user provided empty string
        const finalCommitMessage = commitMessage.trim() || defaultMessage;
        
        setIsCommitting(true);
        try {
            const pipelineYaml = exportPipeline(nodes, edges);
            // If currentPipelinePath is null, we're creating a new pipeline
            // Otherwise, we're updating an existing one
            const isNewPipeline = !currentPipelinePath;
            await updatePipeline(pipelineYaml, isNewPipeline, pipelinePath, finalCommitMessage);
            
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
            <div style={toolbarStyles.container}>
                <div style={toolbarStyles.group}>
                    <button
                        onClick={onClickExport}
                        style={buttonStyles.primary}
                        {...hoverHandlers.primaryButton}
                        title="Export pipeline as YAML"
                    >
                        <Download size={16} style={{ marginRight: spacing.sm }} />
                        Export Pipeline
                    </button>
                    
                    <button
                        onClick={onClickCommit}
                        disabled={!isInitialized || isCommitting}
                        style={{
                            ...buttonStyles.success,
                            opacity: (!isInitialized || isCommitting) ? 0.6 : 1,
                            cursor: (!isInitialized || isCommitting) ? 'not-allowed' : 'pointer'
                        }}
                        onMouseEnter={(e) => {
                            if (isInitialized && !isCommitting) {
                                hoverHandlers.successButton.onMouseEnter(e);
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (isInitialized && !isCommitting) {
                                hoverHandlers.successButton.onMouseLeave(e);
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
                        <GitCommit size={16} style={{ marginRight: spacing.sm }} />
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
                            ...buttonStyles.secondary,
                            opacity: isImporting ? 0.6 : 1,
                            cursor: isImporting ? 'not-allowed' : 'pointer'
                        }}
                        onMouseEnter={(e) => {
                            if (!isImporting) {
                                hoverHandlers.secondaryButton.onMouseEnter(e);
                                e.currentTarget.style.transform = 'translateY(-1px)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (!isImporting) {
                                hoverHandlers.secondaryButton.onMouseLeave(e);
                                e.currentTarget.style.transform = 'translateY(0)';
                            }
                        }}
                        title="Import pipeline from YAML file"
                    >
                        <Upload size={16} style={{ marginRight: spacing.sm }} />
                        {isImporting ? 'Importing...' : 'Import Pipeline'}
                    </button>
                </div>
                
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".yaml,.yml"
                    onChange={onClickImport}
                    style={{ display: 'none' }}
                />
            </div>
            
            {/* Current Pipeline Indicator */}
            {isInitialized && isPipelineLoaded && (
                <div style={{
                    position: 'absolute',
                    top: '60px',
                    left: spacing.xl,
                    right: spacing.xl,
                    padding: `${spacing.sm} ${spacing.md}`,
                    background: colors.bg.hover,
                    border: `1px solid ${colors.border.default}`,
                    borderRadius: borderRadius.md,
                    fontSize: typography.fontSize.base,
                    color: colors.text.tertiary,
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing.sm,
                    zIndex: 10,
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
                }}>
                    <FileText size={14} color={colors.text.tertiary} />
                    <span style={{ fontWeight: typography.fontWeight.medium, color: colors.text.secondary }}>Editing:</span>
                    {currentPipelinePath ? (
                        <span style={{ 
                            fontFamily: 'monospace',
                            color: colors.text.primary,
                            background: colors.bg.tertiary,
                            padding: `2px ${spacing.md}`,
                            borderRadius: borderRadius.xs,
                            fontSize: typography.fontSize.sm
                        }}>
                            {currentPipelinePath}
                        </span>
                    ) : (
                        <span style={{ 
                            color: colors.text.muted,
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
