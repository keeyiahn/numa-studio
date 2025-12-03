export function nameGen(nodes, baseName) {
    const regex = new RegExp(`^${baseName}-(\\d+)$`);

    // find highest N in existing nodes
    let maxN = 0;
    nodes.forEach(n => {
      const match = n.id.match(regex);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxN) maxN = num;
      }
    });

    const newName = `${baseName}-${maxN + 1}`
    console.log(newName)
    return newName;
};