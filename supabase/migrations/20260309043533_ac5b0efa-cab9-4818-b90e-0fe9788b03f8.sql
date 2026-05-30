-- Create trigger function for discussion reply notifications
CREATE OR REPLACE FUNCTION public.notify_on_discussion_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  thread_author_id uuid;
  thread_title text;
  replier_name text;
BEGIN
  -- Get the thread author and title
  SELECT author_id, title INTO thread_author_id, thread_title
  FROM public.discussion_threads
  WHERE id = NEW.thread_id;
  
  -- Don't notify if replying to own thread
  IF thread_author_id = NEW.author_id THEN
    RETURN NEW;
  END IF;
  
  -- Get replier's display name
  SELECT display_name INTO replier_name
  FROM public.profiles
  WHERE user_id = NEW.author_id;
  
  replier_name := COALESCE(replier_name, 'A learner');
  
  -- Create notification for thread author
  INSERT INTO public.notifications (user_id, title, message, link, type)
  VALUES (
    thread_author_id,
    'New reply to your discussion',
    replier_name || ' replied to "' || LEFT(thread_title, 50) || '"',
    NULL,
    'discussion_reply'
  );
  
  RETURN NEW;
END;
$$;

-- Create trigger for reply notifications
DROP TRIGGER IF EXISTS trigger_notify_on_discussion_reply ON public.discussion_replies;
CREATE TRIGGER trigger_notify_on_discussion_reply
  AFTER INSERT ON public.discussion_replies
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_discussion_reply();

-- Create trigger function for upvote notifications
CREATE OR REPLACE FUNCTION public.notify_on_upvote()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_author_id uuid;
  target_title text;
  voter_name text;
BEGIN
  -- Get the voter's display name
  SELECT display_name INTO voter_name
  FROM public.profiles
  WHERE user_id = NEW.user_id;
  
  voter_name := COALESCE(voter_name, 'Someone');
  
  IF NEW.target_type = 'thread' THEN
    -- Get thread author and title
    SELECT author_id, title INTO target_author_id, target_title
    FROM public.discussion_threads
    WHERE id = NEW.target_id;
    
    -- Don't notify if upvoting own content
    IF target_author_id = NEW.user_id THEN
      RETURN NEW;
    END IF;
    
    INSERT INTO public.notifications (user_id, title, message, link, type)
    VALUES (
      target_author_id,
      'Your discussion was upvoted',
      voter_name || ' upvoted "' || LEFT(target_title, 50) || '"',
      NULL,
      'upvote'
    );
    
  ELSIF NEW.target_type = 'reply' THEN
    -- Get reply author
    SELECT author_id INTO target_author_id
    FROM public.discussion_replies
    WHERE id = NEW.target_id;
    
    -- Don't notify if upvoting own content
    IF target_author_id = NEW.user_id THEN
      RETURN NEW;
    END IF;
    
    INSERT INTO public.notifications (user_id, title, message, link, type)
    VALUES (
      target_author_id,
      'Your reply was upvoted',
      voter_name || ' upvoted your reply',
      NULL,
      'upvote'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for upvote notifications
DROP TRIGGER IF EXISTS trigger_notify_on_upvote ON public.discussion_upvotes;
CREATE TRIGGER trigger_notify_on_upvote
  AFTER INSERT ON public.discussion_upvotes
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_upvote();