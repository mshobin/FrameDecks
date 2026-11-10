-- Undo 0023: new-device alerts are removed, with the alerts already written. PCs, devices, teams and security events
-- are untouched; connecting a PC or a device simply stops writing an alert. Only run this to roll back a problem with
-- 0023 (and remove the Database Webhook on device_alerts first).
drop trigger if exists device_alert_computer on public.computers;
drop trigger if exists device_alert_event on public.security_events;
drop function if exists public.device_alert_release(bigint);
drop function if exists public.device_alert_take(bigint);
drop function if exists public.device_alerts_recent(uuid);
drop function if exists public.device_alert_on_event();
drop function if exists public.device_alert_on_computer();
drop function if exists public.device_alert_add(uuid, text, text);
drop table if exists public.device_alerts;
