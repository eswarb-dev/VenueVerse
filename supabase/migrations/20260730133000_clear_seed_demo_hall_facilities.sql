-- Remove legacy/demo facilities from the built-in seed venues only.
-- Manual facility choices on newly added or edited venues are intentionally preserved.

with seed_demo_halls(name, facilities) as (
  values
    ('IT Seminar Hall', array['Projector', 'Microphone', 'Speakers', 'Wi-Fi']::text[]),
    ('IT Lab', array['Computer System', 'Projector', 'Wi-Fi']::text[]),
    ('AI&DS Seminar Hall', array['Projector', 'Microphone', 'Speakers', 'Wi-Fi']::text[]),
    ('AI&DS Lab', array['Computer System', 'Projector', 'Wi-Fi']::text[]),
    ('EEE Seminar Hall', array['Projector', 'Microphone', 'Speakers']::text[]),
    ('EEE Lab', array['Computer System', 'Projector']::text[]),
    ('ECE Seminar Hall', array['Projector', 'Microphone', 'Speakers']::text[]),
    ('ECE Lab', array['Computer System', 'Projector']::text[]),
    ('BME Seminar Hall', array['Projector', 'Microphone', 'Speakers']::text[]),
    ('BME Lab', array['Computer System', 'Projector']::text[]),
    ('CSE Seminar Hall', array['Projector', 'Microphone', 'Speakers', 'Wi-Fi']::text[]),
    ('CSE Lab', array['Computer System', 'Projector', 'Wi-Fi']::text[]),
    ('CIVIL Seminar Hall', array['Projector', 'Microphone', 'Speakers']::text[]),
    ('CIVIL Lab', array['Computer System', 'Projector']::text[]),
    ('AERO Seminar Hall', array['Projector', 'Microphone', 'Speakers']::text[]),
    ('AERO Lab', array['Computer System', 'Projector']::text[]),
    ('MBA Seminar Hall', array['Projector', 'Microphone', 'Speakers', 'AC']::text[]),
    ('MBA Lab', array['Computer System', 'Projector', 'Wi-Fi']::text[]),
    ('NANO Seminar Hall', array['Projector', 'Microphone', 'Speakers']::text[]),
    ('NANO Lab', array['Computer System', 'Projector']::text[]),
    ('MECH Seminar Hall', array['Projector', 'Microphone', 'Speakers']::text[]),
    ('MECH Lab', array['Computer System', 'Projector']::text[]),
    ('EIE Seminar Hall', array['Projector', 'Microphone', 'Speakers']::text[]),
    ('EIE Lab', array['Computer System', 'Projector']::text[]),
    ('Library Seminar Hall', array['Projector', 'Microphone', 'Speakers', 'Wi-Fi']::text[]),
    ('College Auditorium', array['Projector', 'Microphone', 'Speakers', 'AC', 'Stage']::text[])
)
update public.halls h
set facilities = array[]::text[]
from seed_demo_halls seed
where lower(h.name) = lower(seed.name)
  and coalesce(h.facilities, array[]::text[]) = seed.facilities;
