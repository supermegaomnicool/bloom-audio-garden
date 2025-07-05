import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Youtube, Video, Users, Calendar, TrendingUp, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";

type Channel = Tables<"channels">;

export const ChannelList = () => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchChannels();
  }, []);

  const fetchChannels = async () => {
    try {
      const { data, error } = await supabase
        .from("channels")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching channels:", error);
        return;
      }

      setChannels(data || []);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-4 bg-muted rounded w-3/4"></div>
              <div className="h-3 bg-muted rounded w-1/2"></div>
            </CardHeader>
            <CardContent>
              <div className="h-20 bg-muted rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (channels.length === 0) {
    return (
      <Card className="shadow-soft border-border/50">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center">
              <Video className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">No channels yet</h3>
              <p className="text-muted-foreground">
                Add your first YouTube channel or podcast RSS feed to get started with content optimization.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {channels.map((channel) => (
        <Card key={channel.id} className="shadow-soft border-border/50 hover:shadow-natural transition-shadow">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                {channel.type === "youtube" ? (
                  <Youtube className="h-5 w-5 text-red-500" />
                ) : (
                  <Video className="h-5 w-5 text-primary" />
                )}
                <div>
                  <CardTitle className="text-lg">{channel.name}</CardTitle>
                  <CardDescription className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {channel.type.toUpperCase()}
                    </Badge>
                    {channel.subscriber_count && (
                      <span className="text-xs text-muted-foreground">
                        {channel.subscriber_count.toLocaleString()} subscribers
                      </span>
                    )}
                  </CardDescription>
                </div>
              </div>
              <Button variant="ghost" size="icon" asChild>
                <a href={channel.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {channel.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {channel.description}
                </p>
              )}
              
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Video className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Episodes:</span>
                  <span className="font-medium">{channel.total_episodes || 0}</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Score:</span>
                  <span className="font-medium">
                    {channel.avg_optimization_score ? `${channel.avg_optimization_score}%` : "Not analyzed"}
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Last sync:</span>
                  <span className="font-medium">
                    {channel.last_imported_at 
                      ? new Date(channel.last_imported_at).toLocaleDateString()
                      : "Never"
                    }
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Button variant="outline" size="sm">
                  View Episodes
                </Button>
                <Button variant="outline" size="sm">
                  Sync Now
                </Button>
                <Button variant="bloom" size="sm">
                  Optimize
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};