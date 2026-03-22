import { PennyekartAgent, AgentRole } from "@/hooks/usePennyekartAgents";

export interface AgentRankInfo {
  isFull: boolean;
  current: number;
  required: number;
  label: string; // e.g. "3/5 PROs"
  percentage: number; // 0-100
}

/**
 * Calculate rank fulfillment for an agent based on their downstream team.
 *
 * Rules:
 * - PRO: full rank if customer_count >= 5
 * - Group Leader: full rank if has >= 5 PROs each with >= 5 customers
 * - Coordinator: full rank if has >= 5 full-rank Group Leaders
 * - Team Leader: full rank if has >= 4 full-rank Coordinators
 */
export function calculateAgentRank(
  agent: PennyekartAgent,
  allAgents: PennyekartAgent[],
  visited: Set<string> = new Set()
): AgentRankInfo {
  if (visited.has(agent.id)) {
    return { isFull: false, current: 0, required: 1, label: "–", percentage: 0 };
  }
  visited.add(agent.id);

  const directChildren = allAgents.filter(
    (a) => a.parent_agent_id === agent.id && a.id !== agent.id && !visited.has(a.id)
  );

  switch (agent.role) {
    case "pro": {
      const req = 5;
      const cur = agent.customer_count;
      return {
        isFull: cur >= req,
        current: cur,
        required: req,
        label: `${cur}/${req} Customers`,
        percentage: Math.min(100, Math.round((cur / req) * 100)),
      };
    }

    case "group_leader": {
      const req = 5;
      const fullPros = directChildren.filter((c) => {
        if (c.role !== "pro") return false;
        const rank = calculateAgentRank(c, allAgents, new Set(visited));
        return rank.isFull;
      });
      const cur = fullPros.length;
      return {
        isFull: cur >= req,
        current: cur,
        required: req,
        label: `${cur}/${req} Full PROs`,
        percentage: Math.min(100, Math.round((cur / req) * 100)),
      };
    }

    case "coordinator": {
      const req = 5;
      const fullGLs = directChildren.filter((c) => {
        if (c.role !== "group_leader") return false;
        const rank = calculateAgentRank(c, allAgents, new Set(visited));
        return rank.isFull;
      });
      const cur = fullGLs.length;
      return {
        isFull: cur >= req,
        current: cur,
        required: req,
        label: `${cur}/${req} Full GLs`,
        percentage: Math.min(100, Math.round((cur / req) * 100)),
      };
    }

    case "team_leader": {
      const req = 4;
      const fullCoords = directChildren.filter((c) => {
        if (c.role !== "coordinator") return false;
        const rank = calculateAgentRank(c, allAgents, new Set(visited));
        return rank.isFull;
      });
      const cur = fullCoords.length;
      return {
        isFull: cur >= req,
        current: cur,
        required: req,
        label: `${cur}/${req} Full Coords`,
        percentage: Math.min(100, Math.round((cur / req) * 100)),
      };
    }

    case "scode":
    default:
      return { isFull: true, current: 0, required: 0, label: "S-Code", percentage: 100 };
  }
}
