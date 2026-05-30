-- Create triggers for notification deep-links on reply and upvote
-- First drop existing triggers if they exist
DROP TRIGGER IF EXISTS on_discussion_reply_notify ON public.discussion_replies;
DROP TRIGGER IF EXISTS on_upvote_notify ON public.discussion_upvotes;

-- Create triggers
CREATE TRIGGER on_discussion_reply_notify
  AFTER INSERT ON public.discussion_replies
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_discussion_reply();

CREATE TRIGGER on_upvote_notify
  AFTER INSERT ON public.discussion_upvotes
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_upvote();

-- Create a function to look up a user by email (for cohort member add)
CREATE OR REPLACE FUNCTION public.lookup_user_by_email(_email text)
RETURNS TABLE(user_id uuid, display_name text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.display_name, p.avatar_url
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.user_id
  WHERE u.email = _email
  LIMIT 1;
$$;