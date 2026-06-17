import React, { useMemo } from "react";
import { 
  useGetDashboard, getGetDashboardQueryKey,
  useGetUserData, getGetUserDataQueryKey,
  useGetGrades, getGetGradesQueryKey,
  useToggleAssignmentComplete
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { VoiceInterface } from "@/components/VoiceInterface";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Target, AlertTriangle, CheckSquare, BarChart, BookOpen, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function Dashboard() {
  const queryClient = useQueryClient();
  
  const { data: dashboard, isLoading: dashLoading } = useGetDashboard({ query: { queryKey: getGetDashboardQueryKey() } });
  const { data: userData, isLoading: userLoading } = useGetUserData({ query: { queryKey: getGetUserDataQueryKey() } });
  const { data: grades, isLoading: gradesLoading } = useGetGrades({ query: { queryKey: getGetGradesQueryKey() } });
  
  const toggleAssignment = useToggleAssignmentComplete();

  const handleToggleComplete = (id: string) => {
    toggleAssignment.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetUserDataQueryKey() });
        }
      }
    );
  };

  const upcomingAssignments = useMemo(() => {
    if (!userData) return [];
    return userData.courses.flatMap(c => c.assignments || [])
      .filter(a => !a.completed && a.dueDate && new Date(a.dueDate) > new Date())
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
      .slice(0, 5);
  }, [userData]);

  const handleCommandSuccess = () => {
    queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetUserDataQueryKey() });
  };

  if (dashLoading || userLoading || gradesLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
        <div className="lg:col-span-2 space-y-6">
          <Skeleton className="h-32 w-full bg-card border border-border" />
          <Skeleton className="h-64 w-full bg-card border border-border" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-[500px] w-full bg-card border border-border" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] gap-6 animate-in fade-in duration-500">
      
      {/* Top Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 shrink-0">
        <StatCard 
          title="Upcoming Due" 
          value={dashboard?.upcomingCount ?? 0} 
          icon={<Clock className="w-5 h-5 text-primary" />} 
        />
        <StatCard 
          title="Overdue" 
          value={dashboard?.overdueCount ?? 0} 
          icon={<AlertTriangle className="w-5 h-5 text-destructive" />} 
          highlight={!!dashboard?.overdueCount && dashboard.overdueCount > 0}
        />
        <StatCard 
          title="Tasks Cleared" 
          value={dashboard?.completedCount ?? 0} 
          icon={<CheckSquare className="w-5 h-5 text-emerald-500" />} 
        />
        <StatCard 
          title="Global Average" 
          value={dashboard?.avgGrade ? `${dashboard.avgGrade.toFixed(1)}%` : "N/A"} 
          icon={<BarChart className="w-5 h-5 text-primary" />} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        
        {/* Left Column: Tasks & Grades */}
        <div className="lg:col-span-2 flex flex-col gap-6 min-h-0">
          
          {/* Action Center - Next Due */}
          <Card className="rounded-none border-primary/30 bg-card shadow-[0_0_20px_rgba(255,68,68,0.05)] shrink-0 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
            <CardHeader className="pb-2">
              <CardTitle className="font-mono text-sm tracking-widest text-muted-foreground uppercase flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" /> Prime Objective
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dashboard?.nextDue ? (
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold font-sans text-foreground">{dashboard.nextDue.name}</h3>
                    <p className="font-mono text-xs text-muted-foreground mt-1">
                      {dashboard.nextDue.courseName} • Due: {format(new Date(dashboard.nextDue.dueDate!), "MMM d, h:mm a")}
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    className="font-mono uppercase tracking-widest border-primary text-primary hover:bg-primary hover:text-primary-foreground rounded-none"
                    onClick={() => handleToggleComplete(dashboard.nextDue!.id)}
                  >
                    Mark Complete
                  </Button>
                </div>
              ) : (
                <div className="text-muted-foreground font-mono text-sm">No critical tasks in queue.</div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 min-h-0">
            {/* Upcoming List */}
            <Card className="rounded-none border-border bg-card flex flex-col h-full overflow-hidden">
              <CardHeader className="border-b border-border bg-background pb-4 shrink-0">
                <CardTitle className="font-mono text-sm tracking-widest uppercase flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" /> Task Queue
                </CardTitle>
              </CardHeader>
              <ScrollArea className="flex-1">
                <div className="p-0">
                  {upcomingAssignments.length > 0 ? (
                    <div className="divide-y divide-border">
                      {upcomingAssignments.map((task) => (
                        <div key={task.id} className="p-4 hover:bg-muted/50 transition-colors flex items-start gap-4">
                          <button 
                            onClick={() => handleToggleComplete(task.id)}
                            className="w-5 h-5 mt-0.5 border border-primary shrink-0 flex items-center justify-center text-background hover:bg-primary/20 transition-colors"
                          >
                          </button>
                          <div>
                            <h4 className="font-sans text-sm font-semibold">{task.name}</h4>
                            <p className="font-mono text-[10px] text-muted-foreground uppercase mt-1">
                              {task.courseName}
                            </p>
                            <p className="font-mono text-[10px] text-primary mt-1">
                              DUE: {task.dueDate ? format(new Date(task.dueDate), "MMM d") : "N/A"}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center font-mono text-sm text-muted-foreground">Queue Empty.</div>
                  )}
                </div>
              </ScrollArea>
            </Card>

            {/* Grades List */}
            <Card className="rounded-none border-border bg-card flex flex-col h-full overflow-hidden">
              <CardHeader className="border-b border-border bg-background pb-4 shrink-0">
                <CardTitle className="font-mono text-sm tracking-widest uppercase flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" /> Academic Status
                </CardTitle>
              </CardHeader>
              <ScrollArea className="flex-1">
                <div className="p-0">
                  {grades?.grades && grades.grades.length > 0 ? (
                    <div className="divide-y divide-border">
                      {grades.grades.map((grade) => (
                        <div key={grade.courseId} className="p-4 flex items-center justify-between">
                          <h4 className="font-mono text-xs text-muted-foreground uppercase w-3/4 truncate pr-4">{grade.name}</h4>
                          <div className="font-mono text-sm font-bold text-foreground">
                            {grade.currentScore ? `${grade.currentScore.toFixed(1)}%` : "N/A"}
                            {grade.letterGrade && <span className="ml-2 text-primary">{grade.letterGrade}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center font-mono text-sm text-muted-foreground">No grade data available.</div>
                  )}
                </div>
              </ScrollArea>
            </Card>
          </div>

        </div>

        {/* Right Column: CARVIS Terminal */}
        <div className="lg:col-span-1 h-full min-h-[500px]">
          <VoiceInterface onCommandSuccess={handleCommandSuccess} />
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, highlight = false }: { title: string, value: string | number, icon: React.ReactNode, highlight?: boolean }) {
  return (
    <Card className={`rounded-none border-border bg-card ${highlight ? 'border-destructive shadow-[0_0_15px_rgba(255,0,0,0.1)]' : ''}`}>
      <CardContent className="p-4 flex items-center gap-4">
        <div className={`w-10 h-10 flex items-center justify-center bg-background border ${highlight ? 'border-destructive' : 'border-border'}`}>
          {icon}
        </div>
        <div>
          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-1">{title}</p>
          <p className={`text-2xl font-bold font-mono ${highlight ? 'text-destructive' : 'text-foreground'}`}>{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}