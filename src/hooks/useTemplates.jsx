import { useState } from 'react';

export default function useTemplates() {
    const initialTemplates = {
        "generator-source": {
            id: String,
            type: "input",
            data: { 
                label: "generator-source",
                config: {
                    scale: { min: 1 },
                    source: { generator: {} }
                }
         },
        },
        "cat-udf": {
            id: String,
            type: "default",
            data: { 
                label: "cat-udf",
                config: {
                    scale: { min: 1 },
                    source: { generator: {} },
                }
            },
        },
        "log-sink": {
            id: String,
            type: "output",
            data: { 
                label: "log-sink",
                config: {
                    scale: { min: 1 },
                    sink: { log: {} },
                }
            },
        },
    }

    const [templates, setTemplates] = useState(initialTemplates);


    const addTemplate = (template) => {
        setTemplates((prevTemplates) => ({
            ...prevTemplates,
            [template.id]: template
        }));
    }

    const editTemplate = (templateId, newId, newConfig) => {
        setTemplates((prev) => {
          const template = prev[templateId];
          if (!template) return prev;
      
          const updatedTemplate = {
            ...template,
            id: newId,                        // update the template's id field
            data: {
              ...template.data,
              config: newConfig,              // update config
              label: newId,                   // optional: sync label to new ID
            },
          };
      
          // Rebuild object with new key
          const { [templateId]: _, ...rest } = prev;
      
          return {
            ...rest,
            [newId]: updatedTemplate,         // new key with updated template
          };
        });
      };

    return {
        templates,
        addTemplate,
        editTemplate
    };
}