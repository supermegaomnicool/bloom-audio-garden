import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Youtube, Video, Users, Calendar, TrendingUp, ExternalLink, RefreshCw, Trash2, Edit3, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tables } from "@/integrations/supabase/types";

type Channel = Tables<"channels">;

export const ChannelList = () => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingChannels, setSyncingChannels] = useState<Set<string>>(new Set());
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [editingNotesValue, setEditingNotesValue] = useState("");
  const { toast } = useToast();

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
        toast({
          title: "Error loading channels",
          description: "Please refresh the page to try again.",
          variant: "destructive",
        });
        return;
      }

      setChannels(data || []);
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error loading channels",
        description: "Please refresh the page to try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteChannel = async (channelId: string, channelName: string) => {
    try {
      // Delete episodes first (due to foreign key relationship)
      const { error: episodesError } = await supabase
        .from("episodes")
        .delete()
        .eq("channel_id", channelId);

      if (episodesError) {
        throw episodesError;
      }

      // Delete the channel
      const { error: channelError } = await supabase
        .from("channels")
        .delete()
        .eq("id", channelId);

      if (channelError) {
        throw channelError;
      }

      // Remove from state
      setChannels(channels.filter(channel => channel.id !== channelId));

      toast({
        title: "Channel deleted",
        description: `${channelName} and all its episodes have been removed.`,
      });
    } catch (error) {
      console.error("Error deleting channel:", error);
      toast({
        title: "Error deleting channel",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSyncChannel = async (channelId: string, channelName: string, rssUrl: string) => {
    setSyncingChannels(prev => new Set([...prev, channelId]));
    
    try {
      const { error } = await supabase.functions.invoke('import-rss', {
        body: {
          rss_url: rssUrl,
          channel_id: channelId
        }
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Sync completed",
        description: `${channelName} has been synchronized with new episodes.`,
      });

      // Refresh the channels list to show updated stats
      await fetchChannels();
    } catch (error) {
      console.error("Sync error:", error);
      toast({
        title: "Sync failed",
        description: "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setSyncingChannels(prev => {
        const newSet = new Set(prev);
        newSet.delete(channelId);
        return newSet;
      });
    }
  };

  const handleEditNotes = (channelId: string, currentNotes: string) => {
    setEditingNotes(channelId);
    setEditingNotesValue(currentNotes || "");
  };

  const handleSaveNotes = async (channelId: string) => {
    try {
      const { error } = await supabase
        .from("channels")
        .update({ user_notes: editingNotesValue })
        .eq("id", channelId);

      if (error) {
        throw error;
      }

      // Update local state
      setChannels(channels.map(channel => 
        channel.id === channelId 
          ? { ...channel, user_notes: editingNotesValue }
          : channel
      ));

      setEditingNotes(null);
      setEditingNotesValue("");

      toast({
        title: "Notes updated",
        description: "Your notes have been saved successfully.",
      });
    } catch (error) {
      console.error("Error saving notes:", error);
      toast({
        title: "Error saving notes",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingNotes(null);
    setEditingNotesValue("");
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
              {/* Official RSS Description */}
              {channel.description && (
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-1">Official Description</h4>
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {channel.description}
                  </p>
                </div>
              )}

              {/* User Notes Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-foreground">Your Notes</h4>
                  {editingNotes !== channel.id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditNotes(channel.id, channel.user_notes || "")}
                      className="h-6 px-2"
                    >
                      <Edit3 className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                  )}
                </div>
                
                {editingNotes === channel.id ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editingNotesValue}
                      onChange={(e) => setEditingNotesValue(e.target.value)}
                      placeholder="Add your notes about this channel..."
                      rows={3}
                      className="text-sm"
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSaveNotes(channel.id)}
                        className="h-7 px-3"
                      >
                        <Save className="h-3 w-3 mr-1" />
                        Save
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCancelEdit}
                        className="h-7 px-3"
                      >
                        <X className="h-3 w-3 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {channel.user_notes || "No notes added yet. Click edit to add your notes."}
                  </p>
                )}
              </div>
              
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
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleSyncChannel(channel.id, channel.name, channel.url)}
                  disabled={syncingChannels.has(channel.id)}
                  className="min-w-[90px]"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${syncingChannels.has(channel.id) ? 'animate-spin' : ''}`} />
                  {syncingChannels.has(channel.id) ? 'Syncing...' : 'Sync Now'}
                </Button>
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Channel</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete "{channel.name}"? This action will permanently remove the channel and all its episodes. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDeleteChannel(channel.id, channel.name)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete Channel
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

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