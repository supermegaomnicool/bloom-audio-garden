import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Lightbulb, Sparkles, RefreshCw, Save, Loader2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { IdeaChatbot } from "@/components/IdeaChatbot";

interface Episode {
  id: string;
  title: string;
  description: string | null;
  transcript: string | null;
}

interface ContentIdea {
  id: string;
  episode_id: string;
  generated_ideas: string[];
  saved_ideas: number[];
  user_notes: string | null;
}

export const Ideas = () => {
  const navigate = useNavigate();
  const { channelId } = useParams<{ channelId: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const [channel, setChannel] = useState<{ id: string; name: string } | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null);
  const [contentIdeas, setContentIdeas] = useState<ContentIdea | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userNotes, setUserNotes] = useState("");

  useEffect(() => {
    if (channelId) {
      fetchChannelAndEpisodes();
    }
  }, [channelId, user]);

  useEffect(() => {
    if (channelId && channel) {
      fetchContentIdeas();
    }
  }, [channelId, channel]);

  const fetchChannelAndEpisodes = async () => {
    if (!user || !channelId) return;

    try {
      // Fetch channel info
      const { data: channelData, error: channelError } = await supabase
        .from('channels')
        .select('id, name')
        .eq('id', channelId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (channelError) throw channelError;
      
      if (!channelData) {
        toast({
          title: "Channel not found",
          description: "This channel doesn't exist or you don't have access to it.",
          variant: "destructive",
        });
        navigate("/");
        return;
      }
      
      setChannel(channelData);

      // Fetch ALL episodes for this channel for comprehensive analysis
      const { data: episodesData, error: episodesError } = await supabase
        .from('episodes')
        .select(`
          id,
          title,
          description,
          transcript
        `)
        .eq('channel_id', channelId)
        .eq('user_id', user.id)
        .order('published_at', { ascending: false });

      if (episodesError) throw episodesError;
      
      setEpisodes(episodesData || []);
    } catch (error) {
      console.error('Error fetching channel and episodes:', error);
      toast({
        title: "Error",
        description: "Failed to load channel and episodes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchContentIdeas = async () => {
    if (!user || !channelId) return;

    try {
      const { data, error } = await supabase
        .from('content_ideas')
        .select('*')
        .eq('episode_id', channelId) // Using channelId as the key for channel-wide analysis
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        // Convert the JSON data to proper types
        const convertedData: ContentIdea = {
          ...data,
          generated_ideas: Array.isArray(data.generated_ideas) 
            ? data.generated_ideas.map(item => {
                if (typeof item === 'string') return item;
                // If it's an object, try to extract text content
                if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
                  const obj = item as Record<string, any>;
                  return obj.text || obj.content || obj.description || JSON.stringify(item);
                }
                return String(item);
              })
            : [],
          saved_ideas: Array.isArray(data.saved_ideas) ? data.saved_ideas : []
        };
        
        setContentIdeas(convertedData);
        setUserNotes(data.user_notes || "");
      } else {
        setContentIdeas(null);
        setUserNotes("");
      }
    } catch (error) {
      console.error('Error fetching content ideas:', error);
    }
  };

  const generateIdeas = async () => {
    if (!channel || !episodes.length || !user) return;

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-content-ideas', {
        body: {
          channelId: channel.id,
          channelName: channel.name,
          allEpisodes: episodes.map(ep => ({
            id: ep.id,
            title: ep.title,
            description: ep.description,
            transcript: ep.transcript?.substring(0, 2000) // Limit transcript length
          }))
        }
      });

      if (error) throw error;

      if (data.ideas) {
        await fetchContentIdeas();
        toast({
          title: "Ideas Generated",
          description: "Content gap analysis completed successfully!",
        });
      }
    } catch (error) {
      console.error('Error generating ideas:', error);
      toast({
        title: "Error",
        description: "Failed to generate content ideas. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleSavedIdea = (index: number) => {
    if (!contentIdeas) return;

    const savedIdeas = [...(contentIdeas.saved_ideas || [])];
    const ideaIndex = savedIdeas.indexOf(index);
    
    if (ideaIndex > -1) {
      savedIdeas.splice(ideaIndex, 1);
    } else {
      savedIdeas.push(index);
    }

    setContentIdeas({
      ...contentIdeas,
      saved_ideas: savedIdeas
    });
  };

  const saveIdeas = async () => {
    if (!channel || !user || !contentIdeas) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('content_ideas')
        .update({
          saved_ideas: contentIdeas.saved_ideas,
          user_notes: userNotes
        })
        .eq('id', contentIdeas.id);

      if (error) throw error;

      toast({
        title: "Saved",
        description: "Your content ideas and notes have been saved!",
      });
    } catch (error) {
      console.error('Error saving ideas:', error);
      toast({
        title: "Error",
        description: "Failed to save ideas. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-6 py-8">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
            <div>
              <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-primary" />
                Content Ideas - {channel?.name || "Loading..."}
              </h1>
              <p className="text-sm text-muted-foreground">
                Discover trending content gaps and new ideas for this show
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        {channel ? (
          <div className="space-y-6">
            {/* Channel Overview */}
            <Card className="shadow-soft border-border/50">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{channel.name}</CardTitle>
                    <CardDescription>
                      Analyzing {episodes.length} episodes for content gaps and trending opportunities
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={generateIdeas}
                      disabled={isGenerating || episodes.length === 0}
                      variant="nature"
                      className="flex items-center gap-2"
                    >
                      {isGenerating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      {isGenerating ? 'Analyzing Content...' : 'Analyze Content Gaps'}
                    </Button>
                    {contentIdeas && (
                      <Button
                        onClick={generateIdeas}
                        disabled={isGenerating}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        <RefreshCw className="h-4 w-4" />
                        Regenerate
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Generated Ideas */}
            {contentIdeas && (
              <Card className="shadow-soft border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-primary" />
                    Missing Content Opportunities
                  </CardTitle>
                  <CardDescription>
                    AI-identified content gaps based on your {episodes.length} episodes and current industry trends
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {contentIdeas.generated_ideas.map((idea, index) => (
                    <div
                      key={index}
                      className="group relative p-6 rounded-xl border border-border/50 bg-gradient-to-br from-background to-muted/20 hover:shadow-lg transition-all duration-200"
                    >
                      <div className="flex items-start space-x-4">
                        <Checkbox
                          id={`idea-${index}`}
                          checked={contentIdeas.saved_ideas?.includes(index) || false}
                          onCheckedChange={() => toggleSavedIdea(index)}
                          className="mt-1 flex-shrink-0"
                        />
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center justify-center w-6 h-6 text-xs font-medium bg-primary/10 text-primary rounded-full">
                              {index + 1}
                            </span>
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                              {idea.split(' ').slice(0, 4).join(' ')}...
                            </span>
                          </div>
                          <label
                            htmlFor={`idea-${index}`}
                            className="block text-sm leading-relaxed cursor-pointer text-foreground group-hover:text-primary transition-colors"
                          >
                            {idea}
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Saved Ideas */}
                  {contentIdeas.saved_ideas && contentIdeas.saved_ideas.length > 0 && (
                    <div className="mt-6 space-y-3">
                      <label className="text-sm font-medium">Saved Ideas</label>
                      <div className="space-y-2">
                        {contentIdeas.saved_ideas.map((ideaIndex, savedIndex) => (
                          <div
                            key={ideaIndex}
                            className="flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-primary/5"
                          >
                            <span className="inline-flex items-center justify-center w-6 h-6 text-xs font-medium bg-primary/20 text-primary rounded-full flex-shrink-0 mt-0.5">
                              {savedIndex + 1}
                            </span>
                            <div className="flex-1 text-sm">
                              {contentIdeas.generated_ideas[ideaIndex]}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleSavedIdea(ideaIndex)}
                              className="text-muted-foreground hover:text-destructive flex-shrink-0"
                            >
                              ×
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* User Notes */}
                  <div className="mt-6 space-y-3">
                    <label className="text-sm font-medium">Your Notes</label>
                    <Textarea
                      placeholder="Add your thoughts about these content opportunities..."
                      value={userNotes}
                      onChange={(e) => setUserNotes(e.target.value)}
                      className="min-h-[100px]"
                    />
                  </div>

                  {/* Save Button */}
                  <div className="flex justify-end pt-4">
                    <Button
                      onClick={saveIdeas}
                      disabled={isSaving}
                      variant="nature"
                      className="flex items-center gap-2"
                    >
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Save Ideas & Notes
                    </Button>
                  </div>

                  {/* Saved Ideas Summary */}
                  {contentIdeas.saved_ideas && contentIdeas.saved_ideas.length > 0 && (
                    <div className="mt-4 p-3 bg-primary/10 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="secondary">
                          {contentIdeas.saved_ideas.length} opportunities saved
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Your saved content opportunities will be available for future planning and production.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Chatbot for discussing ideas */}
            {contentIdeas && contentIdeas.generated_ideas.length > 0 && (
              <IdeaChatbot 
                ideas={contentIdeas.generated_ideas}
                channelName={channel.name}
              />
            )}

            {/* Empty State */}
            {!contentIdeas && !isGenerating && episodes.length > 0 && (
              <Card className="shadow-soft border-border/50">
                <CardContent className="text-center py-12">
                  <Lightbulb className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">Ready to Find Content Gaps</h3>
                  <p className="text-muted-foreground mb-4">
                    I'll analyze all {episodes.length} episodes to identify trending content opportunities you haven't covered yet
                  </p>
                  <Button
                    onClick={generateIdeas}
                    variant="nature"
                    className="flex items-center gap-2"
                  >
                    <Sparkles className="h-4 w-4" />
                    Analyze Content Gaps
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* No Episodes State */}
            {episodes.length === 0 && (
              <Card className="shadow-soft border-border/50">
                <CardContent className="text-center py-12">
                  <Lightbulb className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Episodes Found</h3>
                  <p className="text-muted-foreground">
                    This channel doesn't have any episodes yet. Import some episodes to analyze content gaps.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <Card className="shadow-soft border-border/50">
            <CardContent className="text-center py-12">
              <Lightbulb className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Channel Not Found</h3>
              <p className="text-muted-foreground">
                This channel doesn't exist or you don't have access to it.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};