update public.halls
set venue_type = 'BYOD Lab'
where venue_type in ('Lab', 'Labs', 'BYOD Labs', 'Byod Lab', 'Byod Labs');

update public.halls
set venue_type = 'Dining Hall'
where venue_type in ('Dinning Hall', 'Dining');
