import yaml from 'js-yaml';

export function parseYaml(yamlString) {
    try {
        const parsed = yaml.dump(yamlString, { sortKeys: false });
        return { data: parsed, error: null };
    } catch (error) {
        return { data: null, error: error.message };
    }
};

export function loadYaml(yamlString) {
    try {
        const loaded = yaml.load(yamlString);
        return { data: loaded, error: null };
    } catch (error) {
        return { data: null, error: error.message };
    }
}

export const exportPipeline = (nodes, edges) => {
    const vertices = nodes.map(n => ({
      name: n.id,
      ...JSON.parse(JSON.stringify(n.data.config))
    }));

    const edgesYaml = edges.map(e => {
      const base = {
        from: e.source,
        to: e.target,
      };

      // If edge has stored conditions, include them in YAML
      if (e.data?.conditions) {
        base.conditions = e.data.conditions;
      }

      return base;
    });

    const pipeline = {
      apiVersion: "numaflow.numaproj.io/v1alpha1",
      kind: "Pipeline",
      metadata: { name: "<pipeline-name>" }, // placeholder, replaced in modal
      spec: { vertices, edges: edgesYaml }
    };

    const yamlText = yaml.dump(pipeline, { sortKeys: false });
    return yamlText;
  };

  export async function importYaml(file, setNodes, setEdges) {
    const text = await file.text();
    const parsed = yaml.load(text);
  
    if (!parsed?.spec?.vertices) {
      throw new Error("Invalid pipeline YAML: missing spec.vertices");
    }
  
    const vertices = parsed.spec.vertices;
    const edgesYaml = parsed.spec.edges || [];
  
    // Separate vertices by type
    const sources = [];
    const udfs = [];
    const sinks = [];
  
    vertices.forEach(v => {
      const { name, ...config } = v;
  
      if (config.source) sources.push({ name, config });
      else if (config.sink) sinks.push({ name, config });
      else udfs.push({ name, config });
    });
  
    // Helper to place in row with horizontal spacing
    const placeRow = (items, yPosition) =>
      items.map((v, index) => ({
        id: v.name,
        data: { label: v.name, config: v.config },
        position: { x: index * 200 + 100, y: yPosition },
        type: v.config.source ? "input" : v.config.sink ? "output" : undefined
      }));
  
    const importedNodes = [
      ...placeRow(sources, 50),        // top row
      ...placeRow(udfs, 250),         // middle row
      ...placeRow(sinks, 450)         // bottom row
    ];
  
      const importedEdges = edgesYaml.map((e, idx) => {
      const edge = {
          id: `e-${idx}`,
          source: e.from,
          target: e.to,
          data: {}   // for storing optional metadata like conditions
      };
  
      if (e.conditions) {
          edge.data.conditions = e.conditions;
      }
  
      return edge;
      });
  
  
    setNodes(importedNodes);
    setEdges(importedEdges);
  }
  