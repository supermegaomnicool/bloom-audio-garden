import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Youtube, Video, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AddChannelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AddChannelDialog = ({ open, onOpenChange }: AddChannelDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [channelType, setChannelType] = useState<"youtube" | "podcast">("youtube");
  const [formData, setFormData] = useState({
    name: "",
    url: "",
    description: ""
  });
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Check if channel already exists
      const { data: existingChannel } = await supabase
        .from("channels")
        .select("id")
        .eq("url", formData.url)
        .single();

      if (existingChannel) {
        toast({
          title: "Channel already exists",
          description: "This channel has already been added to your collection.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Insert the basic channel info
      const { data: channelData, error: channelError } = await supabase
        .from("channels")
        .insert({
          name: formData.name,
          type: channelType,
          url: formData.url,
          user_notes: formData.description, // Save user input as notes
          user_id: "00000000-0000-0000-0000-000000000000"
        })
        .select()
        .single();

      if (channelError) {
        throw channelError;
      }

      toast({
        title: "Channel added successfully!",
        description: "Starting RSS import...",
      });

      // If it's a podcast, trigger RSS import
      if (channelType === "podcast" && channelData) {
        try {
          const { error: importError } = await supabase.functions.invoke('import-rss', {
            body: {
              rss_url: formData.url,
              channel_id: channelData.id
            }
          });

          if (importError) {
            throw importError;
          }

          toast({
            title: "RSS import completed!",
            description: "All episodes and artwork have been imported successfully.",
          });
        } catch (importError) {
          console.error("RSS import error:", importError);
          toast({
            title: "RSS import failed",
            description: "Channel was created but episode import failed. You can retry the import later.",
            variant: "destructive",
          });
        }
      }

      // Reset form
      setFormData({ name: "", url: "", description: "" });
      onOpenChange(false);
    } catch (error) {
      console.error("Error adding channel:", error);
      toast({
        title: "Error adding channel",
        description: "Please check your URL and try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add New Channel
          </DialogTitle>
          <DialogDescription>
            Add a YouTube channel or podcast RSS feed to start optimizing your content.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="type">Channel Type</Label>
            <Select value={channelType} onValueChange={(value: "youtube" | "podcast") => setChannelType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="youtube">
                  <div className="flex items-center gap-2">
                    <Youtube className="h-4 w-4 text-red-500" />
                    YouTube Channel
                  </div>
                </SelectItem>
                <SelectItem value="podcast">
                  <div className="flex items-center gap-2">
                    <Video className="h-4 w-4 text-primary" />
                    Podcast RSS Feed
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Channel Name</Label>
            <Input
              id="name"
              placeholder="Enter channel name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="url">
              {channelType === "youtube" ? "YouTube Channel URL" : "RSS Feed URL"}
            </Label>
            <Input
              id="url"
              type="url"
              placeholder={
                channelType === "youtube" 
                  ? "https://www.youtube.com/@channelname" 
                  : "https://example.com/podcast.rss"
              }
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              placeholder="Brief description of the channel content"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="flex items-center gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="nature" disabled={loading} className="flex-1">
              {loading ? "Adding..." : "Add Channel"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};