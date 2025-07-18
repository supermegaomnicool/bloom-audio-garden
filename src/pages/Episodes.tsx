import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Calendar, Clock, ExternalLink, Play, Search, FileText, Upload, Loader2, X, Eye, EyeOff } from "lucide-react";
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
  const [transcriptDialog, setTranscriptDialog] = useState<string | null>(null);
  const [confirmGenerateDialog, setConfirmGenerateDialog] = useState<string | null>(null);
  const [generatingTranscript, setGeneratingTranscript] = useState<Set<string>>(new Set());
  const [uploadingTranscript, setUploadingTranscript] = useState<string | null>(null);
  const [excludeDialog, setExcludeDialog] = useState<string | null>(null);
  const [exclusionNotes, setExclusionNotes] = useState("");
  const [showExcluded, setShowExcluded] = useState(false);
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

  // Filter episodes based on search query and exclusion status
  const filteredEpisodes = episodes.filter((episode) => {
    // Filter by exclusion status
    if (!showExcluded && episode.excluded) return false;
    
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
      episode.exclusion_notes,
    ].filter(Boolean).join(' ').toLowerCase();
    
    return searchableText.includes(query);
  });

  // Estimate transcript generation cost
  const estimateTranscriptCost = (episode: Episode) => {
    // OpenAI Whisper costs $0.006 per minute
    const costPerMinute = 0.006;
    
    if (episode.duration) {
      // Parse duration format (e.g., "01:23:45" or "23:45")
      const parts = episode.duration.split(':').map(Number);
      let totalMinutes = 0;
      
      if (parts.length === 3) {
        // HH:MM:SS format
        totalMinutes = parts[0] * 60 + parts[1] + parts[2] / 60;
      } else if (parts.length === 2) {
        // MM:SS format
        totalMinutes = parts[0] + parts[1] / 60;
      }
      
      const estimatedCost = totalMinutes * costPerMinute;
      return {
        minutes: Math.ceil(totalMinutes),
        cost: estimatedCost,
        costFormatted: `$${estimatedCost.toFixed(3)}`
      };
    }
    
    // Fallback: estimate based on file size (rough estimate: 1MB ≈ 1 minute for typical podcast audio)
    if (episode.file_size) {
      const estimatedMinutes = Math.ceil(episode.file_size / (1024 * 1024));
      const estimatedCost = estimatedMinutes * costPerMinute;
      return {
        minutes: estimatedMinutes,
        cost: estimatedCost,
        costFormatted: `$${estimatedCost.toFixed(3)} (estimated)`
      };
    }
    
    // Default estimate for unknown duration
    return {
      minutes: 30,
      cost: 30 * costPerMinute,
      costFormatted: '$0.180 (estimated)'
    };
  };

  const handleGenerateTranscript = async (episodeId: string, episodeTitle: string) => {
    setGeneratingTranscript(prev => new Set([...prev, episodeId]));
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-transcript', {
        body: { episodeId }
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Transcript Generated",
        description: `Transcript for "${episodeTitle}" has been generated successfully.`,
      });

      // Refresh episodes to show updated transcript
      await fetchChannelAndEpisodes();
      
    } catch (error) {
      console.error("Error generating transcript:", error);
      toast({
        title: "Error Generating Transcript",
        description: "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setGeneratingTranscript(prev => {
        const newSet = new Set(prev);
        newSet.delete(episodeId);
        return newSet;
      });
    }
  };

  const parseSRT = (content: string): string => {
    // Parse SRT format and preserve structure with timestamps
    const lines = content.split('\n');
    const segments: string[] = [];
    let currentTimestamp = '';
    let currentText: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line === '') {
        // End of segment
        if (currentTimestamp && currentText.length > 0) {
          segments.push(`[${currentTimestamp.split(' --> ')[0]}]\n${currentText.join(' ')}\n`);
        }
        currentTimestamp = '';
        currentText = [];
      } else if (/^\d+$/.test(line)) {
        // Subtitle number - skip
        continue;
      } else if (/^\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}$/.test(line)) {
        // Timestamp line
        currentTimestamp = line.replace(/,/g, '.');
      } else if (currentTimestamp) {
        // Text content
        currentText.push(line);
      }
    }
    
    // Don't forget the last segment
    if (currentTimestamp && currentText.length > 0) {
      segments.push(`[${currentTimestamp.split(' --> ')[0]}]\n${currentText.join(' ')}\n`);
    }

    return segments.join('\n');
  };

  const parseVTT = (content: string): string => {
    // Parse VTT format and preserve speaker info + timestamps
    const lines = content.split('\n');
    const segments: string[] = [];
    let currentTimestamp = '';
    let currentSpeaker = '';
    let currentText: string[] = [];
    let pastHeader = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line === 'WEBVTT' || line.startsWith('NOTE')) {
        pastHeader = true;
        continue;
      } else if (!pastHeader) {
        continue;
      } else if (line === '') {
        // End of segment
        if (currentTimestamp && currentText.length > 0) {
          const speaker = currentSpeaker ? `**${currentSpeaker}**: ` : '';
          const timestamp = `[${currentTimestamp.split(' --> ')[0]}]`;
          segments.push(`${timestamp} ${speaker}${currentText.join(' ')}\n`);
        }
        currentTimestamp = '';
        currentSpeaker = '';
        currentText = [];
      } else if (/^\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}/.test(line)) {
        // Timestamp line
        currentTimestamp = line;
      } else if (currentTimestamp) {
        // Text content - check for speaker tags
        const speakerMatch = line.match(/^<v\s+([^>]+)>/);
        if (speakerMatch) {
          currentSpeaker = speakerMatch[1];
          const textWithoutSpeaker = line.replace(/^<v\s+[^>]+>/, '').trim();
          if (textWithoutSpeaker) {
            currentText.push(textWithoutSpeaker);
          }
        } else {
          // Regular text or text with other tags
          const cleanText = line.replace(/<[^>]*>/g, '').trim();
          if (cleanText) {
            currentText.push(cleanText);
          }
        }
      }
    }
    
    // Don't forget the last segment
    if (currentTimestamp && currentText.length > 0) {
      const speaker = currentSpeaker ? `**${currentSpeaker}**: ` : '';
      const timestamp = `[${currentTimestamp.split(' --> ')[0]}]`;
      segments.push(`${timestamp} ${speaker}${currentText.join(' ')}\n`);
    }

    return segments.join('\n');
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, episodeId: string) => {
    const file = event.target.files?.[0];
    if (!file || !episodeId) return;

    console.log('Starting file upload for episode:', episodeId, 'File:', file.name);

    const allowedTypes = ['text/plain', 'application/x-subrip', '.srt', '.vtt'];
    const fileExtension = file.name.toLowerCase().split('.').pop();
    
    if (!['txt', 'srt', 'vtt'].includes(fileExtension || '')) {
      toast({
        title: "Invalid File Type",
        description: "Please upload a TXT, SRT, or VTT file.",
        variant: "destructive",
      });
      return;
    }

    setUploadingTranscript(episodeId);

    try {
      const content = await file.text();
      console.log('File content read, length:', content.length);
      let transcript = content;

      // Parse different formats
      if (fileExtension === 'srt') {
        transcript = parseSRT(content);
        console.log('Parsed SRT, new length:', transcript.length);
      } else if (fileExtension === 'vtt') {
        transcript = parseVTT(content);
        console.log('Parsed VTT, new length:', transcript.length);
      }

      console.log('About to update episode in database...');
      
      // Check current user and episode details for debugging
      const { data: currentUser } = await supabase.auth.getUser();
      console.log('Current user:', currentUser?.user?.id);
      
      const currentEpisode = episodes.find(ep => ep.id === episodeId);
      console.log('Episode user_id:', currentEpisode?.user_id);
      console.log('Episode ID:', episodeId);
      
      // Update episode with transcript
      const { data, error } = await supabase
        .from('episodes')
        .update({ transcript })
        .eq('id', episodeId)
        .select();

      if (error) {
        console.error('Database update error:', error);
        throw error;
      }

      console.log('Database updated successfully, returned data:', data);

      // Update local state
      setEpisodes(prevEpisodes => prevEpisodes.map(episode => 
        episode.id === episodeId 
          ? { ...episode, transcript }
          : episode
      ));

      console.log('Local state updated');

      setTranscriptDialog(null);
      
      toast({
        title: "Transcript Imported",
        description: `Transcript from ${file.name} has been imported successfully.`,
      });

    } catch (error) {
      console.error("Error uploading transcript:", error);
      toast({
        title: "Error Importing Transcript",
        description: `Please try again. Error: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setUploadingTranscript(null);
      // Reset file input
      event.target.value = '';
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
        
        {/* Controls */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowExcluded(!showExcluded)}
            className="flex items-center gap-2"
          >
            {showExcluded ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showExcluded ? 'Hide' : 'Show'} Excluded ({episodes.filter(e => e.excluded).length})
          </Button>
          
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
            <Card key={episode.id} className={`shadow-soft border-border/50 hover:shadow-natural transition-shadow ${episode.excluded ? 'opacity-60 border-muted' : ''}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle className="text-lg line-clamp-2">
                        {episode.episode_number && `#${episode.episode_number} - `}{episode.title}
                      </CardTitle>
                      {episode.excluded && (
                        <Badge variant="secondary" className="text-xs bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400">
                          Excluded
                        </Badge>
                      )}
                    </div>
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
                     
                     {episode.exclusion_notes && (
                       <div className="mt-2 p-2 bg-muted/50 rounded text-sm">
                         <span className="text-muted-foreground font-medium">Exclusion reason: </span>
                         {episode.exclusion_notes}
                       </div>
                     )}
                  </div>
                  
                  <div className="flex items-center gap-2 ml-4">
                    {!episode.excluded ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            console.log("Optimize button clicked, channelId:", channelId);
                            navigate(`/optimize/${channelId}`);
                          }}
                        >
                          Optimize
                        </Button>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setExcludeDialog(episode.id)}
                          className="text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/20"
                        >
                          <X className="h-4 w-4 mr-1" />
                          Exclude
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleExcludeEpisode(episode.id, false)}
                        className="text-green-600 border-green-200 hover:bg-green-50 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-900/20"
                      >
                        Restore
                      </Button>
                    )}
                    
                    {episode.audio_url && (
                      <Button variant="ghost" size="icon" asChild>
                        <a href={episode.audio_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </div>
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

                      {/* Audio Player */}
                      {episode.audio_url && (
                        <div>
                          <h4 className="text-sm font-medium text-foreground mb-2">Audio Player</h4>
                          <audio 
                            controls 
                            className="w-full"
                            preload="metadata"
                          >
                            <source src={episode.audio_url} type="audio/mpeg" />
                            <source src={episode.audio_url} type="audio/mp3" />
                            <source src={episode.audio_url} type="audio/wav" />
                            Your browser does not support the audio element.
                          </audio>
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
                            <div className="whitespace-pre-wrap font-mono leading-relaxed">
                              {episode.transcript}
                            </div>
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
                    
                    {/* Transcript Actions */}
                    {episode.audio_url && !episode.transcript && (
                      <>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setConfirmGenerateDialog(episode.id)}
                          disabled={generatingTranscript.has(episode.id)}
                          className="min-w-[140px]"
                        >
                          {generatingTranscript.has(episode.id) ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <FileText className="h-4 w-4 mr-2" />
                              Generate Transcript
                            </>
                          )}
                        </Button>
                        
                        {/* Confirmation Dialog for Generate Transcript */}
                        <Dialog open={confirmGenerateDialog === episode.id} onOpenChange={(open) => setConfirmGenerateDialog(open ? episode.id : null)}>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Generate Transcript</DialogTitle>
                              <DialogDescription>
                                Are you sure you want to generate a transcript for "{episode.title}"?
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-3">
                              <div className="bg-muted/30 p-3 rounded">
                                <h4 className="text-sm font-medium mb-2">Cost Estimate</h4>
                                <div className="text-sm space-y-1">
                                  <div>Duration: ~{estimateTranscriptCost(episode).minutes} minutes</div>
                                  <div>Estimated cost: {estimateTranscriptCost(episode).costFormatted}</div>
                                  <div className="text-xs text-muted-foreground mt-2">
                                    * Based on OpenAI Whisper pricing ($0.006/minute)
                                  </div>
                                </div>
                              </div>
                            </div>
                            <DialogFooter>
                              <Button 
                                variant="outline" 
                                onClick={() => setConfirmGenerateDialog(null)}
                              >
                                Cancel
                              </Button>
                              <Button 
                                onClick={() => {
                                  setConfirmGenerateDialog(null);
                                  handleGenerateTranscript(episode.id, episode.title);
                                }}
                              >
                                Generate Transcript
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </>
                    )}
                    
                    <Dialog open={transcriptDialog === episode.id} onOpenChange={(open) => setTranscriptDialog(open ? episode.id : null)}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Upload className="h-4 w-4 mr-2" />
                          Import Transcript
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Import Transcript</DialogTitle>
                          <DialogDescription>
                            Upload a transcript file for "{episode.title}". Supported formats: TXT, SRT, VTT
                          </DialogDescription>
                        </DialogHeader>
                        <div className="grid w-full max-w-sm items-center gap-1.5">
                          <Label htmlFor="transcript-file">Transcript File</Label>
                          <Input
                            id="transcript-file"
                            type="file"
                            accept=".txt,.srt,.vtt"
                            onChange={(e) => handleFileUpload(e, episode.id)}
                            disabled={uploadingTranscript === episode.id}
                          />
                          <p className="text-sm text-muted-foreground">
                            **Recommended:** VTT files preserve speaker names and timestamps for better readability<br/>
                            TXT: Plain text • SRT: SubRip subtitles • VTT: WebVTT with speakers
                          </p>
                        </div>
                        <DialogFooter>
                          <Button 
                            variant="outline" 
                            onClick={() => setTranscriptDialog(null)}
                            disabled={uploadingTranscript === episode.id}
                          >
                            Cancel
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    
                    {/* Individual Episode Optimize Button */}
                    <Button 
                      variant="bloom" 
                      size="sm"
                      onClick={() => {
                        if (episode.transcript) {
                          // Deep optimization with transcript content
                          navigate(`/optimize/${channelId}?episode=${episode.id}&deep=true`);
                        } else {
                          // Basic optimization without transcript
                          navigate(`/optimize/${channelId}?episode=${episode.id}`);
                        }
                      }}
                    >
                      {episode.transcript ? '🔍 Deep Optimize' : '⚡ Basic Optimize'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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