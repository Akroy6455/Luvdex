-- Testing is over (7 Nov 2026): restore the launch values for Luvball throwing.
update private.settings set value = '50' where key = 'throw_range_m';
update private.settings set value = '75' where key = 'throw_gps_max_m';
