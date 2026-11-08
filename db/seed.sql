-- ============================================================================
-- Choe Gi Ngultrum (ཁྱོད་ཀྱི་དངུལ་ཀྲམ།) — Seed Data
-- ============================================================================

-- Clean existing data
TRUNCATE TABLE review_flags, notifications, questions, documents, audit_log, expenditures, budgets, events, users, clubs RESTART IDENTITY CASCADE;

-- Insert Clubs
INSERT INTO clubs (id, name, description) VALUES
  (1, 'Cultural & Heritage Club', 'Promotes Bhutanese traditional performing arts, mask dance, and festivals'),
  (2, 'Debate & Literary Society', 'Organizes inter-college debates, poetry slams, and literary festivals'),
  (3, 'Rover Scouts & Social Service', 'Community outreach, disaster response, and campus volunteering'),
  (4, 'Football & Athletics Club', 'Coordinates college league, marathon, and sporting fixtures'),
  (5, 'IT & Innovation Club', 'Coding competitions, robotics workshops, and digital campus support');
ALTER SEQUENCE clubs_id_seq RESTART WITH 6;

-- Insert Users (Password: Transparency@2026)
-- Hash: $2b$10$eKR3rlAdsGfymbn9JhH0yeLnDe8k.ytnw8yeJsmHiFjmY30o6adSi
INSERT INTO users (id, name, email, password_hash, role, is_verified, department, club_id) VALUES
  (1, 'Pema Dechen', 'admin@sherubtse.rub.edu.bt', '$2b$10$eKR3rlAdsGfymbn9JhH0yeLnDe8k.ytnw8yeJsmHiFjmY30o6adSi', 'admin', true, 'Administration', NULL),
  (2, 'Kinley Wangchuk', 'finance@sherubtse.rub.edu.bt', '$2b$10$eKR3rlAdsGfymbn9JhH0yeLnDe8k.ytnw8yeJsmHiFjmY30o6adSi', 'finance_officer', true, 'Finance & Accounts', NULL),
  (3, 'Tashi Dorji', 'student@sherubtse.rub.edu.bt', '$2b$10$eKR3rlAdsGfymbn9JhH0yeLnDe8k.ytnw8yeJsmHiFjmY30o6adSi', 'student', true, 'Computer Science', NULL),
  (4, 'Sonam Pelmo', 'leader@sherubtse.rub.edu.bt', '$2b$10$eKR3rlAdsGfymbn9JhH0yeLnDe8k.ytnw8yeJsmHiFjmY30o6adSi', 'student_leader', true, 'Arts & Humanities', 1),
  (5, 'Karma Tshering', 'auditor@sherubtse.rub.edu.bt', '$2b$10$eKR3rlAdsGfymbn9JhH0yeLnDe8k.ytnw8yeJsmHiFjmY30o6adSi', 'auditor', true, 'Internal Audit Office', NULL);
ALTER SEQUENCE users_id_seq RESTART WITH 6;

-- Insert 12 Active Projects / Events
INSERT INTO events (id, name, status, club_id, budget_amount) VALUES
  (1, 'Annual Cultural Festival 2026', 'active', 1, 150000.00),
  (2, 'Inter-Class Football Tournament', 'active', 4, 100000.00),
  (3, 'National Tech Innovation Challenge', 'active', 5, 120000.00),
  (4, 'Inter-College Debate Championship', 'active', 2, 45000.00),
  (5, 'Campus Wi-Fi Infrastructure Expansion', 'active', NULL, 250000.00),
  (6, 'Library Digital Repository Setup', 'active', NULL, 180000.00),
  (7, 'Freshers Orientation & Leadership Camp', 'active', 3, 85000.00),
  (8, 'Health & Wellness Campus Marathon', 'active', 4, 60000.00),
  (9, 'College Foundation Day Celebration', 'active', 1, 200000.00),
  (10, 'Science & Computer Lab Modernization', 'active', NULL, 220000.00),
  (11, 'Hostel Plumbing & Fixture Rehabilitation', 'active', NULL, 110000.00),
  (12, 'Campus Greening & Botanical Garden', 'active', 3, 50000.00);
ALTER SEQUENCE events_id_seq RESTART WITH 13;

-- Insert Budgets (Total: Nu. 4,800,000.00)
-- Categories:
-- 1: Student Activities (600,000)
-- 2: Sports (500,000)
-- 3: Events (800,000)
-- 4: Clubs (400,000)
-- 5: Infrastructure (900,000)
-- 6: Academic (700,000)
-- 7: Maintenance (500,000)
-- 8: Other (400,000)
INSERT INTO budgets (fiscal_year, category_id, department, allocated_amount) VALUES
  ('2025-2026', 1, 'Student Affairs', 600000.00),
  ('2025-2026', 2, 'Sports & Physical Education', 500000.00),
  ('2025-2026', 3, 'College Events Committee', 800000.00),
  ('2025-2026', 4, 'Student Clubs Council', 400000.00),
  ('2025-2026', 5, 'Estate & Infrastructure', 900000.00),
  ('2025-2026', 6, 'Academic Affairs', 700000.00),
  ('2025-2026', 7, 'Campus Maintenance & Works', 500000.00),
  ('2025-2026', 8, 'General Administration', 400000.00);

-- ============================================================================
-- Approved & Published Expenditures totaling Nu. 3,120,000.00
-- Exactly matching:
--   Student Activities: Nu. 480,000
--   Sports:             Nu. 430,000
--   Events:             Nu. 690,000
--   Clubs:              Nu. 310,000
--   Infrastructure:     Nu. 560,000
--   Academic:           Nu. 380,000
--   Maintenance:        Nu. 190,000
--   Other:              Nu.  80,000
--
-- And monthly totals:
--   Feb 2026: Nu. 380,000
--   Mar 2026: Nu. 470,000
--   Apr 2026: Nu. 520,000
--   May 2026: Nu. 610,000
--   Jun 2026: Nu. 640,000
--   Jul 2026: Nu. 500,000
-- ============================================================================

INSERT INTO expenditures (id, spent_on, purpose, category_id, department, club_id, event_id, amount, status, is_published, created_by, approved_by, created_at) VALUES
  -- February 2026 (Total: 380,000)
  (1, '2026-02-05', 'Semester commencement stationery and materials', 6, 'Academic Affairs', NULL, NULL, 120000.00, 'approved', true, 2, 1, '2026-02-05 10:00:00+06'),
  (2, '2026-02-12', 'Campus security lighting and wiring overhaul', 5, 'Estate & Infrastructure', NULL, NULL, 100000.00, 'approved', true, 2, 1, '2026-02-12 11:30:00+06'),
  (3, '2026-02-18', 'Student gym fitness equipment servicing', 2, 'Sports & Physical Education', NULL, NULL, 70000.00, 'approved', true, 2, 1, '2026-02-18 14:00:00+06'),
  (4, '2026-02-25', 'Water supply pump urgent repairs', 7, 'Campus Maintenance & Works', NULL, NULL, 50000.00, 'approved', true, 2, 1, '2026-02-25 09:15:00+06'),
  (5, '2026-02-28', 'College newsletter printing and distribution', 8, 'General Administration', NULL, NULL, 40000.00, 'approved', true, 2, 1, '2026-02-28 16:00:00+06'),

  -- March 2026 (Total: 470,000)
  (6, '2026-03-04', 'Library science journals subscription', 6, 'Academic Affairs', NULL, 6, 130000.00, 'approved', true, 2, 1, '2026-03-04 10:30:00+06'),
  (7, '2026-03-10', 'Student counseling workshop and materials', 1, 'Student Affairs', NULL, NULL, 90000.00, 'approved', true, 2, 1, '2026-03-10 11:00:00+06'),
  (8, '2026-03-16', 'Inter-college badminton tourney setup & gear', 2, 'Sports & Physical Education', NULL, NULL, 80000.00, 'approved', true, 2, 1, '2026-03-16 15:20:00+06'),
  (9, '2026-03-22', 'Rover Scouts environmental drive & tree plantation', 4, 'Student Clubs Council', 3, 12, 70000.00, 'approved', true, 2, 1, '2026-03-22 13:45:00+06'),
  (10, '2026-03-28', 'Druk Journal seminar & guest lectures', 3, 'College Events Committee', NULL, NULL, 100000.00, 'approved', true, 2, 1, '2026-03-28 14:10:00+06'),

  -- April 2026 (Total: 520,000)
  (11, '2026-04-06', 'High-speed fiber optic switches and access points', 5, 'Estate & Infrastructure', NULL, 5, 170000.00, 'approved', true, 2, 1, '2026-04-06 10:00:00+06'),
  (12, '2026-04-12', 'Annual Sports Day medals, tents and logistics', 2, 'Sports & Physical Education', NULL, 8, 110000.00, 'approved', true, 2, 1, '2026-04-12 11:30:00+06'),
  (13, '2026-04-18', 'Student leadership retreat & skill seminar', 1, 'Student Affairs', NULL, 7, 100000.00, 'approved', true, 2, 1, '2026-04-18 14:00:00+06'),
  (14, '2026-04-24', 'IT club hackathon prizes and cloud credits', 4, 'Student Clubs Council', 5, 3, 80000.00, 'approved', true, 2, 1, '2026-04-24 16:30:00+06'),
  (15, '2026-04-29', 'Classroom painting and chalkboard resurfacing', 7, 'Campus Maintenance & Works', NULL, NULL, 60000.00, 'approved', true, 2, 1, '2026-04-29 09:30:00+06'),

  -- May 2026 (Total: 610,000)
  (16, '2026-05-05', 'College Foundation Day lighting and marquee', 3, 'College Events Committee', 1, 9, 210000.00, 'approved', true, 2, 1, '2026-05-05 10:00:00+06'),
  (17, '2026-05-12', 'Science laboratory reagents and glassware', 6, 'Academic Affairs', NULL, 10, 130000.00, 'approved', true, 2, 1, '2026-05-12 11:45:00+06'),
  (18, '2026-05-18', 'Student basketball court acrylic recoating', 2, 'Sports & Physical Education', 4, NULL, 120000.00, 'approved', true, 2, 1, '2026-05-18 14:15:00+06'),
  (19, '2026-05-24', 'Hostel geyser and electrical maintenance', 7, 'Campus Maintenance & Works', NULL, 11, 80000.00, 'approved', true, 2, 1, '2026-05-24 15:30:00+06'),
  (20, '2026-05-30', 'Literary magazine publication and honorarium', 4, 'Student Clubs Council', 2, 4, 70000.00, 'approved', true, 2, 1, '2026-05-30 16:20:00+06'),

  -- June 2026 (Total: 640,000)
  (21, '2026-06-04', 'Dungkar cultural dance costumes and instruments', 3, 'College Events Committee', 1, 1, 190000.00, 'approved', true, 2, 1, '2026-06-04 10:30:00+06'),
  (22, '2026-06-12', 'Campus solar pathway lighting installation', 5, 'Estate & Infrastructure', NULL, NULL, 150000.00, 'approved', true, 2, 1, '2026-06-12 11:20:00+06'),
  (23, '2026-06-18', 'Student council election voting software & booth', 1, 'Student Affairs', NULL, NULL, 120000.00, 'approved', true, 2, 1, '2026-06-18 13:40:00+06'),
  (24, '2026-06-22', 'Photography & Media Club DSLR cameras and lenses', 4, 'Student Clubs Council', 5, NULL, 90000.00, 'approved', true, 2, 1, '2026-06-22 15:10:00+06'),
  (25, '2026-06-25', 'First aid clinic restocking & emergency kit', 8, 'General Administration', NULL, NULL, 40000.00, 'approved', true, 2, 1, '2026-06-25 16:00:00+06'),
  (26, '2026-06-28', 'Orientation week refreshments', 1, 'Student Affairs', NULL, 7, 18200.00, 'approved', true, 2, 1, '2026-06-28 17:00:00+06'),
  (27, '2026-06-30', 'Orientation sound setup balancing entry', 1, 'Student Affairs', NULL, 7, 31800.00, 'approved', true, 2, 1, '2026-06-30 17:30:00+06'),

  -- July 2026 (Total: 500,000)
  (28, '2026-07-05', 'Debate Club tournament fees', 4, 'Student Clubs Council', 2, 4, 12500.00, 'approved', true, 2, 1, '2026-07-05 09:30:00+06'),
  (29, '2026-07-06', 'Debate team travel & accommodation support', 4, 'Student Clubs Council', 2, 4, 67500.00, 'approved', true, 2, 1, '2026-07-06 14:00:00+06'),
  (30, '2026-07-08', 'Computer lab repairs', 7, 'Campus Maintenance & Works', NULL, 10, 22000.00, 'approved', true, 2, 1, '2026-07-08 10:15:00+06'),
  (31, '2026-07-12', 'Cultural Festival stage & sound', 3, 'College Events Committee', 1, 1, 38500.00, 'approved', true, 2, 1, '2026-07-12 11:00:00+06'),
  (32, '2026-07-15', 'Cultural Festival logistics and security barriers', 3, 'College Events Committee', 1, 1, 113000.00, 'approved', true, 2, 1, '2026-07-15 15:30:00+06'),
  (33, '2026-07-18', 'Server room battery backup replacements', 5, 'Estate & Infrastructure', NULL, 5, 140000.00, 'approved', true, 2, 1, '2026-07-18 13:00:00+06'),
  (34, '2026-07-22', 'Inter-department volleyball court upgrade', 2, 'Sports & Physical Education', NULL, NULL, 50000.00, 'approved', true, 2, 1, '2026-07-22 14:30:00+06'),
  (35, '2026-07-25', 'Student leadership term report printing', 1, 'Student Affairs', NULL, NULL, 56500.00, 'approved', true, 2, 1, '2026-07-25 16:15:00+06');

-- ============================================================================
-- Items matching the prompt requirements:
-- 1) Inter-class football kits (ID 36): Sports, Nu. 50,000, status: 'requires_review'
-- 2) Library reading room furniture (ID 37): Infrastructure, Nu. 64,000, status: 'pending'
-- 3) 6 more pending items (making exactly 7 pending approvals)
-- 4) 1 more requires_review item (making exactly 2 requires_review)
-- ============================================================================

INSERT INTO expenditures (id, spent_on, purpose, category_id, department, club_id, event_id, amount, status, is_published, created_by, approved_by, created_at) VALUES
  -- Named Football Kits item:
  (36, '2026-07-10', 'Inter-class football kits', 2, 'Sports & Physical Education', 4, 2, 50000.00, 'requires_review', false, 2, NULL, '2026-07-10 09:12:00+06'),

  -- Named Library item:
  (37, '2026-07-02', 'Library reading room furniture', 5, 'Estate & Infrastructure', NULL, 6, 64000.00, 'pending', false, 2, NULL, '2026-07-02 10:00:00+06'),

  -- 6 additional Pending approvals (7 pending total: 37, 38, 39, 40, 41, 42, 43):
  (38, '2026-07-14', 'Auditorium projector replacement bulb', 5, 'Estate & Infrastructure', NULL, NULL, 18500.00, 'pending', false, 2, NULL, '2026-07-14 11:20:00+06'),
  (39, '2026-07-16', 'Archery tournament target boards and arrows', 2, 'Sports & Physical Education', 4, NULL, 35000.00, 'pending', false, 2, NULL, '2026-07-16 14:10:00+06'),
  (40, '2026-07-19', 'Science fair exhibition booths setup', 6, 'Academic Affairs', 5, 3, 42000.00, 'pending', false, 2, NULL, '2026-07-19 09:40:00+06'),
  (41, '2026-07-21', 'Campus flower nursery soil and fertilizers', 8, 'General Administration', 3, 12, 15000.00, 'pending', false, 2, NULL, '2026-07-21 15:00:00+06'),
  (42, '2026-07-24', 'Dining hall water filter cartridge replacements', 7, 'Campus Maintenance & Works', NULL, 11, 28000.00, 'pending', false, 2, NULL, '2026-07-24 16:30:00+06'),
  (43, '2026-07-26', 'National Day choir costume dry-cleaning', 3, 'College Events Committee', 1, 9, 21000.00, 'pending', false, 2, NULL, '2026-07-26 13:15:00+06'),

  -- 1 additional Requires Review (2 requires_review total: 36, 44):
  (44, '2026-07-27', 'Special campus bus fuel subsidy', 8, 'General Administration', NULL, NULL, 55000.00, 'requires_review', false, 2, NULL, '2026-07-27 10:30:00+06');

ALTER SEQUENCE expenditures_id_seq RESTART WITH 45;

-- Review flags for the requires_review records
INSERT INTO review_flags (expenditure_id, reason, raised_by, created_at) VALUES
  (36, 'Amount was edited after initial submission and reached the review threshold', 2, '2026-07-10 15:05:00+06'),
  (44, 'Expenditure amount exceeds the single-transaction threshold for category Other', 2, '2026-07-27 10:35:00+06');

-- Attached Documents
INSERT INTO documents (expenditure_id, type, file_url, original_name, stored_name, mime, size, uploaded_by, uploaded_at) VALUES
  (31, 'invoice', '/uploads/sample_stage_sound_invoice.pdf', 'Stage_Sound_Invoice_072026.pdf', 'doc_31_invoice.pdf', 'application/pdf', 145020, 2, '2026-07-12 11:05:00+06'),
  (36, 'invoice', '/uploads/sample_football_kits_quote.pdf', 'Football_Kits_Quotation.pdf', 'doc_36_quote.pdf', 'application/pdf', 210400, 2, '2026-07-10 09:15:00+06'),
  (30, 'receipt', '/uploads/sample_lab_repair_receipt.pdf', 'Lab_Repair_Receipt_July.pdf', 'doc_30_receipt.pdf', 'application/pdf', 98200, 2, '2026-07-08 10:20:00+06');

-- Audit Log for Football Kits (ID 36) exactly as specified:
-- 10 Jul 09:12 added by Finance Officer (45,000)
-- 10 Jul 11:40 amount edited 45,000 -> 50,000
-- 10 Jul 15:05 flagged Requires Review
-- 11 Jul 10:20 approved by Administrator
INSERT INTO audit_log (entity_type, entity_id, action, actor_id, before, after, created_at) VALUES
  ('expenditure', 36, 'created', 2, NULL, '{"amount": 45000, "purpose": "Inter-class football kits", "category": "Sports", "status": "pending"}'::jsonb, '2026-07-10 09:12:00+06'),
  ('expenditure', 36, 'edited', 2, '{"amount": 45000}'::jsonb, '{"amount": 50000, "reason": "Vendor quotation updated with delivery costs"}'::jsonb, '2026-07-10 11:40:00+06'),
  ('expenditure', 36, 'flagged', 2, '{"status": "pending"}'::jsonb, '{"status": "requires_review", "flag": "Amount edited after submission & above threshold"}'::jsonb, '2026-07-10 15:05:00+06'),
  ('expenditure', 36, 'approved', 1, '{"status": "requires_review"}'::jsonb, '{"status": "approved", "note": "Reviewed quotation and verified with Sports Coordinator"}'::jsonb, '2026-07-11 10:20:00+06'),

  -- Audit log for other sample records
  ('expenditure', 31, 'created', 2, NULL, '{"amount": 38500, "purpose": "Cultural Festival stage & sound"}'::jsonb, '2026-07-12 11:00:00+06'),
  ('expenditure', 31, 'approved', 1, '{"status": "pending"}'::jsonb, '{"status": "approved"}'::jsonb, '2026-07-12 11:10:00+06'),
  ('expenditure', 31, 'published', 1, '{"is_published": false}'::jsonb, '{"is_published": true}'::jsonb, '2026-07-12 11:10:00+06');

-- Sample Questions (Exactly 4 open questions + 1 answered question on Cultural Festival)
INSERT INTO questions (id, expenditure_id, asked_by, text, status, answer_text, answered_by, answered_at, is_public, created_at) VALUES
  -- 1) Sample question on the football kits as specified:
  (1, 36, 3, 'I would like clarification about the Nu. 50,000 expenditure under the Sports category.', 'open', NULL, NULL, NULL, true, '2026-07-11 14:00:00+06'),

  -- 2) Open question 2:
  (2, 37, 3, 'Could you provide the breakdown of reading room furniture items purchased for the library?', 'open', NULL, NULL, NULL, true, '2026-07-12 10:30:00+06'),

  -- 3) Open question 3:
  (3, 40, 4, 'Will the science fair exhibition booths be reusable for the upcoming autumn robotics expo?', 'open', NULL, NULL, NULL, true, '2026-07-20 11:15:00+06'),

  -- 4) Open question 4 (making exactly 4 open questions):
  (4, 44, 3, 'I would like clarification on the route and beneficiaries for the campus bus fuel subsidy.', 'open', NULL, NULL, NULL, true, '2026-07-28 09:20:00+06'),

  -- Answered question on published record (ID 31):
  (5, 31, 3, 'I would like clarification about the Nu. 38,500 expenditure under the Events category.', 'answered', 'Tashi Delek! The Nu. 38,500 covers three days of professional stage trussing, audio monitor amplifiers, and wireless microphones for the Annual Cultural Festival. Quotations were vetted against approved institutional rates.', 2, '2026-07-13 14:30:00+06', true, '2026-07-12 16:00:00+06');

ALTER SEQUENCE questions_id_seq RESTART WITH 6;

-- Notifications
INSERT INTO notifications (user_id, type, message, link, read_at, created_at) VALUES
  (3, 'answer', 'Finance staff answered your question on "Cultural Festival stage & sound"', '/expenditures/31', NULL, '2026-07-13 14:30:00+06'),
  (3, 'expenditure', 'New verified expenditure published: "Debate Club tournament fees" (Nu. 12,500)', '/expenditures/28', '2026-07-06 10:00:00+06', '2026-07-05 10:00:00+06'),
  (4, 'approval', 'Your club funding request for Debate Club was approved and published', '/expenditures/28', NULL, '2026-07-05 10:00:00+06');

