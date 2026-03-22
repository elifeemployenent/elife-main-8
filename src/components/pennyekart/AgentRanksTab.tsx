import { useMemo, useState } from "react";
import { PennyekartAgent, ROLE_LABELS, ROLE_HIERARCHY, AgentRole } from "@/hooks/usePennyekartAgents";
import { calculateAgentRank, AgentRankInfo } from "@/lib/agentRank";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Trophy, Star, AlertTriangle, Search, Users, Phone, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

interface Panchayath {
  id: string;
  name: string;
}

interface AgentRanksTabProps {
  agents: PennyekartAgent[];
  allAgents: PennyekartAgent[];
  panchayaths: Panchayath[];
  onSelectAgent: (agent: PennyekartAgent) => void;
}

type RankFilter = "all" | "full" | "incomplete";

export function AgentRanksTab({ agents, allAgents, panchayaths, onSelectAgent }: AgentRanksTabProps) {
  const [roleFilter, setRoleFilter] = useState<AgentRole | "all">("all");
  const [rankFilter, setRankFilter] = useState<RankFilter>("all");
  const [panchayathFilter, setPanchayathFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  // Use allAgents for rank calculation so descendants across panchayaths are included
  const rankedAgents = useMemo(() => {
    return agents
      .filter(a => a.role !== "scode")
      .map(agent => ({
        agent,
        rank: calculateAgentRank(agent, allAgents),
      }))
      .sort((a, b) => a.rank.percentage - b.rank.percentage);
  }, [agents, allAgents]);

  const filtered = useMemo(() => {
    return rankedAgents.filter(({ agent, rank }) => {
      if (roleFilter !== "all" && agent.role !== roleFilter) return false;
      if (rankFilter === "full" && !rank.isFull) return false;
      if (rankFilter === "incomplete" && rank.isFull) return false;
      if (panchayathFilter !== "all" && agent.panchayath_id !== panchayathFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!agent.name.toLowerCase().includes(q) && !agent.mobile.includes(q)) return false;
      }
      return true;
    });
  }, [rankedAgents, roleFilter, rankFilter, panchayathFilter, search]);

  // Summary stats
  const summary = useMemo(() => {
    const roles: AgentRole[] = ["pro", "group_leader", "coordinator", "team_leader"];
    return roles.map(role => {
      const roleAgents = rankedAgents.filter(r => r.agent.role === role);
      const full = roleAgents.filter(r => r.rank.isFull).length;
      return { role, total: roleAgents.length, full, incomplete: roleAgents.length - full };
    });
  }, [rankedAgents]);

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {summary.map(({ role, total, full, incomplete }) => (
          <Card key={role} className="p-2.5 sm:p-3">
            <div className="text-[10px] sm:text-xs text-muted-foreground mb-1">{ROLE_LABELS[role]}s</div>
            <div className="flex items-center gap-2">
              <span className="text-base sm:text-lg font-bold">{full}/{total}</span>
              <span className="text-[10px] text-muted-foreground">full rank</span>
            </div>
            {total > 0 && (
              <Progress value={(full / total) * 100} className="h-1.5 mt-1.5" />
            )}
            {incomplete > 0 && (
              <div className="flex items-center gap-1 mt-1">
                <AlertTriangle className="h-3 w-3 text-amber-500" />
                <span className="text-[10px] text-amber-600 dark:text-amber-400">{incomplete} incomplete</span>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[150px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search agent..."
            className="pl-9 h-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as AgentRole | "all")}>
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {(["pro", "group_leader", "coordinator", "team_leader"] as AgentRole[]).map(r => (
              <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={rankFilter} onValueChange={(v) => setRankFilter(v as RankFilter)}>
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue placeholder="Rank" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Ranks</SelectItem>
            <SelectItem value="full">Full Rank ✅</SelectItem>
            <SelectItem value="incomplete">Incomplete ⚠️</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results count */}
      <div className="text-xs text-muted-foreground">
        Showing {filtered.length} of {rankedAgents.length} agents
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs w-[30px]">#</TableHead>
                <TableHead className="text-xs">Agent</TableHead>
                <TableHead className="text-xs hidden sm:table-cell">Role</TableHead>
                <TableHead className="text-xs hidden sm:table-cell">Panchayath</TableHead>
                <TableHead className="text-xs">Rank</TableHead>
                <TableHead className="text-xs w-[100px]">Progress</TableHead>
                <TableHead className="text-xs">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-sm">
                    No agents found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(({ agent, rank }, i) => (
                  <TableRow
                    key={agent.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => onSelectAgent(agent)}
                  >
                    <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                    <TableCell>
                      <div className="min-w-0">
                        <div className="font-medium text-xs sm:text-sm truncate max-w-[120px] sm:max-w-none">{agent.name}</div>
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Phone className="h-2.5 w-2.5" />
                          {agent.mobile}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="outline" className="text-[10px]">
                        {ROLE_LABELS[agent.role]}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                      {agent.panchayath?.name || "–"}
                    </TableCell>
                    <TableCell className="text-xs">{rank.label}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 min-w-[80px]">
                        <Progress
                          value={rank.percentage}
                          className={cn("h-2 flex-1", rank.isFull ? "[&>div]:bg-emerald-500" : rank.percentage < 50 ? "[&>div]:bg-red-500" : "[&>div]:bg-amber-500")}
                        />
                        <span className="text-[10px] w-8 text-right">{rank.percentage}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {rank.isFull ? (
                        <Badge className="text-[10px] px-1.5 py-0 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 gap-0.5">
                          <Trophy className="h-2.5 w-2.5" />
                          Full
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-amber-600 dark:text-amber-400 border-amber-300 gap-0.5">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          Incomplete
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
