import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Lightbulb, Sparkles, RefreshCw, Save, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Episode {
  id: string;
  title: string;
  description: string | null;
  transcript: string | null;
  channel: {
    id: string;
    name: string;
  };
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
  const { user } = useAuth();
  const { toast } = useToast();
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null);
  const [contentIdeas, setContentIdeas] = useState<ContentIdea | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userNotes, setUserNotes] = useState("");

  useEffect(() => {
    fetchEpisodes();
  }, [user]);

  useEffect(() => {
    if (selectedEpisode) {
      fetchContentIdeas(selectedEpisode.id);
    }
  }, [selectedEpisode]);

  const fetchEpisodes = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('episodes')
        .select(`
          id,
          title,
          description,
          transcript,
          channel:channels(id, name)
        `)
        .eq('user_id', user.id)
        .order('published_at', { ascending: false });

      if (error) throw error;
      setEpisodes(data || []);
      if (data && data.length > 0) {
        setSelectedEpisode(data[0]);
      }
    } catch (error) {
      console.error('Error fetching episodes:', error);
      toast({
        title: "Error",
        description: "Failed to load episodes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchContentIdeas = async (episodeId: string) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('content_ideas')
        .select('*')
        .eq('episode_id', episodeId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        // Convert the JSON data to proper types
        const convertedData: ContentIdea = {
          ...data,
          generated_ideas: Array.isArray(data.generated_ideas) 
            ? (data.generated_ideas as string[]).filter(item => typeof item === 'string')
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
    if (!selectedEpisode || !user) return;

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-content-ideas', {
        body: {
          episodeId: selectedEpisode.id,
          episodeTitle: selectedEpisode.title,
          episodeDescription: selectedEpisode.description,
          transcript: selectedEpisode.transcript,
          channelName: selectedEpisode.channel.name
        }
      });

      if (error) throw error;

      if (data.ideas) {
        await fetchContentIdeas(selectedEpisode.id);
        toast({
          title: "Ideas Generated",
          description: "New content ideas have been generated successfully!",
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
    if (!selectedEpisode || !user || !contentIdeas) return;

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
                Content Ideas
              </h1>
              <p className="text-sm text-muted-foreground">
                Discover trending content gaps and new ideas for your episodes
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Episode Selection */}
          <div className="lg:col-span-1">
            <Card className="shadow-soft border-border/50">
              <CardHeader>
                <CardTitle className="text-lg">Select Episode</CardTitle>
                <CardDescription>
                  Choose an episode to generate content ideas for
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {episodes.map((episode) => (
                  <div
                    key={episode.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedEpisode?.id === episode.id 
                        ? 'bg-primary/10 border-primary' 
                        : 'bg-background hover:bg-muted/50'
                    }`}
                    onClick={() => setSelectedEpisode(episode)}
                  >
                    <div className="font-medium text-sm line-clamp-2">
                      {episode.title}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {episode.channel.name}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {selectedEpisode ? (
              <div className="space-y-6">
                {/* Episode Info */}
                <Card className="shadow-soft border-border/50">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{selectedEpisode.title}</CardTitle>
                        <CardDescription>
                          {selectedEpisode.channel.name}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={generateIdeas}
                          disabled={isGenerating}
                          variant="nature"
                          className="flex items-center gap-2"
                        >
                          {isGenerating ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                          {isGenerating ? 'Generating...' : 'Generate Ideas'}
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
                        Content Ideas & Trending Topics
                      </CardTitle>
                      <CardDescription>
                        AI-generated ideas based on your content and current industry trends
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {contentIdeas.generated_ideas.map((idea, index) => (
                        <div
                          key={index}
                          className="flex items-start space-x-3 p-4 rounded-lg border bg-muted/20"
                        >
                          <Checkbox
                            id={`idea-${index}`}
                            checked={contentIdeas.saved_ideas?.includes(index) || false}
                            onCheckedChange={() => toggleSavedIdea(index)}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <label
                              htmlFor={`idea-${index}`}
                              className="text-sm leading-relaxed cursor-pointer"
                            >
                              {idea}
                            </label>
                          </div>
                        </div>
                      ))}

                      {/* User Notes */}
                      <div className="mt-6 space-y-3">
                        <label className="text-sm font-medium">Your Notes</label>
                        <Textarea
                          placeholder="Add your thoughts about these ideas..."
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
                              {contentIdeas.saved_ideas.length} ideas saved
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Your saved ideas will be available for future reference and planning.
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Empty State */}
                {!contentIdeas && !isGenerating && (
                  <Card className="shadow-soft border-border/50">
                    <CardContent className="text-center py-12">
                      <Lightbulb className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium mb-2">No Ideas Generated Yet</h3>
                      <p className="text-muted-foreground mb-4">
                        Click "Generate Ideas" to discover trending content opportunities
                      </p>
                      <Button
                        onClick={generateIdeas}
                        variant="nature"
                        className="flex items-center gap-2"
                      >
                        <Sparkles className="h-4 w-4" />
                        Generate Ideas
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <Card className="shadow-soft border-border/50">
                <CardContent className="text-center py-12">
                  <Lightbulb className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">Select an Episode</h3>
                  <p className="text-muted-foreground">
                    Choose an episode from the list to generate content ideas
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};