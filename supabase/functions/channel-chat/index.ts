import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Channel Chat Function Started ===');
    const { question, channelId } = await req.json();
    console.log('Request data:', { question: question?.substring(0, 100), channelId });
    
    if (!question || !channelId) {
      throw new Error('Question and channelId are required');
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Get the authorization header to extract user ID
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Set auth for the request
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Invalid token or user not found');
    }

    // Get channel information and episodes for context
    const { data: channel, error: channelError } = await supabase
      .from('channels')
      .select('*')
      .eq('id', channelId)
      .eq('user_id', user.id)
      .single();

    if (channelError || !channel) {
      throw new Error('Channel not found or access denied');
    }

    // Get all episodes for complete context
    const { data: episodes, error: episodesError } = await supabase
      .from('episodes')
      .select('title, description, transcript, published_at, episode_number, season_number')
      .eq('channel_id', channelId)
      .eq('user_id', user.id)
      .order('published_at', { ascending: false });

    if (episodesError) {
      console.error('Error fetching episodes:', episodesError);
    }

    // Hybrid preprocessing: analyze question and intelligently select episodes
    const totalEpisodes = episodes?.length || 0;
    
    // Extract keywords from the question for relevance scoring
    const questionKeywords = question.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2 && !['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use'].includes(word));
    
    // Score episodes based on relevance to the question
    const scoredEpisodes = episodes?.map(ep => {
      let score = 0;
      const content = `${ep.title} ${ep.description || ''} ${ep.transcript || ''}`.toLowerCase();
      
      // Score based on keyword matches
      questionKeywords.forEach(keyword => {
        const keywordCount = (content.match(new RegExp(keyword, 'g')) || []).length;
        score += keywordCount * 2; // Title/description matches worth more
        
        // Bonus for title matches
        if (ep.title.toLowerCase().includes(keyword)) {
          score += 5;
        }
      });
      
      // Recency bonus (newer episodes get slight preference)
      const episodeIndex = episodes.indexOf(ep);
      score += Math.max(0, 10 - episodeIndex * 0.1);
      
      return { ...ep, relevanceScore: score };
    }).sort((a, b) => b.relevanceScore - a.relevanceScore) || [];
    
    // Select top 15 most relevant episodes, ensuring we have some recent ones
    const topRelevant = scoredEpisodes.slice(0, 12);
    const recentFallback = scoredEpisodes.slice(0, 5);
    const selectedEpisodes = [...new Map([...topRelevant, ...recentFallback].map(ep => [ep.id, ep])).values()].slice(0, 15);
    
    // Summarize long content intelligently
    const summarizeContent = (text: string, maxLength: number) => {
      if (!text || text.length <= maxLength) return text;
      
      // Try to find natural break points (sentences)
      const sentences = text.split(/[.!?]+/);
      let summary = '';
      for (const sentence of sentences) {
        if ((summary + sentence).length > maxLength) break;
        summary += sentence + '. ';
      }
      
      return summary.trim() || text.substring(0, maxLength);
    };
    
    const episodeContext = selectedEpisodes.map((ep, index) => ({
      title: ep.title,
      description: ep.description ? summarizeContent(ep.description, 300) : null,
      transcript: ep.transcript ? summarizeContent(ep.transcript, 600) : null,
      episodeNumber: ep.episode_number,
      seasonNumber: ep.season_number,
      publishedAt: ep.published_at,
      relevanceScore: ep.relevanceScore
    }));

    const contextInfo = `
Channel: ${channel.name}
Channel Description: ${channel.description || 'No description available'}
Type: ${channel.type}
Total Episodes: ${totalEpisodes}
Selected Episodes: ${selectedEpisodes.length} (most relevant to your question)

Question Keywords: ${questionKeywords.join(', ')}

Relevant Episodes:
${episodeContext.map((ep, index) => `
Episode ${ep.episodeNumber || index + 1}${ep.seasonNumber ? ` (Season ${ep.seasonNumber})` : ''} [Relevance: ${ep.relevanceScore?.toFixed(1)}]:
- Title: ${ep.title}
- Description: ${ep.description || 'No description'}
- Published: ${ep.publishedAt ? new Date(ep.publishedAt).toLocaleDateString() : 'Unknown'}
${ep.transcript ? `- Key Content: ${ep.transcript}` : '- No transcript available'}
`).join('\n')}

Note: Episodes selected based on relevance to your question from ${totalEpisodes} total episodes.
`;

    console.log('Context info length:', contextInfo.length);
    console.log('Total episodes:', totalEpisodes);
    
    // Check if OpenAI API key is configured
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      console.error('OpenAI API key not found');
      throw new Error('OpenAI API key not configured');
    }
    
    console.log('OpenAI API key configured, making request...');

    // Call OpenAI API
    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a helpful assistant that answers questions about the podcast/channel "${channel.name}". Use the provided context about the channel and its episodes to give accurate, helpful responses. Be conversational and knowledgeable about the content.

Context about the channel:
${contextInfo}`
          },
          {
            role: 'user',
            content: question
          }
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    console.log('OpenAI API response status:', openAIResponse.status);

    if (!openAIResponse.ok) {
      const errorText = await openAIResponse.text();
      console.error('OpenAI API error details:', {
        status: openAIResponse.status,
        statusText: openAIResponse.statusText,
        errorBody: errorText,
        requestModel: 'gpt-4o-mini',
        contextLength: contextInfo.length,
        questionLength: question.length
      });
      throw new Error(`OpenAI API error: ${openAIResponse.statusText} - ${errorText}`);
    }

    const aiData = await openAIResponse.json();
    const response = aiData.choices[0].message.content;

    // Save the conversation to database
    const { data: chatData, error: chatError } = await supabase
      .from('channel_chats')
      .insert({
        channel_id: channelId,
        user_id: user.id,
        question: question,
        response: response,
      })
      .select()
      .single();

    if (chatError) {
      console.error('Error saving chat:', chatError);
      // Don't throw error here, still return the response
    }

    return new Response(JSON.stringify({ 
      response,
      chatId: chatData?.id 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in channel-chat function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});