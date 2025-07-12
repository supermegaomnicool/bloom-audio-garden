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

    // Prepare comprehensive context for the AI
    const totalEpisodes = episodes?.length || 0;
    const episodeContext = episodes?.map((ep, index) => ({
      title: ep.title,
      description: ep.description,
      transcript: ep.transcript ? ep.transcript.substring(0, 2000) + '...' : null,
      episodeNumber: ep.episode_number,
      seasonNumber: ep.season_number,
      publishedAt: ep.published_at
    })) || [];

    const contextInfo = `
Channel: ${channel.name}
Channel Description: ${channel.description || 'No description available'}
Type: ${channel.type}
Total Episodes: ${totalEpisodes}

All Episodes (${totalEpisodes} total):
${episodeContext.map((ep, index) => `
Episode ${ep.episodeNumber || index + 1}${ep.seasonNumber ? ` (Season ${ep.seasonNumber})` : ''}:
- Title: ${ep.title}
- Description: ${ep.description || 'No description'}
- Published: ${ep.publishedAt ? new Date(ep.publishedAt).toLocaleDateString() : 'Unknown'}
${ep.transcript ? `- Transcript excerpt: ${ep.transcript}` : '- No transcript available'}
`).join('\n')}
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
        model: 'gpt-4o-mini',
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