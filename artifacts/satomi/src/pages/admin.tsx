import { useGetSatomiStatus, useGetSatomiStats, useTestSatomi, useGetSatomiLogs } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Activity, MessageSquare, Zap, Clock, Send, RefreshCw, Radio } from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function Admin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: status, isLoading: statusLoading } = useGetSatomiStatus({ query: { refetchInterval: 5000, queryKey: ["/api/satomi/status"] } });
  const { data: stats, isLoading: statsLoading } = useGetSatomiStats({ query: { refetchInterval: 5000, queryKey: ["/api/satomi/stats"] } });
  const { data: logs, isLoading: logsLoading } = useGetSatomiLogs({ query: { refetchInterval: 3000, queryKey: ["/api/satomi/logs"] } });

  const testSatomi = useTestSatomi();

  const [testUsername, setTestUsername] = useState("degen_bob");
  const [testMessage, setTestMessage] = useState("satomi what do you think about this token");

  const handleTestTrigger = () => {
    if (!testUsername || !testMessage) return;
    testSatomi.mutate(
      { data: { username: testUsername, message: testMessage } },
      {
        onSuccess: () => {
          toast({ title: "Test Trigger Sent", description: "Satomi should respond on stream shortly" });
          setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ["/api/satomi/logs"] });
            queryClient.invalidateQueries({ queryKey: ["/api/satomi/stats"] });
          }, 500);
        },
        onError: () => {
          toast({ title: "Test Failed", description: "Could not send test trigger", variant: "destructive" });
        }
      }
    );
  };

  const formatUptime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h}h ${m}m ${s}s`;
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-6 pb-24 md:p-10 font-mono">
      <div className="max-w-6xl mx-auto space-y-8">

        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 pb-6">
          <div>
            <h1 className="text-3xl font-bold text-primary tracking-tight">SATOMI_ADMIN_PANEL</h1>
            <p className="text-muted-foreground mt-1">Twitter Livestream Overlay Control Center</p>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-4 py-2 shadow-sm">
              <Radio className={`w-4 h-4 ${status?.connected ? "text-green-500 animate-pulse" : "text-destructive"}`} />
              <span className="text-sm font-medium">WS {status?.connected ? "CONNECTED" : "DISCONNECTED"}</span>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                Stream Uptime
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statusLoading ? "..." : status?.uptime ? formatUptime(status.uptime) : "0h 0m 0s"}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-blue-500" />
                Messages Read
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statsLoading ? "..." : stats?.messagesReceived?.toLocaleString() || 0}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-accent" />
                "Satomi" Triggers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statsLoading ? "..." : stats?.triggerCount?.toLocaleString() || 0}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-green-500" />
                AI Responses
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statsLoading ? "..." : stats?.responsesGenerated?.toLocaleString() || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="w-4 h-4 text-accent" />
                  Manual Test
                </CardTitle>
                <CardDescription>Force trigger an AI response</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Username</label>
                  <Input
                    value={testUsername}
                    onChange={(e) => setTestUsername(e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Message</label>
                  <Input
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={handleTestTrigger}
                  disabled={testSatomi.isPending || !testUsername || !testMessage}
                >
                  {testSatomi.isPending ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                  Fire Test Trigger
                </Button>
              </CardContent>
            </Card>

          </div>

          <div className="lg:col-span-2">
            <Card className="h-full border-border/50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  <span>Live Response Log</span>
                  <Badge variant="outline" className="font-mono">{logs?.length || 0} recent</Badge>
                </CardTitle>
                <CardDescription>Recent AI generations sent to TTS</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-muted/30 rounded-md border border-border/50 h-[500px] overflow-y-auto p-4 space-y-4">
                  {logsLoading ? (
                    <div className="text-center text-muted-foreground p-8 animate-pulse">Loading logs...</div>
                  ) : logs && logs.length > 0 ? (
                    logs.map((log, idx: number) => (
                      <div key={idx} className="bg-card border border-border/60 rounded p-3 text-sm space-y-2 shadow-sm">
                        <div className="flex justify-between items-start">
                          <span className="font-bold text-secondary">@{log.username}</span>
                          <span className="text-xs text-muted-foreground">{new Date(log.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <div className="text-muted-foreground pl-2 border-l-2 border-border mb-2 italic">
                          "{log.question}"
                        </div>
                        <div className="text-foreground pl-2 border-l-2 border-primary">
                          {log.response}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-muted-foreground p-8 italic">No responses logged yet.</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

      </div>
    </div>
  );
}
