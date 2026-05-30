export interface DependencyEdge {
  moduleKey: string;
  requiresModuleKey: string;
  requirementType: "hard" | "soft";
  minCompletionPercentage: number;
  minQuizScore: number;
}

export interface AdjacencyList {
  [moduleKey: string]: string[]; // moduleKey -> list of prerequisite moduleKeys
}

/**
 * Build adjacency list: moduleKey -> [prerequisite moduleKeys]
 */
export function buildDependencyGraph(
  moduleKeys: string[],
  dependencies: DependencyEdge[]
): AdjacencyList {
  const graph: AdjacencyList = {};
  for (const key of moduleKeys) {
    graph[key] = [];
  }
  for (const dep of dependencies) {
    if (!graph[dep.moduleKey]) graph[dep.moduleKey] = [];
    graph[dep.moduleKey].push(dep.requiresModuleKey);
  }
  return graph;
}

/**
 * Detect cycles in the dependency graph. Returns array of cycle paths if any.
 */
export function detectCycles(graph: AdjacencyList): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recStack = new Set<string>();
  const path: string[] = [];

  function dfs(node: string): boolean {
    visited.add(node);
    recStack.add(node);
    path.push(node);

    for (const neighbor of graph[node] || []) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) return true;
      } else if (recStack.has(neighbor)) {
        const cycleStart = path.indexOf(neighbor);
        cycles.push([...path.slice(cycleStart), neighbor]);
        return true;
      }
    }

    path.pop();
    recStack.delete(node);
    return false;
  }

  for (const node of Object.keys(graph)) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }

  return cycles;
}

/**
 * Topological sort (Kahn's algorithm). Returns modules in dependency order.
 * Modules with no prerequisites come first.
 */
export function topologicalSort(graph: AdjacencyList): string[] {
  // Build reverse graph: who depends on me
  const inDegree: Record<string, number> = {};
  const allNodes = new Set(Object.keys(graph));

  for (const node of allNodes) inDegree[node] = 0;

  // graph[A] = [B, C] means A requires B and C
  // So B -> A, C -> A in the "teaches" direction
  // inDegree of A = number of prerequisites
  for (const node of allNodes) {
    inDegree[node] = (graph[node] || []).length;
  }

  const queue: string[] = [];
  for (const node of allNodes) {
    if (inDegree[node] === 0) queue.push(node);
  }

  const result: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push(current);

    // Find all modules that require `current`
    for (const node of allNodes) {
      if ((graph[node] || []).includes(current)) {
        inDegree[node]--;
        if (inDegree[node] === 0) queue.push(node);
      }
    }
  }

  // Append any remaining (cycle members) at the end
  for (const node of allNodes) {
    if (!result.includes(node)) result.push(node);
  }

  return result;
}

/**
 * Get the depth level of a module in the dependency graph.
 * Level 0 = no prerequisites, Level 1 = requires only Level 0 modules, etc.
 */
export function getModuleDepth(
  graph: AdjacencyList,
  moduleKey: string,
  memo: Record<string, number> = {}
): number {
  if (memo[moduleKey] !== undefined) return memo[moduleKey];
  const prereqs = graph[moduleKey] || [];
  if (prereqs.length === 0) {
    memo[moduleKey] = 0;
    return 0;
  }
  const depth = 1 + Math.max(...prereqs.map((p) => getModuleDepth(graph, p, memo)));
  memo[moduleKey] = depth;
  return depth;
}

/**
 * Get all module depths at once.
 */
export function getAllModuleDepths(graph: AdjacencyList): Record<string, number> {
  const memo: Record<string, number> = {};
  for (const key of Object.keys(graph)) {
    getModuleDepth(graph, key, memo);
  }
  return memo;
}

/**
 * Check if adding an edge would create a cycle.
 */
export function wouldCreateCycle(
  graph: AdjacencyList,
  fromModule: string,
  toPrereq: string
): boolean {
  // Adding fromModule -> toPrereq means fromModule requires toPrereq
  // Check if toPrereq already (transitively) requires fromModule
  const visited = new Set<string>();
  function canReach(node: string, target: string): boolean {
    if (node === target) return true;
    if (visited.has(node)) return false;
    visited.add(node);
    for (const prereq of graph[node] || []) {
      if (canReach(prereq, target)) return true;
    }
    return false;
  }
  return canReach(toPrereq, fromModule);
}
