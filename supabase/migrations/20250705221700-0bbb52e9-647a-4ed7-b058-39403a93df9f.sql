-- Create table to store AI-generated suggestions for episodes
CREATE TABLE public.episode_suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  episode_id UUID NOT NULL REFERENCES public.episodes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  suggestion_type TEXT NOT NULL, -- 'title', 'description', 'hook', etc.
  original_content TEXT,
  ai_suggestions JSONB NOT NULL, -- Array of AI-generated alternatives
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.episode_suggestions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own episode suggestions" 
ON public.episode_suggestions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own episode suggestions" 
ON public.episode_suggestions 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own episode suggestions" 
ON public.episode_suggestions 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own episode suggestions" 
ON public.episode_suggestions 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_episode_suggestions_updated_at
BEFORE UPDATE ON public.episode_suggestions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();