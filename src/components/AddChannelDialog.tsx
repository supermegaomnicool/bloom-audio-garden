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
      // For now, we'll just insert the basic channel info
      // Later we can add the import logic for fetching episodes
      const { error } = await supabase
        .from("channels")
        .insert({
          name: formData.name,
          type: channelType,
          url: formData.url,
          description: formData.description,
          user_id: "temp-user-id" // We'll need to handle auth later
        });

      if (error) {
        throw error;
      }

      toast({
        title: "Channel added successfully!",
        description: "Your channel has been added. We'll start importing episodes soon.",
      });

      // Reset form
      setFormData({ name: "", url: "", description: "" });
      onOpenChange(false);
      
      // Refresh the page to show new channel
      window.location.reload();
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