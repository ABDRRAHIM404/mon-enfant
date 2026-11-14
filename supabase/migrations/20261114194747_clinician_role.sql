begin;
alter type public.professional_role add value if not exists 'nurse';
commit;
