begin;
-- Keep the complete multipart request below Vercel's 4.5 MB request boundary.
-- This changes future upload acceptance only; existing private objects stay intact.
do $$begin
 update storage.buckets set file_size_limit=4194304
 where id='professional-evidence' and public=false and file_size_limit=5242880;
 if not found then raise exception 'Expected private evidence bucket and previous size limit required';end if;
end$$;
commit;
