import { Editor } from '@monaco-editor/react';
import { parseYaml, loadYaml, isValidPipeline, importYamlFromString } from '../utils/yamlTools';
import { useState, useEffect } from 'react';
import yaml from 'js-yaml';
import { Download, FileText, Edit3 } from 'lucide-react';
import { modalStyles, buttonStyles, inputStyles } from '../styles/components';
import { hoverHandlers } from '../styles/hoverUtils';
import { colors, spacing, borderRadius, typography } from '../styles/theme';

export default function ConfigModal({ modalHook, pipelineHook, templatesHook, scriptsHook }) {

    const { newId, setNewId, type ,id, setId, isOpen, modalContent, openModal, closeModal } = modalHook;
    const { editTemplate, addTemplate } = templatesHook;
    const { editNode, editEdge, setNodes, setEdges } = pipelineHook;
    const { scripts } = scriptsHook || { scripts: {} };

    const [ text, setText ] = useState(parseYaml(modalContent).data);
    const [vertexType, setVertexType] = useState('source');
    const [selectedUdfScript, setSelectedUdfScript] = useState('');
    
    // For file viewing mode
    const isViewFile = type === 'view file';
    const fileInfo = isViewFile && modalContent ? modalContent : null;
    
    // Check if the file is a valid pipeline
    const [isValidPipelineFile, setIsValidPipelineFile] = useState(false);
    const [pipelineValidationError, setPipelineValidationError] = useState(null);
    
    useEffect(() => {
        if (isViewFile && fileInfo?.content) {
            const validation = isValidPipeline(fileInfo.content);
            setIsValidPipelineFile(validation.valid);
            setPipelineValidationError(validation.error);
        } else {
            setIsValidPipelineFile(false);
            setPipelineValidationError(null);
        }
    }, [isViewFile, fileInfo]);
    
    const handleEditInCanvas = () => {
        if (!fileInfo?.content || !setNodes || !setEdges) return;
        
        try {
            importYamlFromString(fileInfo.content, setNodes, setEdges);
            // Mark pipeline as loaded with file path
            // The id parameter contains the filePath when type is 'view file'
            const filePath = type === 'view file' ? id : null;
            if (pipelineHook?.markPipelineLoaded) {
                pipelineHook.markPipelineLoaded(filePath);
            }
            closeModal();
            // Optional: Show success message
        } catch (error) {
            alert('Failed to load pipeline into canvas: ' + error.message);
        }
    };

    // Generate template based on vertex type
    const generateTemplate = (vertType, scriptName = '') => {
        const baseConfig = { scale: { min: 1 } };
        
        switch(vertType) {
            case 'source':
                return { ...baseConfig, source: { generator: {} } };
            case 'sink':
                return { ...baseConfig, sink: { log: {} } };
            case 'udf':
                if (scriptName) {
                    return { ...baseConfig, udf: { container: { image: `${scriptName}:latest` } } };
                }
                return baseConfig;
            default:
                return baseConfig;
        }
    };

    // Reset vertex type and script selection when modal opens for new template
    useEffect(() => {
        if (type === 'new template') {
            setVertexType('source');
            setSelectedUdfScript('');
        }
    }, [type]);

    // Update text based on modal type and content
    useEffect(() => {
        if (type === 'view file') {
            // For file viewing, use the content directly
            setText(fileInfo?.content || '');
        } else if (type === 'new template') {
            // Generate template when opening new template modal or when type/script changes
            const template = generateTemplate(vertexType, selectedUdfScript);
            const yamlText = yaml.dump(template);
            setText(yamlText);
        } else {
            // For existing templates/nodes, use the provided content
            setText(parseYaml(modalContent).data);
        }
    }, [modalContent, type, vertexType, selectedUdfScript, fileInfo]);

    const saveConfig = () => {
        // File viewing mode is read-only, just close
        if (type === 'view file') {
            closeModal();
            return;
        }
        
        const tryNewConfig = loadYaml(text);
        const newConfig = tryNewConfig.error ? modalContent : tryNewConfig.data;
        // editTemplate(id, newConfig);
        if (type === 'template') {
            editTemplate(id, newId, newConfig);
        };
        if (type === 'node') {
            editNode(id, newId, newConfig);
        };
        if (type === 'edge') {
            editEdge(id, newConfig);
        };
        if (type === 'new template') {
          let reactFlowType;
          if (newConfig.source) reactFlowType = "input";
          else if (newConfig.sink) reactFlowType = "output";
          else reactFlowType = undefined;
            addTemplate({
                id: newId,
                type: reactFlowType,
                data: { 
                    label: newId,
                    config: newConfig
                },
            });
        }
        if (type === 'exported pipeline') {
          const yamlText = yaml.dump(modalContent);
  
          const yamlWithName = yamlText.replace(
              /name:\s*"?<pipeline-name>"?/,
              `name: ${newId}`
            );
  
          const blob = new Blob([yamlWithName], { type: "text/yaml" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${newId}.yaml`;
          a.click();
          URL.revokeObjectURL(url);
        }

        closeModal();
    };
    
    const getEditorLanguage = () => {
        if (isViewFile && fileInfo?.language) {
            return fileInfo.language;
        }
        if (type === 'exported pipeline' || type === 'template' || type === 'node' || type === 'edge' || type === 'new template') {
            return 'yaml';
        }
        return 'yaml';
    };

    if (!isOpen) return null;    
    
    // Get available UDF scripts for dropdown
    const udfScripts = Object.keys(scripts).filter(key => 
        scripts[key]?.type === 'map' || scripts[key]?.type === 'reduce'
    );

    return (
        <div style={modalStyles.overlay}>
          <div style={{ ...modalStyles.container, ...modalStyles.containerMedium }}>
            {isViewFile && fileInfo && (
                <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: spacing.lg,
                    padding: spacing.lg,
                    background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                    borderRadius: spacing.md,
                    border: `1px solid ${colors.border.default}`,
                    marginBottom: spacing.sm
                }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: spacing.md,
                        background: colors.primaryLight,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                    }}>
                        <FileText size={24} color={colors.primary} />
                    </div>
                    <div>
                        <h3 style={modalStyles.title}>{fileInfo.fileName}</h3>
                        <p style={modalStyles.description}>Repository file viewer</p>
                    </div>
                </div>
            )}
            {type === 'exported pipeline' && (
                <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: spacing.lg,
                    padding: spacing.lg,
                    background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                    borderRadius: spacing.md,
                    border: `1px solid ${colors.border.default}`,
                    marginBottom: spacing.sm
                }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: spacing.md,
                        background: colors.primaryLight,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                    }}>
                        <Download size={24} color={colors.primary} />
                    </div>
                    <div>
                        <h3 style={modalStyles.title}>Export Pipeline</h3>
                        <p style={modalStyles.description}>Enter a name for your pipeline YAML file</p>
                    </div>
                </div>
            )}
            {!isViewFile && (
                <input
                    value={newId}
                    onChange={(e) => setNewId(e.target.value)}
                    placeholder={type === 'exported pipeline' ? "pipeline-name" : "e.g., generatorSource"}
                    style={inputStyles.input}
                    {...hoverHandlers.inputFocus}
                />
            )}
            
            {type === 'exported pipeline' && (
                <div style={{
                    border: `1px solid ${colors.border.default}`,
                    borderRadius: borderRadius.lg,
                    overflow: 'hidden',
                    background: colors.bg.primary
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: `${spacing.md} ${spacing.md}`,
                        background: colors.bg.hover,
                        borderBottom: `1px solid ${colors.border.default}`
                    }}>
                        <FileText size={16} style={{ marginRight: spacing.sm, color: colors.text.tertiary }} />
                        <span style={{
                            fontSize: typography.fontSize.sm,
                            fontWeight: typography.fontWeight.semibold,
                            color: colors.text.tertiary,
                            textTransform: 'uppercase',
                            letterSpacing: typography.letterSpacing.wide
                        }}>Preview</span>
                    </div>
                    <div style={{ border: 'none' }}>
                        <Editor
                          height="450px"
                          language="yaml"
                          theme="vs-dark"
                          options={{
                            minimap: { enabled: false },
                            fontSize: 12,
                            automaticLayout: true,
                            readOnly: true,
                          }}
                          value={text}
                        />
                    </div>
                </div>
            )}
            
            {type === 'new template' && (
                <>
                    <label style={inputStyles.label}>Vertex Type</label>
                    <select
                        value={vertexType}
                        onChange={(e) => {
                            setVertexType(e.target.value);
                            if (e.target.value !== 'udf') {
                                setSelectedUdfScript('');
                            }
                        }}
                        style={inputStyles.select}
                        {...hoverHandlers.inputFocus}
                    >
                        <option value="source">Source</option>
                        <option value="udf">UDF</option>
                        <option value="sink">Sink</option>
                    </select>

                    {vertexType === 'udf' && (
                        <>
                            <label style={inputStyles.label}>UDF Script</label>
                            <select
                                value={selectedUdfScript}
                                onChange={(e) => setSelectedUdfScript(e.target.value)}
                                style={inputStyles.select}
                                {...hoverHandlers.inputFocus}
                            >
                                <option value="">Select a script...</option>
                                {udfScripts.map(scriptKey => (
                                    <option key={scriptKey} value={scriptKey}>
                                        {scriptKey}
                                    </option>
                                ))}
                            </select>
                        </>
                    )}
                </>
            )}
    
            {type !== 'exported pipeline' && (
                <div style={{ 
                    border: `1px solid ${colors.border.default}`, 
                    borderRadius: borderRadius.lg, 
                    overflow: 'hidden',
                    boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.05)'
                }}>
                    <Editor
                      height={isViewFile ? "600px" : "350px"}
                      language={getEditorLanguage()}
                      theme="vs-dark"
                      options={{
                        minimap: { enabled: false },
                        fontSize: 13,
                        automaticLayout: true,
                        readOnly: isViewFile,
                      }}
                      value={text}
                      onChange={(change) => !isViewFile && setText(change)}
                    />
                </div>
            )}
            <div style={modalStyles.buttonContainer}>
              <button 
                style={buttonStyles.secondary} 
                onClick={closeModal}
                {...hoverHandlers.secondaryButton}
              >
                {isViewFile ? 'Close' : 'Cancel'}
              </button>
              {isViewFile && isValidPipelineFile && (
                <button 
                  style={buttonStyles.success} 
                  onClick={handleEditInCanvas}
                  {...hoverHandlers.successButton}
                >
                  <Edit3 size={16} style={{ marginRight: spacing.sm }} />
                  Edit in Canvas
                </button>
              )}
              {isViewFile && !isValidPipelineFile && fileInfo?.fileName?.endsWith('.yaml') && (
                <div style={{
                    padding: `${spacing.sm} ${spacing.md}`,
                    background: colors.dangerLight,
                    color: colors.danger,
                    borderRadius: borderRadius.md,
                    fontSize: typography.fontSize.base,
                    border: `1px solid ${colors.dangerBorder}`
                }}>
                  {pipelineValidationError || 'Not a valid pipeline file'}
                </div>
              )}
              {!isViewFile && (
                <button 
                  style={buttonStyles.primary} 
                  onClick={saveConfig}
                  {...hoverHandlers.primaryButton}
                >
                  {type === 'exported pipeline' ? (
                      <>
                          <Download size={16} style={{ marginRight: spacing.sm }} />
                          Download YAML
                      </>
                  ) : (
                      'Save'
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      );
}


