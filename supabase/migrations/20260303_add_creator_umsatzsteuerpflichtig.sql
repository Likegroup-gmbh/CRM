begin;

alter table public.creator
  add column if not exists umsatzsteuerpflichtig boolean;

update public.creator
set umsatzsteuerpflichtig = true
where umsatzsteuerpflichtig is null;

alter table public.creator
  alter column umsatzsteuerpflichtig set default true;

alter table public.creator
  alter column umsatzsteuerpflichtig set not null;

comment on column public.creator.umsatzsteuerpflichtig
  is 'True, wenn Creator umsatzsteuerpflichtig ist';

commit;
