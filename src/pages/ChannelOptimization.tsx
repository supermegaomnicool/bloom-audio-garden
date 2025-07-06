import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Star, AlertTriangle, CheckCircle, TrendingUp, FileText, Clock, Users, X, Eye, EyeOff, Sparkles, Upload, Image } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
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

interface AISuggestion {
  id: string;
  type: 'title' | 'description' | 'hook';
  suggestions: string[];
  loading: boolean;
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
  const [aiSuggestions, setAiSuggestions] = useState<Map<string, AISuggestion>>(new Map());
  const [confirmGenerateDialog, setConfirmGenerateDialog] = useState<string | null>(null);
  const [transcriptDialog, setTranscriptDialog] = useState<string | null>(null);
  const [uploadingTranscript, setUploadingTranscript] = useState<string | null>(null);
  const [contextDialog, setContextDialog] = useState<{episodeId: string, type: 'title' | 'description' | 'hook'} | null>(null);
  const [additionalContext, setAdditionalContext] = useState("");
  const [savedSuggestions, setSavedSuggestions] = useState<Map<string, number[]>>(new Map());
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<{episodeId: string, type: string, index: number, text: string} | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (channelId) {
      fetchChannelAndEpisodes();
    }
  }, [channelId]);

  useEffect(() => {
    if (episodes.length > 0) {
      analyzeEpisodes();
      // Load all existing saved suggestions for episodes
      loadAllSavedSuggestions();
    }
  }, [episodes, showExcluded]);

  const loadAllSavedSuggestions = async () => {
    try {
      const { data: currentUser, error: authError } = await supabase.auth.getUser();
      if (authError || !currentUser.user) return;

      const { data, error } = await supabase
        .from('episode_suggestions')
        .select('episode_id, suggestion_type, saved_suggestions')
        .eq('user_id', currentUser.user.id);

      if (error) throw error;

      const savedMap = new Map<string, number[]>();
      data?.forEach(record => {
        const key = `${record.episode_id}-${record.suggestion_type}`;
        savedMap.set(key, record.saved_suggestions || []);
      });
      
      setSavedSuggestions(savedMap);
    } catch (error) {
      console.error('Error loading saved suggestions:', error);
    }
  };

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

  const generateSuggestions = async (episodeScore: EpisodeScore, suggestionType: 'title' | 'description' | 'hook', additionalContext?: string) => {
    const episode = episodeScore.episode;
    const suggestionKey = `${episode.id}-${suggestionType}`;
    
    // Check authentication first
    const { data: currentUser, error: authError } = await supabase.auth.getUser();
    if (authError || !currentUser.user) {
      toast({
        title: "Authentication Error",
        description: "Please sign in to generate suggestions.",
        variant: "destructive",
      });
      return;
    }
    
    // Preserve existing suggestions during loading
    const existingSuggestion = aiSuggestions.get(suggestionKey);
    setAiSuggestions(prev => new Map(prev.set(suggestionKey, {
      id: suggestionKey,
      type: suggestionType,
      suggestions: existingSuggestion?.suggestions || [],
      loading: true
    })));

    try {
      let originalContent = '';
      switch (suggestionType) {
        case 'title':
          originalContent = episode.title;
          break;
        case 'description':
          originalContent = episode.description || '';
          break;
        case 'hook':
          const desc = episode.description || '';
          originalContent = desc.replace(/<[^>]*>/g, '').split('.')[0] || '';
          break;
      }

      // Include additional context if provided
      const contextualDescription = additionalContext 
        ? `${episode.description || ''}\n\nAdditional Context: ${additionalContext}`
        : episode.description || '';

      const { data, error } = await supabase.functions.invoke('generate-suggestions', {
        body: {
          episodeId: episode.id,
          suggestionType,
          originalContent,
          episodeTitle: episode.title,
          channelName: channel?.name || '',
          transcript: episode.transcript || null,
          episodeDescription: contextualDescription,
          additionalContext: additionalContext || null
        }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw error;
      }

      if (!data || !data.suggestions) {
        throw new Error('No suggestions returned from AI');
      }

      // Update suggestions state, preserving any existing suggestions
      const existingSuggestion = aiSuggestions.get(suggestionKey);
      setAiSuggestions(prev => new Map(prev.set(suggestionKey, {
        id: suggestionKey,
        type: suggestionType,
        suggestions: data.suggestions || [],
        loading: false
      })));

      // Load existing saved suggestions for this episode-type combination
      await loadSavedSuggestions(episode.id, suggestionType);

      toast({
        title: "Suggestions Generated",
        description: `Generated ${data.suggestions?.length || 0} alternative ${suggestionType} suggestions`,
      });
      
    } catch (error) {
      console.error('Error generating suggestions:', error);
      setAiSuggestions(prev => new Map(prev.set(suggestionKey, {
        id: suggestionKey,
        type: suggestionType,
        suggestions: [],
        loading: false
      })));
      
      // More specific error messages
      let errorMessage = "Please try again later.";
      if (error.message?.includes('authentication') || error.message?.includes('auth')) {
        errorMessage = "Authentication failed. Please refresh the page and try again.";
      } else if (error.message?.includes('OpenAI')) {
        errorMessage = "AI service temporarily unavailable. Please try again in a few minutes.";
      } else if (error.message?.includes('FunctionsHttpError')) {
        errorMessage = `Service error occurred. Error details: ${error.message}`;
      }
      
      toast({
        title: "Error generating suggestions",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const loadSavedSuggestions = async (episodeId: string, suggestionType: string) => {
    try {
      const { data, error } = await supabase
        .from('episode_suggestions')
        .select('saved_suggestions')
        .eq('episode_id', episodeId)
        .eq('suggestion_type', suggestionType)
        .maybeSingle();

      if (error) throw error;

      const suggestionKey = `${episodeId}-${suggestionType}`;
      setSavedSuggestions(prev => new Map(prev.set(suggestionKey, data?.saved_suggestions || [])));
    } catch (error) {
      console.error('Error loading saved suggestions:', error);
    }
  };

  const toggleSaveSuggestion = async (episodeId: string, suggestionType: string, suggestionIndex: number) => {
    const suggestionKey = `${episodeId}-${suggestionType}`;
    const currentSaved = savedSuggestions.get(suggestionKey) || [];
    const isCurrentlySaved = currentSaved.includes(suggestionIndex);
    
    let newSavedList: number[];
    if (isCurrentlySaved) {
      newSavedList = currentSaved.filter(idx => idx !== suggestionIndex);
    } else {
      newSavedList = [...currentSaved, suggestionIndex];
    }

    // Update local state immediately
    setSavedSuggestions(prev => new Map(prev.set(suggestionKey, newSavedList)));

    try {
      // Get current user
      const { data: currentUser, error: authError } = await supabase.auth.getUser();
      if (authError || !currentUser.user) throw authError;

      // Try to update existing record first
      const { error: updateError } = await supabase
        .from('episode_suggestions')
        .update({ saved_suggestions: newSavedList })
        .eq('episode_id', episodeId)
        .eq('suggestion_type', suggestionType)
        .eq('user_id', currentUser.user.id);

      if (updateError) {
        // If no existing record found, we might need to check if there's an episode_suggestions record
        // For now, just update the saved_suggestions field separately
        console.log('Update error:', updateError);
        throw updateError;
      }

      toast({
        title: isCurrentlySaved ? "Suggestion unsaved" : "Suggestion saved",
        description: isCurrentlySaved ? "Removed from saved suggestions" : "Added to saved suggestions",
      });
    } catch (error) {
      console.error('Error saving suggestion:', error);
      // Revert local state on error
      setSavedSuggestions(prev => new Map(prev.set(suggestionKey, currentSaved)));
      toast({
        title: "Error",
        description: "Failed to save suggestion. Please try again.",
        variant: "destructive",
      });
    }
  };

  const deleteSavedSuggestion = async (episodeId: string, suggestionType: string, suggestionIndex: number) => {
    const suggestionKey = `${episodeId}-${suggestionType}`;
    const currentSaved = savedSuggestions.get(suggestionKey) || [];
    const newSavedList = currentSaved.filter(idx => idx !== suggestionIndex);

    // Update local state immediately
    setSavedSuggestions(prev => new Map(prev.set(suggestionKey, newSavedList)));

    try {
      // Get current user
      const { data: currentUser, error: authError } = await supabase.auth.getUser();
      if (authError || !currentUser.user) throw authError;

      // Update database
      const { error: updateError } = await supabase
        .from('episode_suggestions')
        .update({ saved_suggestions: newSavedList })
        .eq('episode_id', episodeId)
        .eq('suggestion_type', suggestionType)
        .eq('user_id', currentUser.user.id);

      if (updateError) throw updateError;

      toast({
        title: "Suggestion removed",
        description: "Suggestion removed from saved suggestions",
      });
    } catch (error) {
      console.error('Error deleting saved suggestion:', error);
      // Revert local state on error
      setSavedSuggestions(prev => new Map(prev.set(suggestionKey, currentSaved)));
      toast({
        title: "Error",
        description: "Failed to remove suggestion. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeleteConfirmDialog(null);
    }
  };

  const generateTranscript = async (episode: Episode) => {
    if (!episode.audio_url) {
      toast({
        title: "No audio file available",
        description: "Cannot generate transcript without audio.",
        variant: "destructive",
      });
      return;
    }

    try {
      toast({
        title: "Generating transcript...",
        description: "This may take a few minutes.",
      });

      const { data, error } = await supabase.functions.invoke('generate-transcript', {
        body: { episodeId: episode.id }
      });

      if (error) throw error;

      // Update local episode state
      setEpisodes(prevEpisodes => prevEpisodes.map(ep => 
        ep.id === episode.id ? { ...ep, transcript: data.transcript } : ep
      ));

      toast({
        title: "Transcript generated successfully",
        description: "The episode now has a transcript available.",
      });
    } catch (error) {
      console.error('Error generating transcript:', error);
      toast({
        title: "Error generating transcript",
        description: "Please try again later.",
        variant: "destructive",
      });
    }
  };

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
    
    // Ultimate fallback
    return {
      minutes: 30, // Assume 30 minutes average
      cost: 30 * costPerMinute,
      costFormatted: `$${(30 * costPerMinute).toFixed(3)} (estimated)`
    };
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
                {/* Custom Artwork Display */}
                {(episodeScore.episode.artwork_url || episodeScore.episode.has_custom_artwork) && (
                  <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg">
                    <div className="flex-shrink-0">
                      <img 
                        src={episodeScore.episode.artwork_url || '/placeholder.svg'} 
                        alt="Episode artwork"
                        className="w-32 h-32 object-cover rounded-lg shadow-sm border border-border/50"
                      />
                    </div>
                    <div className="flex-1">
                      <h5 className="text-sm font-medium flex items-center gap-2">
                        <Image className="h-4 w-4" />
                        Custom Episode Artwork
                      </h5>
                      <p className="text-xs text-muted-foreground mt-1">
                        This episode has custom artwork which can improve click-through rates
                      </p>
                    </div>
                  </div>
                )}

                {/* Transcript Status and Display */}
                {episodeScore.episode.transcript ? (
                  <div className="p-4 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg">
                    <h5 className="text-sm font-medium text-green-800 dark:text-green-200 mb-2 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Episode Transcript Available
                    </h5>
                    <div className="max-h-32 overflow-y-auto bg-white dark:bg-gray-800 border border-green-200 dark:border-green-700 rounded p-3 text-xs">
                      <pre className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                        {episodeScore.episode.transcript.substring(0, 1000)}
                        {episodeScore.episode.transcript.length > 1000 && '...'}
                      </pre>
                    </div>
                    <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                      ✅ Transcript enables AI-powered optimization suggestions
                    </p>
                  </div>
                ) : (
                  <div className="p-3 bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 rounded-lg">
                    <div className="flex items-start gap-3">
                      <Upload className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h5 className="text-sm font-medium text-orange-800 dark:text-orange-200">
                          Missing Transcript - Major SEO Opportunity
                        </h5>
                        <p className="text-xs text-orange-700 dark:text-orange-300 mt-1 mb-3">
                          Generate a transcript to unlock detailed optimization suggestions and improve searchability
                        </p>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => setConfirmGenerateDialog(episodeScore.episode.id)}
                            className="border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-300"
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            Generate Transcript
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => setTranscriptDialog(episodeScore.episode.id)}
                            className="border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300"
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            Upload Transcript
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* AI Optimization Section */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    AI-Powered Optimization
                  </h4>
                  
                  {/* Current Content Display */}
                  <div className="grid gap-3">
                    <div className="p-3 bg-muted/20 rounded-lg">
                      <h5 className="text-xs font-medium text-muted-foreground mb-1">Current Title</h5>
                      <p className="text-sm">{episodeScore.episode.title}</p>
                      
                      {/* Saved Title Options */}
                      {(() => {
                        const titleSuggestionKey = `${episodeScore.episode.id}-title`;
                        const savedTitleIndices = savedSuggestions.get(titleSuggestionKey) || [];
                        const titleSuggestion = aiSuggestions.get(titleSuggestionKey);
                        const savedTitles = savedTitleIndices
                          .map(idx => titleSuggestion?.suggestions[idx])
                          .filter(Boolean);
                        
                        return savedTitles.length > 0 && (
                          <div className="mt-3 p-2 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-700">
                            <h6 className="text-xs font-medium text-green-800 dark:text-green-200 mb-2">Saved Title Options</h6>
                            <div className="space-y-1">
                              {savedTitles.map((title, idx) => {
                                const originalIndex = savedTitleIndices[idx];
                                return (
                                  <div key={idx} className="flex items-center gap-2 text-xs p-2 bg-white dark:bg-gray-800 rounded border hover:bg-muted/50 transition-colors">
                                    <div className="flex-1 cursor-pointer"
                                         onClick={() => {
                                           navigator.clipboard.writeText(title);
                                           toast({ title: "Copied to clipboard!", description: "Title copied successfully" });
                                         }}>
                                      {title}
                                    </div>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setDeleteConfirmDialog({
                                        episodeId: episodeScore.episode.id,
                                        type: 'title',
                                        index: originalIndex,
                                        text: title
                                      })}
                                      className="h-6 w-6 p-0 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/20"
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                      
                      {/* AI Title Suggestions */}
                      {(() => {
                        const titleSuggestionKey = `${episodeScore.episode.id}-title`;
                        const titleSuggestion = aiSuggestions.get(titleSuggestionKey);
                        
                        return titleSuggestion && !titleSuggestion.loading && (
                          <div className="mt-3 p-3 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/10 dark:to-purple-900/10 rounded border border-blue-200 dark:border-blue-800">
                            <h6 className="text-xs font-medium text-blue-800 dark:text-blue-200 mb-2 flex items-center gap-1">
                              <Sparkles className="h-3 w-3" />
                              AI Title Suggestions
                            </h6>
                            <div className="space-y-2">
                              {titleSuggestion.suggestions.map((suggestionText, idx) => {
                                const isSaved = savedSuggestions.get(titleSuggestionKey)?.includes(idx) || false;
                                
                                return !isSaved && (
                                  <div key={idx} className="flex items-start gap-2 p-2 bg-white dark:bg-gray-800 rounded border border-border/50 hover:bg-muted/50 transition-all">
                                    <Checkbox
                                      checked={false}
                                      onCheckedChange={() => toggleSaveSuggestion(episodeScore.episode.id, 'title', idx)}
                                      className="mt-0.5"
                                    />
                                    <div className="flex-1">
                                      <span className="text-xs text-muted-foreground">#{idx + 1}</span>
                                      <p className="text-xs cursor-pointer hover:text-primary transition-colors"
                                         onClick={() => {
                                           navigator.clipboard.writeText(suggestionText);
                                           toast({ title: "Copied to clipboard!", description: "Suggestion copied successfully" });
                                         }}>
                                        {suggestionText}
                                      </p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setContextDialog({episodeId: episodeScore.episode.id, type: 'title'})}
                              className="text-xs mt-2 w-full"
                            >
                              <Sparkles className="h-3 w-3 mr-1" />
                              Generate Again
                            </Button>
                          </div>
                        );
                      })()}
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setContextDialog({episodeId: episodeScore.episode.id, type: 'title'})}
                        disabled={aiSuggestions.get(`${episodeScore.episode.id}-title`)?.loading}
                        className="text-xs mt-2"
                      >
                        <Sparkles className="h-3 w-3 mr-1" />
                        {aiSuggestions.get(`${episodeScore.episode.id}-title`)?.loading ? 'Generating...' : 'Get Title Ideas'}
                      </Button>
                    </div>
                    
                    <div className="p-4 bg-muted/30 rounded-lg border">
                      <h5 className="text-sm font-semibold text-foreground mb-2">Current Description</h5>
                      <p className="text-sm leading-relaxed">{episodeScore.episode.description?.replace(/<[^>]*>/g, '') || 'No description available'}</p>
                      
                      {/* Saved Description Options */}
                      {(() => {
                        const descSuggestionKey = `${episodeScore.episode.id}-description`;
                        const savedDescIndices = savedSuggestions.get(descSuggestionKey) || [];
                        const descSuggestion = aiSuggestions.get(descSuggestionKey);
                        const savedDescs = savedDescIndices
                          .map(idx => descSuggestion?.suggestions[idx])
                          .filter(Boolean);
                        
                        return savedDescs.length > 0 && (
                          <div className="mt-3 p-2 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-700">
                            <h6 className="text-xs font-medium text-green-800 dark:text-green-200 mb-2">Saved Description Options</h6>
                            <div className="space-y-1">
                              {savedDescs.map((desc, idx) => {
                                const originalIndex = savedDescIndices[idx];
                                return (
                                  <div key={idx} className="flex items-center gap-2 text-xs p-2 bg-white dark:bg-gray-800 rounded border hover:bg-muted/50 transition-colors">
                                    <div className="flex-1 cursor-pointer"
                                         onClick={() => {
                                           navigator.clipboard.writeText(desc);
                                           toast({ title: "Copied to clipboard!", description: "Description copied successfully" });
                                         }}>
                                      {desc}
                                    </div>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setDeleteConfirmDialog({
                                        episodeId: episodeScore.episode.id,
                                        type: 'description',
                                        index: originalIndex,
                                        text: desc
                                      })}
                                      className="h-6 w-6 p-0 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/20"
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                      
                      {/* AI Description Suggestions */}
                      {(() => {
                        const descSuggestionKey = `${episodeScore.episode.id}-description`;
                        const descSuggestion = aiSuggestions.get(descSuggestionKey);
                        
                        return descSuggestion && !descSuggestion.loading && (
                          <div className="mt-3 p-3 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/10 dark:to-purple-900/10 rounded border border-blue-200 dark:border-blue-800">
                            <h6 className="text-xs font-medium text-blue-800 dark:text-blue-200 mb-2 flex items-center gap-1">
                              <Sparkles className="h-3 w-3" />
                              AI Description Suggestions
                            </h6>
                            <div className="space-y-2">
                              {descSuggestion.suggestions.map((suggestionText, idx) => {
                                const isSaved = savedSuggestions.get(descSuggestionKey)?.includes(idx) || false;
                                
                                return !isSaved && (
                                  <div key={idx} className="flex items-start gap-2 p-2 bg-white dark:bg-gray-800 rounded border border-border/50 hover:bg-muted/50 transition-all">
                                    <Checkbox
                                      checked={false}
                                      onCheckedChange={() => toggleSaveSuggestion(episodeScore.episode.id, 'description', idx)}
                                      className="mt-0.5"
                                    />
                                    <div className="flex-1">
                                      <span className="text-xs text-muted-foreground">#{idx + 1}</span>
                                      <p className="text-xs cursor-pointer hover:text-primary transition-colors line-clamp-2"
                                         onClick={() => {
                                           navigator.clipboard.writeText(suggestionText);
                                           toast({ title: "Copied to clipboard!", description: "Suggestion copied successfully" });
                                         }}>
                                        {suggestionText}
                                      </p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setContextDialog({episodeId: episodeScore.episode.id, type: 'description'})}
                              className="text-xs mt-2 w-full"
                            >
                              <Sparkles className="h-3 w-3 mr-1" />
                              Generate Again
                            </Button>
                          </div>
                        );
                      })()}
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setContextDialog({episodeId: episodeScore.episode.id, type: 'description'})}
                        disabled={aiSuggestions.get(`${episodeScore.episode.id}-description`)?.loading}
                        className="text-xs mt-2"
                      >
                        <Sparkles className="h-3 w-3 mr-1" />
                        {aiSuggestions.get(`${episodeScore.episode.id}-description`)?.loading ? 'Generating...' : 'Get Description Ideas'}
                      </Button>
                    </div>
                    
                    <div className="p-4 bg-muted/30 rounded-lg border">
                      <h5 className="text-sm font-semibold text-foreground mb-2">Current Opening Hook</h5>
                      <p className="text-sm leading-relaxed">
                        {episodeScore.episode.description?.replace(/<[^>]*>/g, '').split('.')[0] || 'No opening hook available'}
                      </p>
                      
                      {/* Saved Hook Options */}
                      {(() => {
                        const hookSuggestionKey = `${episodeScore.episode.id}-hook`;
                        const savedHookIndices = savedSuggestions.get(hookSuggestionKey) || [];
                        const hookSuggestion = aiSuggestions.get(hookSuggestionKey);
                        const savedHooks = savedHookIndices
                          .map(idx => hookSuggestion?.suggestions[idx])
                          .filter(Boolean);
                        
                        return savedHooks.length > 0 && (
                          <div className="mt-3 p-2 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-700">
                            <h6 className="text-xs font-medium text-green-800 dark:text-green-200 mb-2">Saved Hook Options</h6>
                            <div className="space-y-1">
                              {savedHooks.map((hook, idx) => {
                                const originalIndex = savedHookIndices[idx];
                                return (
                                  <div key={idx} className="flex items-center gap-2 text-xs p-2 bg-white dark:bg-gray-800 rounded border hover:bg-muted/50 transition-colors">
                                    <div className="flex-1 cursor-pointer"
                                         onClick={() => {
                                           navigator.clipboard.writeText(hook);
                                           toast({ title: "Copied to clipboard!", description: "Hook copied successfully" });
                                         }}>
                                      {hook}
                                    </div>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setDeleteConfirmDialog({
                                        episodeId: episodeScore.episode.id,
                                        type: 'hook',
                                        index: originalIndex,
                                        text: hook
                                      })}
                                      className="h-6 w-6 p-0 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/20"
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                      
                      {/* AI Hook Suggestions */}
                      {(() => {
                        const hookSuggestionKey = `${episodeScore.episode.id}-hook`;
                        const hookSuggestion = aiSuggestions.get(hookSuggestionKey);
                        
                        return hookSuggestion && !hookSuggestion.loading && (
                          <div className="mt-3 p-3 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/10 dark:to-purple-900/10 rounded border border-blue-200 dark:border-blue-800">
                            <h6 className="text-xs font-medium text-blue-800 dark:text-blue-200 mb-2 flex items-center gap-1">
                              <Sparkles className="h-3 w-3" />
                              AI Hook Suggestions
                            </h6>
                            <div className="space-y-2">
                              {hookSuggestion.suggestions.map((suggestionText, idx) => {
                                const isSaved = savedSuggestions.get(hookSuggestionKey)?.includes(idx) || false;
                                
                                return !isSaved && (
                                  <div key={idx} className="flex items-start gap-2 p-2 bg-white dark:bg-gray-800 rounded border border-border/50 hover:bg-muted/50 transition-all">
                                    <Checkbox
                                      checked={false}
                                      onCheckedChange={() => toggleSaveSuggestion(episodeScore.episode.id, 'hook', idx)}
                                      className="mt-0.5"
                                    />
                                    <div className="flex-1">
                                      <span className="text-xs text-muted-foreground">#{idx + 1}</span>
                                      <p className="text-xs cursor-pointer hover:text-primary transition-colors"
                                         onClick={() => {
                                           navigator.clipboard.writeText(suggestionText);
                                           toast({ title: "Copied to clipboard!", description: "Suggestion copied successfully" });
                                         }}>
                                        {suggestionText}
                                      </p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setContextDialog({episodeId: episodeScore.episode.id, type: 'hook'})}
                              className="text-xs mt-2 w-full"
                            >
                              <Sparkles className="h-3 w-3 mr-1" />
                              Generate Again
                            </Button>
                          </div>
                        );
                      })()}
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setContextDialog({episodeId: episodeScore.episode.id, type: 'hook'})}
                        disabled={aiSuggestions.get(`${episodeScore.episode.id}-hook`)?.loading}
                        className="text-xs mt-2"
                      >
                        <Sparkles className="h-3 w-3 mr-1" />
                        {aiSuggestions.get(`${episodeScore.episode.id}-hook`)?.loading ? 'Generating...' : 'Get Hook Ideas'}
                      </Button>
                    </div>
                  </div>
                </div>


                {/* Quick Stats */}
                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-2 border-t">
                  <span>Description: {(episodeScore.episode.description?.replace(/<[^>]*>/g, '') || "").length} chars</span>
                  {episodeScore.episode.transcript && <span>✅ Has transcript</span>}
                  {episodeScore.episode.has_custom_artwork && <span>🎨 Custom artwork</span>}
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

      {/* Generate Transcript Confirmation Dialog */}
      {confirmGenerateDialog && (
        <Dialog open={!!confirmGenerateDialog} onOpenChange={(open) => setConfirmGenerateDialog(open ? confirmGenerateDialog : null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate Transcript</DialogTitle>
              <DialogDescription>
                Are you sure you want to generate a transcript for "{episodes.find(ep => ep.id === confirmGenerateDialog)?.title}"?
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="bg-muted/30 p-3 rounded">
                <h4 className="text-sm font-medium mb-2">Cost Estimate</h4>
                <div className="text-sm space-y-1">
                  <div>Duration: ~{estimateTranscriptCost(episodes.find(ep => ep.id === confirmGenerateDialog)!).minutes} minutes</div>
                  <div>Estimated cost: {estimateTranscriptCost(episodes.find(ep => ep.id === confirmGenerateDialog)!).costFormatted}</div>
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
                  const episode = episodes.find(ep => ep.id === confirmGenerateDialog);
                  if (episode) {
                    setConfirmGenerateDialog(null);
                    generateTranscript(episode);
                  }
                }}
              >
                Generate Transcript
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Upload Transcript Dialog */}
      {transcriptDialog && (
        <Dialog open={!!transcriptDialog} onOpenChange={(open) => setTranscriptDialog(open ? transcriptDialog : null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Import Transcript</DialogTitle>
              <DialogDescription>
                Upload a transcript file for "{episodes.find(ep => ep.id === transcriptDialog)?.title}". Supported formats: TXT, SRT, VTT
              </DialogDescription>
            </DialogHeader>
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="transcript-file">Transcript File</Label>
              <Input
                id="transcript-file"
                type="file"
                accept=".txt,.srt,.vtt"
                onChange={(e) => handleFileUpload(e, transcriptDialog)}
                disabled={uploadingTranscript === transcriptDialog}
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
                disabled={uploadingTranscript === transcriptDialog}
              >
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Additional Context Dialog */}
      {contextDialog && (
        <Dialog open={!!contextDialog} onOpenChange={(open) => {
          if (!open) {
            setContextDialog(null);
            setAdditionalContext("");
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Context for AI Suggestions</DialogTitle>
              <DialogDescription>
                Provide additional context to help the AI generate better {contextDialog.type} suggestions for this episode.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="additional-context">Additional Context (Optional)</Label>
                <Textarea
                  id="additional-context"
                  placeholder={`e.g., ${
                    contextDialog.type === 'title' 
                      ? 'This episode focuses on advanced strategies, includes guest expert John Smith, covers breaking news about...'
                      : contextDialog.type === 'description'
                      ? 'Key topics discussed include..., important timestamps are..., target audience is...'
                      : 'The opening should emphasize the controversial take, the surprising statistics mentioned, or the actionable insight...'
                  }`}
                  value={additionalContext}
                  onChange={(e) => setAdditionalContext(e.target.value)}
                  className="mt-2"
                  rows={4}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  The more specific context you provide, the better the AI suggestions will be. Include key topics, guest names, important points, target audience, or any special focus areas.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => {
                  setContextDialog(null);
                  setAdditionalContext("");
                }}
              >
                Cancel
              </Button>
              <Button 
                onClick={() => {
                  if (contextDialog) {
                    const episodeScore = episodeScores.find(es => es.episode.id === contextDialog.episodeId);
                    if (episodeScore) {
                      generateSuggestions(episodeScore, contextDialog.type, additionalContext || undefined);
                    }
                    setContextDialog(null);
                    setAdditionalContext("");
                  }
                }}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Suggestions
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmDialog} onOpenChange={(open) => !open && setDeleteConfirmDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Saved Suggestion</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this saved suggestion? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          <div className="p-3 bg-muted/20 rounded-lg">
            <p className="text-sm">{deleteConfirmDialog?.text}</p>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmDialog(null)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (deleteConfirmDialog) {
                  deleteSavedSuggestion(
                    deleteConfirmDialog.episodeId,
                    deleteConfirmDialog.type,
                    deleteConfirmDialog.index
                  );
                }
              }}
              variant="destructive"
            >
              Remove Suggestion
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};