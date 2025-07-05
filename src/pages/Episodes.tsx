import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, Clock, ExternalLink, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tables } from "@/integrations/supabase/types";

type Episode = Tables<"episodes">;
type Channel = Tables<"channels">;

export const Episodes = () => {
  const { channelId } = useParams<{ channelId: string }>();
  const navigate = useNavigate();
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (channelId) {
      fetchChannelAndEpisodes();
    }
  }, [channelId]);

  const fetchChannelAndEpisodes = async () => {
    try {
      // Fetch channel info
      const { data: channelData, error: channelError } = await supabase
        .from("channels")
        .select("*")
        .eq("id", channelId)
        .single();

      if (channelError) {
        throw channelError;
      }

      setChannel(channelData);

      // Fetch episodes
      const { data: episodesData, error: episodesError } = await supabase
        .from("episodes")
        .select("*")
        .eq("channel_id", channelId)
        .order("published_at", { ascending: false });

      if (episodesError) {
        throw episodesError;
      }

      setEpisodes(episodesData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error loading episodes",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (duration: string | null) => {
    if (!duration) return "Unknown";
    // Assuming duration is in format like "00:45:30" or similar
    return duration;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "Unknown";
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
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
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">Channel not found</p>
            <Button onClick={() => navigate("/")} className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={() => navigate("/")} className="p-2">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{channel.name}</h1>
          <p className="text-muted-foreground">
            {episodes.length} episode{episodes.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Episodes List */}
      {episodes.length === 0 ? (
        <Card className="shadow-soft border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center">
                <Play className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">No episodes yet</h3>
                <p className="text-muted-foreground">
                  Episodes will appear here once they're imported from the RSS feed.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {episodes.map((episode) => (
            <Card key={episode.id} className="shadow-soft border-border/50 hover:shadow-natural transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg line-clamp-2">{episode.title}</CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-2">
                      {episode.published_at && (
                        <span className="flex items-center gap-1 text-xs">
                          <Calendar className="h-3 w-3" />
                          {new Date(episode.published_at).toLocaleDateString()}
                        </span>
                      )}
                      {episode.duration && (
                        <span className="flex items-center gap-1 text-xs">
                          <Clock className="h-3 w-3" />
                          {formatDuration(episode.duration)}
                        </span>
                      )}
                      {episode.optimization_score && (
                        <Badge variant="secondary" className="text-xs">
                          Score: {episode.optimization_score}%
                        </Badge>
                      )}
                    </CardDescription>
                  </div>
                  {episode.audio_url && (
                    <Button variant="ghost" size="icon" asChild>
                      <a href={episode.audio_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {episode.description && (
                    <div 
                      className="text-sm text-muted-foreground line-clamp-3 prose prose-sm max-w-none prose-p:my-2 prose-a:text-primary prose-strong:text-foreground"
                      dangerouslySetInnerHTML={{ __html: episode.description }}
                    />
                  )}
                  
                  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                    {episode.episode_number && (
                      <span>Episode #{episode.episode_number}</span>
                    )}
                    {episode.season_number && (
                      <span>Season {episode.season_number}</span>
                    )}
                    {episode.file_size && (
                      <span>{formatFileSize(episode.file_size)}</span>
                    )}
                    {episode.view_count !== null && (
                      <span>{episode.view_count.toLocaleString()} views</span>
                    )}
                    {episode.download_count !== null && (
                      <span>{episode.download_count.toLocaleString()} downloads</span>
                    )}
                  </div>

                  {episode.issues && episode.issues.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {episode.issues.map((issue, index) => (
                        <Badge key={index} variant="destructive" className="text-xs">
                          {issue}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-2">
                    <Button variant="outline" size="sm">
                      View Details
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
      )}
    </div>
  );
};