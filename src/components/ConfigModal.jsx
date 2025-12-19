import { Editor } from '@monaco-editor/react';
import { parseYaml, loadYaml } from '../utils/yamlTools';
import { useState, useEffect } from 'react';
import yaml from 'js-yaml';

export default function ConfigModal({ modalHook, pipelineHook, templatesHook }) {

    const { newId, setNewId, type ,id, setId, isOpen, modalContent, openModal, closeModal } = modalHook;
    const { editTemplate, addTemplate } = templatesHook;
    const { editNode, editEdge } = pipelineHook;

    const [ text, setText ] = useState(parseYaml(modalContent).data);
    useEffect(() => {
        setText(parseYaml(modalContent).data);
    }, [modalContent]);
    useEffect(() => {
        console.log("text updated:", text);
    }, [modalContent])

    const saveConfig = () => {
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
                    label: id,
                    config: newConfig
                },
            });
        }
        if (type === 'exported pipeline') {
            onSave();
        }

        closeModal();
    };


    const onSave = () => {
        const yamlText = yaml.dump(modalContent);
        console.log(yamlText);

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
    }

    if (!isOpen) return null;    
    return (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <input
                value={newId}
                onChange={(e) => setNewId(e.target.value)}
                placeholder="e.g., generatorSource"
            />
    
            <Editor
              height="350px"
              language="yaml"
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                automaticLayout: true,
              }}
              value={text}
              onChange={(change) => setText(change)}
            />
          </div>
          <button style={styles.button} onClick={closeModal}>Close</button>
          <button style={styles.button} onClick={saveConfig}> Save</button>
        </div>
      );
}

const styles = {
    overlay: {
      position: 'fixed', top: 0, left: 0,
      width: '100vw', height: '100vh',
      background: 'rgba(0,0,0,0.4)',
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      zIndex: 1000
    },
    modal: {
      background: 'white',
      padding: '20px',
      width: '450px',
      borderRadius: '6px',
      boxShadow: '0 0 20px rgba(0,0,0,0.2)',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px'
    },
    button: {
        padding: '6px 12px',
        background: '#1976d2',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer'
      }
  };

