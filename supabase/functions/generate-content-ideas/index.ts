import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { channelId, channelName, allEpisodes } = await req.json();

    if (!channelId || !channelName || !allEpisodes || !Array.isArray(allEpisodes)) {
      throw new Error('Missing required parameters: channelId, channelName, and allEpisodes array');
    }

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get current user from auth header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !userData.user) {
      throw new Error('Invalid user token');
    }

    // Prepare comprehensive content analysis
    const episodesSummary = allEpisodes.map(ep => 
      `Title: "${ep.title}"${ep.description ? ` | Description: ${ep.description.substring(0, 200)}` : ''}${ep.transcript ? ` | Key content: ${ep.transcript.substring(0, 300)}` : ''}`
    ).join('\n\n');

    // Extract industry keywords and themes from all episodes
    const allTitles = allEpisodes.map(ep => ep.title).join(' ');
    const allDescriptions = allEpisodes.map(ep => ep.description || '').join(' ');
    const industryKeywords = extractIndustryKeywords(allTitles, allDescriptions, channelName);

    const systemPrompt = `You are an expert content strategist and trend analyst. You specialize in identifying content gaps and opportunities by analyzing an entire podcast/channel catalog.

Your task is to:
1. Analyze ALL episodes from "${channelName}" to understand the channel's content themes and coverage
2. Identify significant content gaps - popular topics in the industry that haven't been covered
3. Suggest trending topics that would complement the existing content library
4. Consider what the audience would expect to see but is currently missing

Focus on content gaps, not episode improvements. Think strategically about the overall content portfolio.`;

    const userPrompt = `Channel: "${channelName}" (${allEpisodes.length} episodes)
Industry Context: ${industryKeywords.join(', ')}

ALL EPISODES SUMMARY:
${episodesSummary}

Based on this complete content analysis, identify 5 significant content gaps - popular topics/themes in this space that are notably missing from the channel's coverage. For each gap, explain:

1. What the missing content opportunity is
2. Why it's valuable/trending in this industry
3. Specific angles or approaches that would work well for this channel's audience
4. How it would complement the existing content library

Focus on strategic content opportunities that would strengthen the overall channel positioning. Each suggestion should be 2-3 sentences with specific, actionable direction.

Return only a JSON array of 5 content gap strings, no additional text.`;

    // Generate ideas using OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.8,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const generatedText = data.choices[0].message.content;
    
    let ideas;
    try {
      // Clean the response text by removing markdown code blocks
      let cleanedText = generatedText.trim();
      if (cleanedText.startsWith('```json')) {
        cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      }
      if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      // Try to parse as JSON first
      const parsedData = JSON.parse(cleanedText);
      
      if (Array.isArray(parsedData)) {
        // If it's already an array of strings, use it
        ideas = parsedData.map(item => {
          if (typeof item === 'string') return item;
          // If it's an object, extract the meaningful text
          if (typeof item === 'object' && item !== null) {
            // Try to extract content from common JSON keys
            return item.idea || item.content || item.description || item.text || 
                   Object.values(item).join(' ') || JSON.stringify(item);
          }
          return String(item);
        });
      } else if (typeof parsedData === 'object' && parsedData !== null) {
        // If it's an object, try to extract ideas from it
        ideas = Object.values(parsedData).map(item => {
          if (typeof item === 'string') return item;
          if (typeof item === 'object' && item !== null) {
            return Object.values(item).join(' ');
          }
          return String(item);
        });
      } else {
        throw new Error('Invalid JSON structure');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', generatedText);
      // Fallback: extract ideas from text
      ideas = generatedText.split('\n\n')
        .filter(line => line.trim().length > 0)
        .map(line => line.replace(/^\d+\.\s*/, '').replace(/^[-*]\s*/, '').trim())
        .filter(line => line.length > 50) // Ensure substantial content
        .slice(0, 5);
    }

    // Save ideas to database using channelId as episode_id for channel-wide analysis
    const { data: savedIdeas, error: saveError } = await supabase
      .from('content_ideas')
      .upsert({
        episode_id: channelId, // Using channelId for channel-wide analysis
        user_id: userData.user.id,
        channel_name: channelName,
        episode_title: `${channelName} - Content Gap Analysis`,
        generated_ideas: ideas
      }, { 
        onConflict: 'episode_id,user_id',
        returning: 'minimal'
      });

    if (saveError) {
      console.error('Error saving content ideas:', saveError);
      // Continue anyway - return ideas even if save fails
    }

    return new Response(JSON.stringify({ 
      ideas,
      saved: !saveError 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-content-ideas function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      ideas: []
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Helper function to extract industry keywords from content
function extractIndustryKeywords(titles: string, descriptions: string, channelName: string): string[] {
  const content = `${titles} ${descriptions} ${channelName}`.toLowerCase();
  
  const industryKeywords = [
    'technology', 'business', 'marketing', 'finance', 'health', 'fitness',
    'education', 'entertainment', 'science', 'startup', 'entrepreneurship',
    'design', 'productivity', 'leadership', 'sales', 'customer service',
    'digital', 'social media', 'content', 'personal development', 'career',
    'innovation', 'strategy', 'growth', 'management', 'coaching'
  ];
  
  const found = industryKeywords.filter(keyword => content.includes(keyword));
  return found.length > 0 ? found : ['general business'];
}