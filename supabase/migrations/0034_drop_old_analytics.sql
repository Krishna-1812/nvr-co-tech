-- ============================================================================
-- Drop the old analytics store
--
-- The Admin screen (0033) replaced the old visitor intelligence on 18 Oct 2026,
-- and the owner asked for the old tables to be removed. Nothing in the
-- application reads or writes any of these since that change.
--
-- Kept, deliberately:
--   analytics_admins, is_analytics_admin()  the admin list; the Admin screen,
--                                           Contact Finder and the tool locks use it
--   product_events, record_product_event()  still written by sign-up, organisation,
--                                           invite and voucher functions; dropping
--                                           it would make those fail
--   error_log, rate_limits, agent_runs,     still written by the app
--   access_requests, feature_requests
--
-- `drop function` without an argument list works because each name is unique.
-- `cascade` on the tables takes their policies and indexes with them.
-- Re-runnable.
-- ============================================================================

drop function if exists record_visitor_view;
drop function if exists record_page_view;
drop function if exists record_identity;
drop function if exists graph_node;
drop function if exists graph_edge;
drop function if exists prune_analytics;
drop function if exists cache_ai_summary;
drop function if exists operator_tenants;
drop function if exists operator_members;
drop function if exists operator_onboarding;
drop function if exists operator_workflow_stages;
drop function if exists operator_stuck_vouchers;

drop table if exists page_views         cascade;
drop table if exists visitor_analytics  cascade;
drop table if exists visitor_identities cascade;
drop table if exists identity_edges     cascade;
drop table if exists identity_nodes     cascade;
drop table if exists ip_resolutions     cascade;
drop table if exists company_enrichment cascade;
drop table if exists enrichment_spend   cascade;
drop table if exists ai_summaries       cascade;

-- Its history was only ever read by the old funnel screens.
truncate table product_events;
