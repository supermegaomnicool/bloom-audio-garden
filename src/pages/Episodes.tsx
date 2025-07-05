import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Calendar, Clock, ExternalLink, Play, Search } from "lucide-react";
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
  const [expandedEpisode, setExpandedEpisode] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
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

  // Filter episodes based on search query
  const filteredEpisodes = episodes.filter((episode) => {
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase();
    const searchableText = [
      episode.title,
      episode.description,
      episode.ai_suggested_title,
      episode.ai_suggested_description,
      episode.transcript,
      episode.external_id,
      episode.issues?.join(' '),
      episode.episode_number?.toString(),
      episode.season_number?.toString(),
    ].filter(Boolean).join(' ').toLowerCase();
    
    return searchableText.includes(query);
  });

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
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{channel.name}</h1>
          <p className="text-muted-foreground">
            {filteredEpisodes.length} of {episodes.length} episode{episodes.length !== 1 ? 's' : ''}
            {searchQuery && ` matching "${searchQuery}"`}
          </p>
        </div>
        
        {/* Search Input */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search episodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
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
      ) : filteredEpisodes.length === 0 ? (
        <Card className="shadow-soft border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center">
                <Search className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">No episodes found</h3>
                <p className="text-muted-foreground">
                  No episodes match your search for "{searchQuery}". Try different keywords.
                </p>
              </div>
              <Button variant="outline" onClick={() => setSearchQuery("")}>
                Clear Search
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredEpisodes.map((episode) => (
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
                  {/* Description */}
                  {episode.description && (
                    <div>
                      <h4 className="text-sm font-medium text-foreground mb-2">Description</h4>
                      <div 
                        className={`text-sm text-muted-foreground prose prose-sm max-w-none prose-p:my-2 prose-a:text-primary prose-strong:text-foreground ${expandedEpisode === episode.id ? '' : 'line-clamp-3'}`}
                        dangerouslySetInnerHTML={{ __html: episode.description }}
                      />
                    </div>
                  )}

                  {/* Expanded Details */}
                  {expandedEpisode === episode.id && (
                    <div className="space-y-4 border-t pt-4">
                      {/* AI Suggestions */}
                      {(episode.ai_suggested_title || episode.ai_suggested_description) && (
                        <div>
                          <h4 className="text-sm font-medium text-foreground mb-2">AI Suggestions</h4>
                          <div className="space-y-2">
                            {episode.ai_suggested_title && (
                              <div>
                                <span className="text-xs font-medium text-muted-foreground">Suggested Title:</span>
                                <p className="text-sm">{episode.ai_suggested_title}</p>
                              </div>
                            )}
                            {episode.ai_suggested_description && (
                              <div>
                                <span className="text-xs font-medium text-muted-foreground">Suggested Description:</span>
                                <div 
                                  className="text-sm prose prose-sm max-w-none prose-p:my-1"
                                  dangerouslySetInnerHTML={{ __html: episode.ai_suggested_description }}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Technical Details */}
                      <div>
                        <h4 className="text-sm font-medium text-foreground mb-2">Technical Details</h4>
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          {episode.external_id && (
                            <div>
                              <span className="font-medium text-muted-foreground">External ID:</span>
                              <p className="break-all">{episode.external_id}</p>
                            </div>
                          )}
                          {episode.audio_url && (
                            <div>
                              <span className="font-medium text-muted-foreground">Audio URL:</span>
                              <a href={episode.audio_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">
                                {episode.audio_url.length > 50 ? `${episode.audio_url.substring(0, 50)}...` : episode.audio_url}
                              </a>
                            </div>
                          )}
                          {episode.artwork_url && (
                            <div>
                              <span className="font-medium text-muted-foreground">Artwork URL:</span>
                              <a href={episode.artwork_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">
                                {episode.artwork_url.length > 50 ? `${episode.artwork_url.substring(0, 50)}...` : episode.artwork_url}
                              </a>
                            </div>
                          )}
                          {episode.has_custom_artwork !== null && (
                            <div>
                              <span className="font-medium text-muted-foreground">Custom Artwork:</span>
                              <p>{episode.has_custom_artwork ? 'Yes' : 'No'}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Transcript */}
                      {episode.transcript && (
                        <div>
                          <h4 className="text-sm font-medium text-foreground mb-2">Transcript</h4>
                          <div className="max-h-40 overflow-y-auto bg-muted/30 p-3 rounded text-xs">
                            <p className="whitespace-pre-wrap">{episode.transcript}</p>
                          </div>
                        </div>
                      )}

                      {/* Timestamps */}
                      <div>
                        <h4 className="text-sm font-medium text-foreground mb-2">Timestamps</h4>
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div>
                            <span className="font-medium text-muted-foreground">Created:</span>
                            <p>{episode.created_at ? new Date(episode.created_at).toLocaleString() : 'Unknown'}</p>
                          </div>
                          <div>
                            <span className="font-medium text-muted-foreground">Updated:</span>
                            <p>{episode.updated_at ? new Date(episode.updated_at).toLocaleString() : 'Unknown'}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Basic Stats */}
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

                  {/* Issues */}
                  {episode.issues && episode.issues.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {episode.issues.map((issue, index) => (
                        <Badge key={index} variant="destructive" className="text-xs">
                          {issue}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 pt-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setExpandedEpisode(expandedEpisode === episode.id ? null : episode.id)}
                    >
                      {expandedEpisode === episode.id ? 'Hide Details' : 'View Details'}
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