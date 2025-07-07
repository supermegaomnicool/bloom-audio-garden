import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Lightbulb, RefreshCw, Save } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";

export const Ideas = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [ideas, setIdeas] = useState<string[]>([]);
  const [selectedIdeas, setSelectedIdeas] = useState<number[]>([]);
  const [userNotes, setUserNotes] = useState("");

  const handleGenerateIdeas = async () => {
    setIsGenerating(true);
    try {
      // Simulate API call - replace with actual implementation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const mockIdeas = [
        "Seasonal Floral Trends: Create episodes focusing on trending seasonal arrangements that are currently popular on social media platforms like Pinterest and Instagram.",
        "• Spring 2024: Dried flower arrangements with pampas grass\n• Summer: Minimalist single-stem displays\n• Fall: Preserved eucalyptus and berry combinations",
        "Sustainable Floristry: Address the growing demand for eco-friendly floral practices, which is trending 40% higher this year according to industry reports.",
        "• Locally-sourced flower sourcing tips\n• Biodegradable floral foam alternatives\n• Zero-waste wedding bouquet strategies",
        "Social Media Marketing for Florists: Cover the latest algorithm changes and trending hashtags that are driving engagement in the floral industry.",
        "• Instagram Reels strategies for florists\n• TikTok flower arrangement tutorials\n• Pinterest SEO for floral businesses"
      ];
      
      setIdeas(mockIdeas);
      toast({
        title: "Ideas Generated",
        description: "New content ideas have been generated based on current trends.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate ideas. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleIdeaToggle = (index: number) => {
    setSelectedIdeas(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  const handleSaveSelected = async () => {
    if (selectedIdeas.length === 0) {
      toast({
        title: "No Ideas Selected",
        description: "Please select at least one idea to save.",
        variant: "destructive",
      });
      return;
    }

    try {
      // TODO: Implement actual saving to database
      toast({
        title: "Ideas Saved",
        description: `${selectedIdeas.length} ideas and your notes have been saved.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save ideas. Please try again.",
        variant: "destructive",
      });
    }
  };

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
              <h1 className="text-2xl font-bold text-foreground">New Ideas Generator</h1>
              <p className="text-muted-foreground">
                Discover trending content ideas for your podcast
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Generate Ideas Section */}
          <Card className="shadow-natural border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-primary" />
                Content Gap Analysis
              </CardTitle>
              <CardDescription>
                Generate new content ideas based on your existing episodes, industry trends, and popular topics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <Button
                  onClick={handleGenerateIdeas}
                  disabled={isGenerating}
                  variant="nature"
                  className="flex items-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Analyzing Trends...
                    </>
                  ) : (
                    <>
                      <Lightbulb className="h-4 w-4" />
                      Generate Ideas
                    </>
                  )}
                </Button>
                
                {ideas.length > 0 && (
                  <Button
                    onClick={handleGenerateIdeas}
                    variant="outline"
                    disabled={isGenerating}
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Regenerate
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Generated Ideas */}
          {ideas.length > 0 && (
            <Card className="shadow-natural border-border/50">
              <CardHeader>
                <CardTitle>Generated Ideas</CardTitle>
                <CardDescription>
                  Select the ideas you'd like to save for future episodes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {ideas.map((idea, index) => (
                  <div key={index} className="flex items-start gap-3 p-4 rounded-lg border border-border/50 bg-muted/30">
                    <Checkbox
                      id={`idea-${index}`}
                      checked={selectedIdeas.includes(index)}
                      onCheckedChange={() => handleIdeaToggle(index)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <label
                        htmlFor={`idea-${index}`}
                        className="text-sm leading-relaxed cursor-pointer whitespace-pre-line"
                      >
                        {idea}
                      </label>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* User Notes */}
          {ideas.length > 0 && (
            <Card className="shadow-natural border-border/50">
              <CardHeader>
                <CardTitle>Your Notes</CardTitle>
                <CardDescription>
                  Add any additional thoughts or modifications to these ideas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Add your notes about these ideas, any modifications you'd like to make, or additional thoughts..."
                  value={userNotes}
                  onChange={(e) => setUserNotes(e.target.value)}
                  className="min-h-[120px]"
                />
              </CardContent>
            </Card>
          )}

          {/* Save Section */}
          {ideas.length > 0 && (
            <Card className="shadow-natural border-border/50">
              <CardContent className="pt-6">
                <Button
                  onClick={handleSaveSelected}
                  variant="bloom"
                  className="w-full flex items-center gap-2"
                  disabled={selectedIdeas.length === 0}
                >
                  <Save className="h-4 w-4" />
                  Save Selected Ideas ({selectedIdeas.length})
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};