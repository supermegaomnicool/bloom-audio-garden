import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Star, AlertTriangle, CheckCircle, TrendingUp, FileText, Clock, Users, X, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tables } from "@/integrations/supabase/types";

type Episode = Tables<"episodes">;
type Channel = Tables<"channels">;

interface OptimizationIssue {
  type: 'critical' | 'warning' | 'info';
  category: string;
  message: string;
  suggestion: string;
}

interface EpisodeScore {
  episode: Episode;
  score: number;
  stars: number;
  issues: OptimizationIssue[];
}

export const ChannelOptimization = () => {
  const { channelId } = useParams<{ channelId: string }>();
  const navigate = useNavigate();
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [loading, setLoading] = useState(true);
  const [episodeScores, setEpisodeScores] = useState<EpisodeScore[]>([]);
  const [excludeDialog, setExcludeDialog] = useState<string | null>(null);
  const [exclusionNotes, setExclusionNotes] = useState("");
  const [showExcluded, setShowExcluded] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (channelId) {
      fetchChannelAndEpisodes();
    }
  }, [channelId]);

  useEffect(() => {
    if (episodes.length > 0) {
      analyzeEpisodes();
    }
  }, [episodes, showExcluded]);

  const fetchChannelAndEpisodes = async () => {
    try {
      // Fetch channel info
      const { data: channelData, error: channelError } = await supabase
        .from("channels")
        .select("*")
        .eq("id", channelId)
        .single();

      if (channelError) throw channelError;
      setChannel(channelData);

      // Fetch episodes
      const { data: episodesData, error: episodesError } = await supabase
        .from("episodes")
        .select("*")
        .eq("channel_id", channelId)
        .order("published_at", { ascending: false });

      if (episodesError) throw episodesError;
      setEpisodes(episodesData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error loading channel data",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExcludeEpisode = async (episodeId: string, exclude: boolean, notes: string = "") => {
    try {
      const { error } = await supabase
        .from('episodes')
        .update({ 
          excluded: exclude,
          exclusion_notes: exclude ? notes : null
        })
        .eq('id', episodeId);

      if (error) throw error;

      // Update local state
      setEpisodes(prevEpisodes => prevEpisodes.map(episode => 
        episode.id === episodeId 
          ? { ...episode, excluded: exclude, exclusion_notes: exclude ? notes : null }
          : episode
      ));

      toast({
        title: exclude ? "Episode Excluded" : "Episode Restored",
        description: exclude 
          ? "Episode has been excluded from optimization" 
          : "Episode has been restored to optimization list",
      });

      setExcludeDialog(null);
      setExclusionNotes("");
    } catch (error) {
      console.error("Error updating episode:", error);
      toast({
        title: "Error",
        description: "Failed to update episode status",
        variant: "destructive",
      });
    }
  };

  const analyzeEpisodes = () => {
    // Filter episodes based on exclusion status
    const episodesToAnalyze = showExcluded ? episodes : episodes.filter(ep => !ep.excluded);
    
    const scores: EpisodeScore[] = episodesToAnalyze.map(episode => {
      const issues: OptimizationIssue[] = [];
      let score = 100;

      // Title Analysis
      const title = episode.title || "";
      if (title.length < 30) {
        issues.push({
          type: 'warning',
          category: 'Title',
          message: 'Title may be too short',
          suggestion: 'Consider expanding the title to 30-60 characters for better SEO and clarity'
        });
        score -= 15;
      }
      if (title.length > 100) {
        issues.push({
          type: 'warning',
          category: 'Title',
          message: 'Title may be too long',
          suggestion: 'Shorten title to under 100 characters for better display across platforms'
        });
        score -= 10;
      }
      
      // Check for vague words in title
      const vagueWords = ['episode', 'show', 'podcast', 'talk', 'discussion', 'conversation'];
      const hasVagueWords = vagueWords.some(word => 
        title.toLowerCase().includes(word.toLowerCase())
      );
      if (hasVagueWords) {
        issues.push({
          type: 'info',
          category: 'Title',
          message: 'Title contains generic words',
          suggestion: 'Replace generic words with specific, compelling keywords that describe the content'
        });
        score -= 5;
      }

      // Description Analysis
      const description = episode.description || "";
      const descriptionText = description.replace(/<[^>]*>/g, ''); // Remove HTML tags
      
      if (descriptionText.length < 500) {
        issues.push({
          type: 'critical',
          category: 'Description',
          message: 'Description is significantly under the 7000 character limit',
          suggestion: `Current: ${descriptionText.length} chars. Add more detail, keywords, timestamps, or call-to-actions to reach closer to 7000 characters`
        });
        score -= 25;
      } else if (descriptionText.length < 2000) {
        issues.push({
          type: 'warning',
          category: 'Description',
          message: 'Description could be longer for better SEO',
          suggestion: `Current: ${descriptionText.length} chars. Consider adding more context, guest info, or key takeaways`
        });
        score -= 15;
      }

      // First sentence analysis
      const firstSentence = descriptionText.split('.')[0] || "";
      const fillerWords = ['um', 'uh', 'like', 'you know', 'basically', 'actually', 'literally', 'obviously'];
      const hasFillerWords = fillerWords.some(word => 
        firstSentence.toLowerCase().includes(word)
      );
      if (hasFillerWords) {
        issues.push({
          type: 'warning',
          category: 'Opening',
          message: 'First sentence contains filler words',
          suggestion: 'Remove filler words from the opening to create a stronger, more direct introduction'
        });
        score -= 10;
      }

      if (firstSentence.length > 200) {
        issues.push({
          type: 'info',
          category: 'Opening',
          message: 'First sentence is very long',
          suggestion: 'Consider breaking the opening into shorter, punchier sentences for better readability'
        });
        score -= 5;
      }

      // Episode numbering consistency
      if (!episode.episode_number) {
        issues.push({
          type: 'warning',
          category: 'Structure',
          message: 'Missing episode number',
          suggestion: 'Add consistent episode numbering for better organization and SEO'
        });
        score -= 10;
      }

      // Duration analysis
      if (!episode.duration) {
        issues.push({
          type: 'info',
          category: 'Metadata',
          message: 'Missing duration information',
          suggestion: 'Duration helps listeners plan their time and improves platform recommendations'
        });
        score -= 5;
      }

      // Artwork analysis
      if (!episode.artwork_url && !episode.has_custom_artwork) {
        issues.push({
          type: 'info',
          category: 'Visual',
          message: 'No custom episode artwork',
          suggestion: 'Custom artwork for each episode can improve click-through rates and engagement'
        });
        score -= 5;
      }

      // Transcript availability
      if (!episode.transcript) {
        issues.push({
          type: 'warning',
          category: 'Accessibility',
          message: 'No transcript available',
          suggestion: 'Transcripts improve accessibility and SEO significantly'
        });
        score -= 15;
      }

      // Ensure score doesn't go below 0
      score = Math.max(0, score);
      const stars = Math.ceil(score / 20); // Convert to 5-star system

      return {
        episode,
        score,
        stars: Math.max(1, Math.min(5, stars)),
        issues
      };
    });

    // Sort by score (lowest first)
    scores.sort((a, b) => a.score - b.score);
    setEpisodeScores(scores);
  };

  const getStarColor = (stars: number) => {
    if (stars <= 2) return "text-red-500";
    if (stars === 3) return "text-yellow-500";
    return "text-green-500";
  };

  const getIssueIcon = (type: OptimizationIssue['type']) => {
    switch (type) {
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'info':
        return <CheckCircle className="h-4 w-4 text-blue-500" />;
    }
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

  const averageScore = episodeScores.length > 0 
    ? episodeScores.reduce((sum, ep) => sum + ep.score, 0) / episodeScores.length 
    : 0;

  const criticalIssues = episodeScores.reduce((sum, ep) => 
    sum + ep.issues.filter(issue => issue.type === 'critical').length, 0
  );

  const warningIssues = episodeScores.reduce((sum, ep) => 
    sum + ep.issues.filter(issue => issue.type === 'warning').length, 0
  );

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={() => navigate(`/episodes/${channelId}`)} className="p-2">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="h-6 w-6" />
            Channel Optimization
          </h1>
          <p className="text-muted-foreground">{channel.name}</p>
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowExcluded(!showExcluded)}
          className="flex items-center gap-2"
        >
          {showExcluded ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {showExcluded ? 'Hide' : 'Show'} Excluded ({episodes.filter(e => e.excluded).length})
        </Button>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(averageScore)}%</div>
            <Progress value={averageScore} className="mt-2" />
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Critical Issues</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{criticalIssues}</div>
            <p className="text-xs text-muted-foreground">Need immediate attention</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Warning Issues</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">{warningIssues}</div>
            <p className="text-xs text-muted-foreground">Could be improved</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Episodes Analyzed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{episodeScores.length}</div>
            <p className="text-xs text-muted-foreground">Total episodes</p>
          </CardContent>
        </Card>
      </div>

      {/* Episodes List */}
      <div className="space-y-4">
        {episodeScores.map((episodeScore, index) => (
          <Card key={episodeScore.episode.id} className={`shadow-soft border-border/50 ${episodeScore.episode.excluded ? 'opacity-60 border-muted' : ''}`}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="text-xs">
                      #{index + 1} Priority
                    </Badge>
                    <div className={`flex items-center gap-1 ${getStarColor(episodeScore.stars)}`}>
                      {[...Array(5)].map((_, i) => (
                        <Star 
                          key={i} 
                          className={`h-4 w-4 ${i < episodeScore.stars ? 'fill-current' : ''}`} 
                        />
                      ))}
                    </div>
                    <span className="text-sm font-medium">{episodeScore.score}%</span>
                    {episodeScore.episode.excluded && (
                      <Badge variant="secondary" className="text-xs bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400">
                        Excluded
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-lg line-clamp-2">
                    {episodeScore.episode.episode_number && `#${episodeScore.episode.episode_number} - `}
                    {episodeScore.episode.title}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-2">
                    {episodeScore.episode.published_at && (
                      <span className="flex items-center gap-1 text-xs">
                        <Clock className="h-3 w-3" />
                        {new Date(episodeScore.episode.published_at).toLocaleDateString()}
                      </span>
                    )}
                    {episodeScore.episode.duration && (
                      <span className="flex items-center gap-1 text-xs">
                        <FileText className="h-3 w-3" />
                        {episodeScore.episode.duration}
                      </span>
                    )}
                  </CardDescription>
                  
                  {episodeScore.episode.exclusion_notes && (
                    <div className="mt-2 p-2 bg-muted/50 rounded text-sm">
                      <span className="text-muted-foreground font-medium">Exclusion reason: </span>
                      {episodeScore.episode.exclusion_notes}
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-2 ml-4">
                  {!episodeScore.episode.excluded ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setExcludeDialog(episodeScore.episode.id)}
                      className="text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/20"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Exclude
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExcludeEpisode(episodeScore.episode.id, false)}
                      className="text-green-600 border-green-200 hover:bg-green-50 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-900/20"
                    >
                      Restore
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Issues */}
                {episodeScore.issues.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-foreground mb-3">Issues & Suggestions</h4>
                    <div className="space-y-3">
                      {episodeScore.issues.map((issue, issueIndex) => (
                        <div key={issueIndex} className="flex gap-3 p-3 bg-muted/30 rounded-lg">
                          {getIssueIcon(issue.type)}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-xs">
                                {issue.category}
                              </Badge>
                              <span className="text-sm font-medium">{issue.message}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">{issue.suggestion}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quick Stats */}
                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-2 border-t">
                  <span>Description: {(episodeScore.episode.description?.replace(/<[^>]*>/g, '') || "").length} chars</span>
                  {episodeScore.episode.transcript && <span>Has transcript</span>}
                  {episodeScore.episode.has_custom_artwork && <span>Custom artwork</span>}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Exclude Episode Dialog */}
      <Dialog open={!!excludeDialog} onOpenChange={(open) => !open && setExcludeDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Exclude Episode</DialogTitle>
            <DialogDescription>
              This episode will be excluded from optimization analysis. Please provide a reason.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="exclusion-notes">Reason for exclusion</Label>
              <Textarea
                id="exclusion-notes"
                placeholder="e.g., This is a trailer episode that only conveys basic information..."
                value={exclusionNotes}
                onChange={(e) => setExclusionNotes(e.target.value)}
                className="mt-2"
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setExcludeDialog(null);
                setExclusionNotes("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (excludeDialog) {
                  handleExcludeEpisode(excludeDialog, true, exclusionNotes);
                }
              }}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Exclude Episode
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};