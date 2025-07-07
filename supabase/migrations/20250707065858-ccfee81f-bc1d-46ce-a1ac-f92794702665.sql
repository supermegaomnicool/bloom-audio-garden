-- Create table for storing content ideas
CREATE TABLE public.content_ideas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  episode_id UUID NOT NULL,
  user_id UUID NOT NULL,
  channel_name TEXT,
  episode_title TEXT,
  generated_ideas JSONB NOT NULL,
  saved_ideas INTEGER[] DEFAULT ARRAY[]::INTEGER[],
  user_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(episode_id, user_id)
);

-- Enable Row Level Security
ALTER TABLE public.content_ideas ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own content ideas" 
ON public.content_ideas 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own content ideas" 
ON public.content_ideas 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own content ideas" 
ON public.content_ideas 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own content ideas" 
ON public.content_ideas 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_content_ideas_updated_at
BEFORE UPDATE ON public.content_ideas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();