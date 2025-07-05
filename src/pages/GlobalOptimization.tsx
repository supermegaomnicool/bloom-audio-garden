import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Star, AlertTriangle, CheckCircle, TrendingUp, FileText, Clock, Users, Target, Zap } from "lucide-react";
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
  channel: Channel;
  score: number;
  stars: number;
  issues: OptimizationIssue[];
  hasTranscript: boolean;
  improvementPotential: number;
}

export const GlobalOptimization = () => {
  const navigate = useNavigate();
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [episodeScores, setEpisodeScores] = useState<EpisodeScore[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchAllData();
  }, []);

  useEffect(() => {
    if (episodes.length > 0 && channels.length > 0) {
      analyzeAllEpisodes();
    }
  }, [episodes, channels]);

  const fetchAllData = async () => {
    try {
      // Fetch all channels
      const { data: channelsData, error: channelsError } = await supabase
        .from("channels")
        .select("*");

      if (channelsError) throw channelsError;
      setChannels(channelsData || []);

      // Fetch all episodes
      const { data: episodesData, error: episodesError } = await supabase
        .from("episodes")
        .select("*")
        .order("published_at", { ascending: false });

      if (episodesError) throw episodesError;
      setEpisodes(episodesData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error loading data",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const analyzeAllEpisodes = () => {
    const channelMap = new Map(channels.map(ch => [ch.id, ch]));
    
    const scores: EpisodeScore[] = episodes.map(episode => {
      const channel = channelMap.get(episode.channel_id);
      if (!channel) return null;

      const issues: OptimizationIssue[] = [];
      let score = 100;

      // Title Analysis
      const title = episode.title || "";
      if (title.length < 30) {
        issues.push({
          type: 'critical',
          category: 'Title',
          message: 'Title too short for SEO',
          suggestion: 'Expand title to 30-60 characters with compelling keywords'
        });
        score -= 20;
      }
      if (title.length > 100) {
        issues.push({
          type: 'warning',
          category: 'Title',
          message: 'Title may be too long',
          suggestion: 'Shorten title to under 100 characters for better display'
        });
        score -= 10;
      }
      
      // Check for vague/weak title words
      const weakWords = ['episode', 'show', 'podcast', 'talk', 'discussion', 'conversation', 'chat', 'interview'];
      const vagueWords = ['thing', 'stuff', 'something', 'anything', 'everything'];
      
      const hasWeakWords = weakWords.some(word => 
        title.toLowerCase().includes(word.toLowerCase())
      );
      const hasVagueWords = vagueWords.some(word => 
        title.toLowerCase().includes(word.toLowerCase())
      );
      
      if (hasWeakWords) {
        issues.push({
          type: 'warning',
          category: 'Title',
          message: 'Title contains generic words',
          suggestion: 'Replace generic podcast terms with specific, compelling keywords'
        });
        score -= 15;
      }
      
      if (hasVagueWords) {
        issues.push({
          type: 'critical',
          category: 'Title',
          message: 'Title contains vague language',
          suggestion: 'Replace vague words with specific, actionable terms that attract clicks'
        });
        score -= 25;
      }

      // Description Analysis - This is CRITICAL for discoverability
      const description = episode.description || "";
      const descriptionText = description.replace(/<[^>]*>/g, '');
      
      if (descriptionText.length < 500) {
        issues.push({
          type: 'critical',
          category: 'Description',
          message: 'MAJOR SEO opportunity missed - description way too short',
          suggestion: `Currently ${descriptionText.length} chars. Aim for 2000-5000 chars with keywords, timestamps, key points, and calls-to-action`
        });
        score -= 35;
      } else if (descriptionText.length < 1500) {
        issues.push({
          type: 'critical',
          category: 'Description',
          message: 'Significant SEO potential untapped',
          suggestion: `At ${descriptionText.length} chars, you could double this with episode highlights, guest bio, and key takeaways`
        });
        score -= 25;
      } else if (descriptionText.length < 3000) {
        issues.push({
          type: 'warning',
          category: 'Description',
          message: 'Good length but could be optimized further',
          suggestion: `${descriptionText.length} chars is decent, but you could add timestamps, related links, or detailed key points`
        });
        score -= 10;
      }

      // First line analysis - CRITICAL for hook
      const firstSentence = descriptionText.split('.')[0] || "";
      const fillerWords = ['um', 'uh', 'like', 'you know', 'basically', 'actually', 'literally', 'obviously', 'so', 'well'];
      const weakOpeners = ['in this episode', 'today we', 'welcome to', 'this week'];
      
      const hasFillerWords = fillerWords.some(word => 
        firstSentence.toLowerCase().includes(` ${word} `) || firstSentence.toLowerCase().startsWith(`${word} `)
      );
      const hasWeakOpener = weakOpeners.some(opener => 
        firstSentence.toLowerCase().includes(opener)
      );
      
      if (hasFillerWords) {
        issues.push({
          type: 'warning',
          category: 'Hook',
          message: 'First line contains filler words',
          suggestion: 'Start with a powerful, direct statement that hooks the reader immediately'
        });
        score -= 15;
      }
      
      if (hasWeakOpener) {
        issues.push({
          type: 'critical',
          category: 'Hook',
          message: 'Weak opening line kills engagement',
          suggestion: 'Start with intrigue, a bold statement, or immediate value instead of generic introductions'
        });
        score -= 20;
      }

      if (firstSentence.length > 200) {
        issues.push({
          type: 'warning',
          category: 'Hook',
          message: 'Opening sentence too long',
          suggestion: 'Break into shorter, punchier sentences that grab attention quickly'
        });
        score -= 10;
      }

      // Missing key metadata
      if (!episode.episode_number) {
        issues.push({
          type: 'warning',
          category: 'Structure',
          message: 'Missing episode numbering',
          suggestion: 'Consistent numbering helps with SEO, organization, and binge-listening'
        });
        score -= 10;
      }

      if (!episode.duration) {
        issues.push({
          type: 'info',
          category: 'Metadata',
          message: 'Missing duration',
          suggestion: 'Duration helps listeners plan their time and improves algorithm recommendations'
        });
        score -= 5;
      }

      // Transcript availability - HUGE for SEO and accessibility
      const hasTranscript = !!episode.transcript;
      if (!hasTranscript) {
        issues.push({
          type: 'critical',
          category: 'SEO & Accessibility',
          message: 'No transcript = missing massive SEO opportunity',
          suggestion: 'Transcripts can 10x your searchability, improve accessibility, and provide content for social media'
        });
        score -= 30;
      }

      // Custom artwork
      if (!episode.artwork_url && !episode.has_custom_artwork) {
        issues.push({
          type: 'warning',
          category: 'Visual Appeal',
          message: 'No custom episode artwork',
          suggestion: 'Custom artwork increases click-through rates and makes episodes more shareable'
        });
        score -= 10;
      }

      // Calculate improvement potential based on what we could do WITH a transcript
      let improvementPotential = 0;
      if (!hasTranscript) {
        improvementPotential += 40; // Transcript could unlock major improvements
      }
      if (descriptionText.length < 2000) {
        improvementPotential += 30; // Could add transcript excerpts, key quotes
      }
      if (hasWeakOpener || hasVagueWords) {
        improvementPotential += 25; // Could craft better hooks from actual content
      }

      score = Math.max(0, score);
      const stars = Math.ceil(score / 20);

      return {
        episode,
        channel,
        score,
        stars: Math.max(1, Math.min(5, stars)),
        issues,
        hasTranscript,
        improvementPotential
      };
    }).filter(Boolean) as EpisodeScore[];

    // Sort by improvement potential first (highest potential first), then by score (lowest first)
    scores.sort((a, b) => {
      if (b.improvementPotential !== a.improvementPotential) {
        return b.improvementPotential - a.improvementPotential;
      }
      return a.score - b.score;
    });

    setEpisodeScores(scores);
  };

  const getStarColor = (stars: number) => {
    if (stars <= 2) return "text-red-500";
    if (stars === 3) return "text-yellow-500";
    return "text-green-500";
  };

  const getPotentialColor = (potential: number) => {
    if (potential >= 60) return "text-green-600 font-bold";
    if (potential >= 40) return "text-yellow-600 font-semibold";
    return "text-gray-600";
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
          {[...Array(5)].map((_, i) => (
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

  const averageScore = episodeScores.length > 0 
    ? episodeScores.reduce((sum, ep) => sum + ep.score, 0) / episodeScores.length 
    : 0;

  const criticalIssues = episodeScores.reduce((sum, ep) => 
    sum + ep.issues.filter(issue => issue.type === 'critical').length, 0
  );

  const episodesWithoutTranscripts = episodeScores.filter(ep => !ep.hasTranscript).length;
  const highPotentialEpisodes = episodeScores.filter(ep => ep.improvementPotential >= 40).length;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={() => navigate("/")} className="p-2">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Target className="h-6 w-6" />
            Global Episode Optimization
          </h1>
          <p className="text-muted-foreground">Find your weakest episodes across all channels</p>
        </div>
      </div>

      {/* Strategy Overview */}
      <Card className="mb-8 border-2 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Optimization Strategy
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="bg-blue-50 p-3 rounded">
              <strong>Step 1:</strong> Identify episodes with highest improvement potential
            </div>
            <div className="bg-yellow-50 p-3 rounded">
              <strong>Step 2:</strong> Add transcripts to high-potential episodes first
            </div>
            <div className="bg-green-50 p-3 rounded">
              <strong>Step 3:</strong> Use transcript content for detailed optimization
            </div>
          </div>
        </CardContent>
      </Card>

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
            <CardTitle className="text-sm font-medium">High Potential Episodes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{highPotentialEpisodes}</div>
            <p className="text-xs text-muted-foreground">40+ improvement points</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Missing Transcripts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{episodesWithoutTranscripts}</div>
            <p className="text-xs text-muted-foreground">Huge SEO opportunity</p>
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
      </div>

      {/* Episodes List - Sorted by Improvement Potential */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Target className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Episodes Ranked by Improvement Potential</h2>
          <Badge variant="secondary" className="text-xs">Highest potential first</Badge>
        </div>

        {episodeScores.slice(0, 50).map((episodeScore, index) => (
          <Card key={episodeScore.episode.id} className="shadow-soft border-border/50">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="text-xs font-bold">
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
                    <Badge 
                      variant="secondary" 
                      className={`text-xs ${getPotentialColor(episodeScore.improvementPotential)}`}
                    >
                      +{episodeScore.improvementPotential} potential
                    </Badge>
                    {!episodeScore.hasTranscript && (
                      <Badge variant="destructive" className="text-xs">
                        No Transcript
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-lg line-clamp-2">
                    {episodeScore.episode.episode_number && `#${episodeScore.episode.episode_number} - `}
                    {episodeScore.episode.title}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-4 mt-2">
                    <span className="flex items-center gap-1 text-xs font-medium">
                      📺 {episodeScore.channel.name}
                    </span>
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
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Top Issues */}
                {episodeScore.issues.slice(0, 3).map((issue, issueIndex) => (
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

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-2 border-t">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => navigate(`/episodes/${episodeScore.channel.id}`)}
                  >
                    View Episode Details
                  </Button>
                  {!episodeScore.hasTranscript && episodeScore.episode.audio_url && (
                    <Button variant="bloom" size="sm">
                      Generate Transcript First
                    </Button>
                  )}
                  {episodeScore.hasTranscript && (
                    <Button variant="bloom" size="sm">
                      Deep Optimize
                    </Button>
                  )}
                </div>

                {/* Quick Stats */}
                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-2 border-t">
                  <span>Description: {(episodeScore.episode.description?.replace(/<[^>]*>/g, '') || "").length} chars</span>
                  <span>Issues: {episodeScore.issues.length}</span>
                  {episodeScore.episode.transcript && <span>✅ Has transcript</span>}
                  {episodeScore.episode.has_custom_artwork && <span>🎨 Custom artwork</span>}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};