-- Canonical reference data for environments that never run supabase/seed.sql.
-- seed.sql is local/demo data, so a freshly migrated database (FundLoop Prod) would have empty
-- dropdowns, payment statuses and taxonomies. Rows are taken from FundLoop Dev, the canonical
-- source, without Dev-specific usage counts, timestamps or actor references.
-- Idempotent: ON CONFLICT DO NOTHING, and sequences are advanced only when they lag.

INSERT INTO public.ref_genders (id, name, display_order) VALUES
  (1, 'Male', 1),
  (2, 'Female', 2),
  (3, 'Non-binary', 3),
  (5, 'Prefer not to say', 4)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.ref_invitation_statuses (id, name, code, description, display_order) VALUES
  (1, 'Pending', 'pending', 'Invitation has been sent but not yet accepted or declined', 1),
  (2, 'Accepted', 'accepted', 'Invitation has been accepted', 2),
  (3, 'Declined', 'declined', 'Invitation has been declined', 3),
  (4, 'Expired', 'expired', 'Invitation has expired', 4)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.ref_payment_periodicities (id, name, code, description, display_order) VALUES
  (1, 'Weekly', 'week', 'Payment periods are calculated weekly', 2),
  (2, 'Monthly', 'month', 'Payment periods are calculated monthly', 3),
  (3, 'Custom', 'custom', 'Payment periods are calculated based on a custom number of days', 6),
  (4, 'Daily', 'day', 'Payment periods are calculated daily', 1),
  (5, 'Quartely', 'quarter', 'Payment periods are calculated quarterly', 4),
  (6, 'Annually', 'year', 'Payment periods are calculated annually', 5)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.ref_payment_statuses (id, name, code, description, display_order) VALUES
  (1, 'Draft', 'draft', 'Payment record created but not submitted', 1),
  (2, 'Pending', 'pending', 'Payment is pending processing', 2),
  (3, 'Awaiting Confirmation', 'awaiting_confirmation', 'Payment has been made and is awaiting confirmation', 3),
  (4, 'Confirmed', 'confirmed', 'Payment has been confirmed', 4),
  (5, 'Failed', 'failed', 'Payment failed to process', 5)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.ref_social_platforms (id, name, code, description, display_order, is_selectable) VALUES
  (1, 'Twitter (X)', 'twitter', 'The platform formerly known as Twitter. Microblogging and social commentary.', 1, true),
  (2, 'Facebook', 'facebook', 'Mainstream global social networking platform.', 2, false),
  (3, 'Instagram', 'instagram', 'Photo and video sharing platform owned by Meta.', 3, false),
  (4, 'LinkedIn', 'linkedin', 'Professional social networking and career development platform.', 4, false),
  (5, 'TikTok', 'tiktok', 'Short-form video platform known for viral content.', 5, false),
  (6, 'Reddit', 'reddit', 'Forum-based social platform organized into topic-focused communities.', 6, false),
  (7, 'YouTube', 'youtube', 'Video-sharing platform with social features like subscriptions and comments.', 7, false),
  (8, 'Farcaster', 'farcaster', 'Decentralized social protocol for crypto-native communities.', 8, true),
  (9, 'Bluesky', 'bluesky', 'Federated social network built on the AT Protocol.', 9, false),
  (10, 'Mastodon', 'mastodon', 'Open-source federated microblogging platform.', 10, false),
  (11, 'Lens Protocol', 'lens', 'Web3-native social graph on the Polygon blockchain.', 11, false),
  (12, 'Discord', 'discord', 'Community-based chat platform for teams, creators, and interest groups.', 12, false),
  (13, 'Telegram', 'telegram', 'Encrypted messaging platform with support for bots and public channels.', 13, false),
  (14, 'WhatsApp', 'whatsapp', 'Mobile-first encrypted messaging platform owned by Meta.', 14, false),
  (15, 'Signal', 'signal', 'Privacy-focused encrypted messaging platform.', 15, false),
  (16, 'Slack', 'slack', 'Team communication and collaboration platform popular in workspaces.', 16, false),
  (17, 'WeChat', 'wechat', 'China’s dominant messaging and social platform, developed by Tencent.', 17, false),
  (18, 'Sina Weibo', 'weibo', 'Chinese microblogging platform similar to Twitter.', 18, false),
  (19, 'VK', 'vk', 'Popular Russian social network offering messaging, groups, and media.', 19, false),
  (20, 'LINE', 'line', 'Messaging and social platform widely used in Japan, Thailand, and Taiwan.', 20, false),
  (21, 'KakaoTalk', 'kakaotalk', 'South Korea’s leading messaging and social ecosystem.', 21, false),
  (22, 'Mixi', 'mixi', 'Japanese social network focused on community and games.', 22, false),
  (23, 'Vero', 'vero', 'Ad-free social network emphasizing authentic sharing.', 23, false),
  (24, 'Snapchat', 'snapchat', 'Ephemeral messaging and media sharing app popular with youth.', 24, false),
  (25, 'Orkut', 'orkut', 'Formerly popular in Brazil and India, now relaunched in a new form.', 25, false),
  (26, 'Douyin', 'douyin', 'The Chinese version of TikTok, developed by ByteDance.', 26, false),
  (27, 'Clubhouse', 'clubhouse', 'Audio-first social app for live discussions and communities.', 27, false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.ref_categories (id, name, parent_category) VALUES
  (1, 'Technology', NULL),
  (2, 'Finance', NULL),
  (3, 'Education', NULL),
  (4, 'Health', NULL),
  (5, 'Media', NULL),
  (6, 'Retail', NULL),
  (7, 'Food', NULL),
  (8, 'Energy', NULL),
  (9, 'Transportation', NULL),
  (10, 'Environment', NULL),
  (11, 'Social Impact', NULL),
  (12, 'Entertainment', NULL),
  (13, 'Workspace', NULL),
  (14, 'Housing', NULL),
  (15, 'Art & Culture', NULL),
  (16, 'Sports & Fitness', NULL),
  (17, 'Other', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.ref_interests (id, name, category) VALUES
  (1, 'Technology', 'Technology'),
  (2, 'Environment', 'Environment'),
  (3, 'Social Impact', 'Social'),
  (4, 'Education', 'Education'),
  (5, 'Health', 'Health'),
  (6, 'Finance', 'Finance'),
  (7, 'Arts & Culture', 'Arts'),
  (8, 'Sports', 'Sports'),
  (9, 'Food & Agriculture', 'Food'),
  (10, 'Travel', 'Travel')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.ref_occupations (id, name, category) VALUES
  (1, 'Software Engineer', 'Technology'),
  (2, 'Product Manager', 'Technology'),
  (3, 'Marketing Specialist', 'Marketing'),
  (4, 'Graphic Designer', 'Design'),
  (5, 'Teacher', 'Education'),
  (6, 'Doctor', 'Healthcare'),
  (7, 'Financial Analyst', 'Finance'),
  (8, 'Writer', 'Media'),
  (9, 'Community Moderator', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.ref_locations (id, name, country, region) VALUES
  (1, 'New York, USA', 'USA', 'North America'),
  (2, 'London, UK', 'UK', 'Europe'),
  (3, 'Tokyo, Japan', 'Japan', 'Asia'),
  (4, 'Berlin, Germany', 'Germany', 'Europe'),
  (5, 'Sydney, Australia', 'Australia', 'Oceania'),
  (6, 'Toronto, Canada', 'Canada', 'North America'),
  (7, 'São Paulo, Brazil', 'Brazil', 'South America'),
  (8, 'Mumbai, India', 'India', 'Asia')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.ref_skills (id, name, category) VALUES
  (15, 'JavaScript', 'Programming Language'),
  (16, 'TypeScript', 'Programming Language'),
  (17, 'Python', 'Programming Language'),
  (18, 'Go', 'Programming Language'),
  (19, 'Rust', 'Programming Language'),
  (20, 'Java', 'Programming Language'),
  (21, 'C#', 'Programming Language'),
  (22, 'C++', 'Programming Language'),
  (23, 'SQL', 'Programming Language'),
  (24, 'HTML', 'Programming Language'),
  (25, 'CSS', 'Programming Language'),
  (26, 'React', 'Framework/Library'),
  (27, 'Next.js', 'Framework/Library'),
  (28, 'Vue.js', 'Framework/Library'),
  (29, 'Svelte', 'Framework/Library'),
  (30, 'Node.js', 'Framework/Library'),
  (31, 'Express', 'Framework/Library'),
  (32, 'Django', 'Framework/Library'),
  (33, 'Flask', 'Framework/Library'),
  (34, 'Laravel', 'Framework/Library'),
  (35, 'Tailwind CSS', 'Framework/Library'),
  (36, 'Bootstrap', 'Framework/Library'),
  (37, 'Docker', 'DevOps/Infrastructure'),
  (38, 'Kubernetes', 'DevOps/Infrastructure'),
  (39, 'Terraform', 'DevOps/Infrastructure'),
  (40, 'CI/CD', 'DevOps/Infrastructure'),
  (41, 'GitHub Actions', 'DevOps/Infrastructure'),
  (42, 'AWS', 'DevOps/Infrastructure'),
  (43, 'Azure', 'DevOps/Infrastructure'),
  (44, 'Google Cloud', 'DevOps/Infrastructure'),
  (45, 'PostgreSQL', 'DevOps/Infrastructure'),
  (46, 'MySQL', 'DevOps/Infrastructure'),
  (47, 'Redis', 'DevOps/Infrastructure'),
  (48, 'MongoDB', 'DevOps/Infrastructure'),
  (49, 'Unity', 'Game Development'),
  (50, 'Unreal Engine', 'Game Development'),
  (51, 'Blender', 'Game Development'),
  (52, 'Godot', 'Game Development'),
  (53, 'Cocos2d', 'Game Development'),
  (54, 'Game Design', 'Game Development'),
  (55, '3D Modeling', 'Game Development'),
  (56, 'Animation', 'Game Development'),
  (57, 'Shaders', 'Game Development'),
  (58, 'Network Architecture', 'Networking/Security'),
  (59, 'Cybersecurity', 'Networking/Security'),
  (60, 'Linux', 'Networking/Security'),
  (61, 'Penetration Testing', 'Networking/Security'),
  (62, 'Zero Trust Architecture', 'Networking/Security'),
  (63, 'Firewall Management', 'Networking/Security'),
  (64, 'UI Design', 'Design/UX'),
  (65, 'UX Design', 'Design/UX'),
  (66, 'Figma', 'Design/UX'),
  (67, 'Adobe XD', 'Design/UX'),
  (68, 'User Research', 'Design/UX'),
  (69, 'Accessibility', 'Design/UX'),
  (70, 'Prototyping', 'Design/UX'),
  (71, 'Agile', 'Product/Project'),
  (72, 'Scrum', 'Product/Project'),
  (73, 'Product Management', 'Product/Project'),
  (74, 'Project Management', 'Product/Project'),
  (75, 'Roadmapping', 'Product/Project'),
  (76, 'Sprint Planning', 'Product/Project'),
  (77, 'Jira', 'Product/Project'),
  (78, 'Active Listening', 'Communication & People'),
  (79, 'Nonviolent Communication', 'Communication & People'),
  (80, 'Public Speaking', 'Communication & People'),
  (81, 'Presentation Design', 'Communication & People'),
  (82, 'Conflict Mediation', 'Communication & People'),
  (83, 'Empathy in Collaboration', 'Communication & People'),
  (84, 'Strategic Thinking', 'Strategy & Leadership'),
  (85, 'Vision Setting', 'Strategy & Leadership'),
  (86, 'Organizational Leadership', 'Strategy & Leadership'),
  (87, 'Decision Making', 'Strategy & Leadership'),
  (88, 'Cross-functional Collaboration', 'Strategy & Leadership'),
  (89, 'Change Management', 'Strategy & Leadership'),
  (90, 'Community Management', 'Community & Growth'),
  (91, 'Social Media Strategy', 'Community & Growth'),
  (92, 'Influencer Relations', 'Community & Growth'),
  (93, 'Growth Hacking', 'Community & Growth'),
  (94, 'Brand Evangelism', 'Community & Growth'),
  (95, 'Event Planning', 'Community & Growth'),
  (96, 'Internal Documentation', 'Operations & Process'),
  (97, 'Knowledge Management', 'Operations & Process'),
  (98, 'Workflow Optimization', 'Operations & Process'),
  (99, 'Onboarding Experience', 'Operations & Process'),
  (100, 'Hiring Coordination', 'Operations & Process'),
  (101, 'Remote Team Ops', 'Operations & Process'),
  (102, 'Technical Writing', 'Writing & Storytelling'),
  (103, 'Grant Writing', 'Writing & Storytelling'),
  (104, 'Copywriting', 'Writing & Storytelling'),
  (105, 'Narrative Design', 'Writing & Storytelling'),
  (106, 'Knowledge Sharing', 'Writing & Storytelling'),
  (107, 'Newsletter Writing', 'Writing & Storytelling'),
  (108, 'Fundraising', 'Business & Outreach'),
  (109, 'Partnership Development', 'Business & Outreach'),
  (110, 'Market Research', 'Business & Outreach'),
  (111, 'Pitch Deck Creation', 'Business & Outreach'),
  (112, 'Grant Application Management', 'Business & Outreach'),
  (113, 'Customer Development', 'Business & Outreach')
ON CONFLICT (id) DO NOTHING;

-- Keep identity/serial sequences ahead of the seeded ids.
DO $$
DECLARE
  v_table text;
  v_sequence text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['ref_genders', 'ref_invitation_statuses', 'ref_payment_periodicities', 'ref_payment_statuses', 'ref_social_platforms', 'ref_categories', 'ref_interests', 'ref_occupations', 'ref_locations', 'ref_skills'] LOOP
    v_sequence := pg_get_serial_sequence(format('public.%I', v_table), 'id');
    IF v_sequence IS NOT NULL THEN
      EXECUTE format('SELECT setval(%L, GREATEST((SELECT COALESCE(MAX(id), 1) FROM public.%I), (SELECT last_value FROM %s)), true)', v_sequence, v_table, v_sequence);
    END IF;
  END LOOP;
END $$;
