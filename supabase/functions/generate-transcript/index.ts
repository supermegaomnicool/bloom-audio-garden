import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

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
    const { episodeId } = await req.json();
    
    if (!episodeId) {
      throw new Error('Episode ID is required');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get episode details
    const { data: episode, error: episodeError } = await supabaseClient
      .from('episodes')
      .select('*')
      .eq('id', episodeId)
      .single();

    if (episodeError || !episode) {
      throw new Error('Episode not found');
    }

    if (!episode.audio_url) {
      throw new Error('Episode has no audio URL');
    }

    console.log(`Starting transcription for episode: ${episode.title}`);
    console.log(`Audio URL: ${episode.audio_url}`);

    // Download the audio file
    console.log('Downloading audio file...');
    const audioResponse = await fetch(episode.audio_url);
    if (!audioResponse.ok) {
      throw new Error(`Failed to download audio: ${audioResponse.statusText}`);
    }

    const audioBlob = await audioResponse.blob();
    console.log(`Audio file size: ${audioBlob.size} bytes`);

    // Prepare form data for OpenAI Whisper
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.mp3');
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'text');

    // Send to OpenAI Whisper
    console.log('Sending to OpenAI Whisper...');
    const openaiResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      },
      body: formData,
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${openaiResponse.statusText}`);
    }

    const transcript = await openaiResponse.text();
    console.log(`Transcript generated, length: ${transcript.length} characters`);

    // Update episode with transcript
    const { error: updateError } = await supabaseClient
      .from('episodes')
      .update({ transcript })
      .eq('id', episodeId);

    if (updateError) {
      console.error('Error updating episode:', updateError);
      throw new Error('Failed to save transcript');
    }

    console.log('Transcript saved successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Transcript generated successfully',
        transcript: transcript.substring(0, 200) + (transcript.length > 200 ? '...' : '')
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in generate-transcript function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Check the function logs for more details'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});