-- Organizations
INSERT INTO organizations (id, name, description, logo_url, website, created_at, updated_at)
VALUES
  (1, 'EcoStream', 'Sustainable video streaming platform with carbon-neutral infrastructure', '/placeholder.svg?height=40&width=40', 'https://ecostream.example.com', NOW(), NOW()),
  (2, 'Harvest', 'Farm-to-table marketplace connecting local farmers with consumers', '/placeholder.svg?height=40&width=40', 'https://harvest.example.com', NOW(), NOW()),
  (3, 'Nomad Workspace', 'Global network of sustainable co-working spaces for digital nomads', '/placeholder.svg?height=40&width=40', 'https://nomadworkspace.example.com', NOW(), NOW()),
  (4, 'GreenFinance', 'Ethical banking and investment platform focused on sustainability', '/placeholder.svg?height=40&width=40', 'https://greenfinance.example.com', NOW(), NOW()),
  (5, 'CarbonTrack', 'Personal carbon footprint tracking and offsetting app', '/placeholder.svg?height=40&width=40', 'https://carbontrack.example.com', NOW(), NOW()),
  (6, 'EduAccess', 'Affordable online education platform with income-sharing agreements', '/placeholder.svg?height=40&width=40', 'https://eduaccess.example.com', NOW(), NOW()),
  (7, 'LocalCraft', 'Marketplace for handmade goods from local artisans with sustainable practices', '/placeholder.svg?height=40&width=40', 'https://localcraft.example.com', NOW(), NOW()),
  (8, 'MindfulTech', 'Digital wellbeing tools and mindfulness applications for better mental health', '/placeholder.svg?height=40&width=40', 'https://mindfultech.example.com', NOW(), NOW()),
  (9, 'SolarShare', 'Community solar energy platform allowing users to invest in renewable energy', '/placeholder.svg?height=40&width=40', 'https://solarshare.example.com', NOW(), NOW());

-- Users
INSERT INTO users (id, full_name, email, avatar_url, location_id, contribution_details, created_at, updated_at)
VALUES
  (1, 'Alex Rivera', 'alex@example.com', '/placeholder.svg?height=40&width=40', 1, 'Community Moderator', NOW() - INTERVAL '6 MONTH', NOW()),
  (2, 'Jamie Chen', 'jamie@example.com', '/placeholder.svg?height=40&width=40', 2, 'Content Creator', NOW() - INTERVAL '4 MONTH', NOW()),
  (3, 'Sam Washington', 'sam@example.com', '/placeholder.svg?height=40&width=40', 3, 'Developer', NOW() - INTERVAL '8 MONTH', NOW()),
  (4, 'Taylor Kim', 'taylor@example.com', '/placeholder.svg?height=40&width=40', 4, 'Translator', NOW() - INTERVAL '3 MONTH', NOW()),
  (5, 'Jordan Patel', 'jordan@example.com', '/placeholder.svg?height=40&width=40', 5, 'Educator', NOW() - INTERVAL '5 MONTH', NOW()),
  (6, 'Morgan Silva', 'morgan@example.com', '/placeholder.svg?height=40&width=40', 6, 'Designer', NOW() - INTERVAL '2 MONTH', NOW()),
  (7, 'Casey Jones', 'casey@example.com', '/placeholder.svg?height=40&width=40', 7, 'Researcher', NOW() - INTERVAL '7 MONTH', NOW()),
  (8, 'Riley Nguyen', 'riley@example.com', '/placeholder.svg?height=40&width=40', 8, 'Advocate', NOW() - INTERVAL '1 MONTH', NOW()),
  (9, 'Avery Smith', 'avery@example.com', '/placeholder.svg?height=40&width=40', 1, 'Writer', NOW() - INTERVAL '9 MONTH', NOW()),
  (10, 'Quinn Johnson', 'quinn@example.com', '/placeholder.svg?height=40&width=40', 2, 'Analyst', NOW() - INTERVAL '5 MONTH', NOW()),
  (11, 'Reese Garcia', 'reese@example.com', '/placeholder.svg?height=40&width=40', 3, 'Marketer', NOW() - INTERVAL '3 MONTH', NOW()),
  (12, 'Dakota Lee', 'dakota@example.com', '/placeholder.svg?height=40&width=40', 4, 'Product Manager', NOW() - INTERVAL '6 MONTH', NOW());

-- User Emails
-- INSERT INTO user_emails (user_id, email, is_primary, is_verified, created_at, updated_at)
-- VALUES
--   (1, 'alex@example.com', true, true, NOW(), NOW()),
--   (2, 'jamie@example.com', true, true, NOW(), NOW()),
--   (3, 'sam@example.com', true, true, NOW(), NOW()),
--   (4, 'taylor@example.com', true, true, NOW(), NOW()),
--   (5, 'jordan@example.com', true, true, NOW(), NOW()),
--   (6, 'morgan@example.com', true, true, NOW(), NOW()),
--   (7, 'casey@example.com', true, true, NOW(), NOW()),
--   (8, 'riley@example.com', true, true, NOW(), NOW()),
--   (9, 'avery@example.com', true, true, NOW(), NOW()),
--   (10, 'quinn@example.com', true, true, NOW(), NOW()),
--   (11, 'reese@example.com', true, true, NOW(), NOW()),
--   (12, 'dakota@example.com', true, true, NOW(), NOW());

-- Wallet Accounts
INSERT INTO wallet_accounts (user_id, wallet_address, wallet_type, wallet_name, is_primary, created_at, updated_at)
VALUES
  (1, '0x1234567890abcdef1234567890abcdef12345678', 'ethereum', 'Main Wallet', true, NOW(), NOW()),
  (2, '0x2345678901abcdef2345678901abcdef23456789', 'ethereum', 'Main Wallet', true, NOW(), NOW()),
  (3, '0x3456789012abcdef3456789012abcdef34567890', 'ethereum', 'Main Wallet', true, NOW(), NOW()),
  (4, '0x4567890123abcdef4567890123abcdef45678901', 'ethereum', 'Main Wallet', true, NOW(), NOW()),
  (5, '0x5678901234abcdef5678901234abcdef56789012', 'ethereum', 'Main Wallet', true, NOW(), NOW()),
  (6, '0x6789012345abcdef6789012345abcdef67890123', 'ethereum', 'Main Wallet', true, NOW(), NOW()),
  (7, '0x7890123456abcdef7890123456abcdef78901234', 'ethereum', 'Main Wallet', true, NOW(), NOW()),
  (8, '0x8901234567abcdef8901234567abcdef89012345', 'ethereum', 'Main Wallet', true, NOW(), NOW()),
  (9, '0x9012345678abcdef9012345678abcdef90123456', 'ethereum', 'Main Wallet', true, NOW(), NOW()),
  (10, '0x0123456789abcdef0123456789abcdef01234567', 'ethereum', 'Main Wallet', true, NOW(), NOW()),
  (11, '0xabcdef1234567890abcdef1234567890abcdef12', 'ethereum', 'Main Wallet', true, NOW(), NOW()),
  (12, '0xbcdef1234567890abcdef1234567890abcdef123', 'ethereum', 'Main Wallet', true, NOW(), NOW());

-- User Profiles
-- INSERT INTO user_profiles (id, location_id, bio, avatar_url, created_at, updated_at)
-- VALUES
--   (1, '1', 'Community Moderator', '/placeholder.svg?height=40&width=40', NOW(), NOW()),
--   (2, '2', 'Content Creator', '/placeholder.svg?height=40&width=40', NOW(), NOW()),
--   (3, '3', 'Developer', '/placeholder.svg?height=40&width=40', NOW(), NOW()),
--   (4, '4', 'Translator', '/placeholder.svg?height=40&width=40', NOW(), NOW()),
--   (5, '5', 'Educator', '/placeholder.svg?height=40&width=40', NOW(), NOW()),
--   (6, '6', 'Designer', '/placeholder.svg?height=40&width=40', NOW(), NOW()),
--   (7, '7', 'Researcher', '/placeholder.svg?height=40&width=40', NOW(), NOW()),
--   (8, '7', 'Advocate', '/placeholder.svg?height=40&width=40', NOW(), NOW()),
--   (9, '8', 'Writer', '/placeholder.svg?height=40&width=40', NOW(), NOW()),
--   (10, '1', 'Analyst', '/placeholder.svg?height=40&width=40', NOW(), NOW()),
--   (11, '2', 'Marketer', '/placeholder.svg?height=40&width=40', NOW(), NOW()),
--   (12, '4', 'Product Manager', '/placeholder.svg?height=40&width=40', NOW(), NOW());

-- Projects
INSERT INTO projects (id, organization_id, name, description, logo_url, website, category_id, created_at, updated_at)
VALUES
  (1, 1, 'EcoStream', 'Sustainable video streaming platform with carbon-neutral infrastructure', '/placeholder.svg?height=40&width=40', 'https://ecostream.example.com', 1, NOW() - INTERVAL '3 MONTH', NOW()),
  (2, 2, 'Harvest', 'Farm-to-table marketplace connecting local farmers with consumers', '/placeholder.svg?height=40&width=40', 'https://harvest.example.com', 2, NOW() - INTERVAL '5 MONTH', NOW()),
  (3, 3, 'Nomad Workspace', 'Global network of sustainable co-working spaces for digital nomads', '/placeholder.svg?height=40&width=40', 'https://nomadworkspace.example.com', 3, NOW() - INTERVAL '2 MONTH', NOW()),
  (4, 4, 'GreenFinance', 'Ethical banking and investment platform focused on sustainability', '/placeholder.svg?height=40&width=40', 'https://greenfinance.example.com', 4, NOW() - INTERVAL '4 MONTH', NOW()),
  (5, 5, 'CarbonTrack', 'Personal carbon footprint tracking and offsetting app', '/placeholder.svg?height=40&width=40', 'https://carbontrack.example.com', 5, NOW() - INTERVAL '1 MONTH', NOW()),
  (6, 6, 'EduAccess', 'Affordable online education platform with income-sharing agreements', '/placeholder.svg?height=40&width=40', 'https://eduaccess.example.com', 6, NOW() - INTERVAL '6 MONTH', NOW()),
  (7, 7, 'LocalCraft', 'Marketplace for handmade goods from local artisans with sustainable practices', '/placeholder.svg?height=40&width=40', 'https://localcraft.example.com', 7, NOW() - INTERVAL '8 MONTH', NOW()),
  (8, 8, 'MindfulTech', 'Digital wellbeing tools and mindfulness applications for better mental health', '/placeholder.svg?height=40&width=40', 'https://mindfultech.example.com', 8, NOW() - INTERVAL '4 MONTH', NOW()),
  (9, 9, 'SolarShare', 'Community solar energy platform allowing users to invest in renewable energy', '/placeholder.svg?height=40&width=40', 'https://solarshare.example.com', 9, NOW() - INTERVAL '7 MONTH', NOW());

-- Project Stats
INSERT INTO project_stats (project_id, user_count, monthly_revenue, pledge_amount, created_at, updated_at)
VALUES
  (1, 12500, 125000, 1250, NOW(), NOW()),
  (2, 8700, 87000, 870, NOW(), NOW()),
  (3, 15200, 152000, 1520, NOW(), NOW()),
  (4, 9300, 93000, 930, NOW(), NOW()),
  (5, 22100, 221000, 2210, NOW(), NOW()),
  (6, 18400, 184000, 1840, NOW(), NOW()),
  (7, 7600, 76000, 760, NOW(), NOW()),
  (8, 14300, 143000, 1430, NOW(), NOW()),
  (9, 11200, 112000, 1120, NOW(), NOW());

-- User Project Participation
INSERT INTO user_project_participation (user_id, project_id, role, joined_at, created_at, updated_at)
VALUES
  (1, 1, 'Community Moderator', NOW() - INTERVAL '3 MONTH', NOW(), NOW()),
  (1, 2, 'Contributor', NOW() - INTERVAL '2 MONTH', NOW(), NOW()),
  (1, 3, 'Contributor', NOW() - INTERVAL '1 MONTH', NOW(), NOW()),
  (2, 2, 'Content Creator', NOW() - INTERVAL '4 MONTH', NOW(), NOW()),
  (2, 4, 'Contributor', NOW() - INTERVAL '3 MONTH', NOW(), NOW()),
  (3, 3, 'Developer', NOW() - INTERVAL '8 MONTH', NOW(), NOW()),
  (3, 5, 'Contributor', NOW() - INTERVAL '6 MONTH', NOW(), NOW()),
  (3, 7, 'Contributor', NOW() - INTERVAL '4 MONTH', NOW(), NOW()),
  (4, 4, 'Translator', NOW() - INTERVAL '3 MONTH', NOW(), NOW()),
  (4, 6, 'Contributor', NOW() - INTERVAL '2 MONTH', NOW(), NOW()),
  (5, 5, 'Educator', NOW() - INTERVAL '5 MONTH', NOW(), NOW()),
  (5, 8, 'Contributor', NOW() - INTERVAL '3 MONTH', NOW(), NOW()),
  (6, 6, 'Designer', NOW() - INTERVAL '2 MONTH', NOW(), NOW()),
  (6, 9, 'Contributor', NOW() - INTERVAL '1 MONTH', NOW(), NOW()),
  (7, 7, 'Researcher', NOW() - INTERVAL '7 MONTH', NOW(), NOW()),
  (7, 1, 'Contributor', NOW() - INTERVAL '5 MONTH', NOW(), NOW()),
  (8, 8, 'Advocate', NOW() - INTERVAL '1 MONTH', NOW(), NOW()),
  (8, 2, 'Contributor', NOW() - INTERVAL '0.5 MONTH', NOW(), NOW()),
  (9, 9, 'Writer', NOW() - INTERVAL '9 MONTH', NOW(), NOW()),
  (9, 3, 'Contributor', NOW() - INTERVAL '7 MONTH', NOW(), NOW()),
  (10, 1, 'Analyst', NOW() - INTERVAL '5 MONTH', NOW(), NOW()),
  (10, 4, 'Contributor', NOW() - INTERVAL '3 MONTH', NOW(), NOW()),
  (11, 2, 'Marketer', NOW() - INTERVAL '3 MONTH', NOW(), NOW()),
  (11, 5, 'Contributor', NOW() - INTERVAL '2 MONTH', NOW(), NOW()),
  (12, 3, 'Product Manager', NOW() - INTERVAL '6 MONTH', NOW(), NOW()),
  (12, 6, 'Contributor', NOW() - INTERVAL '4 MONTH', NOW(), NOW());

-- Blog Posts
INSERT INTO blog_posts (id, title, slug, excerpt, content, author_id, published_at, created_at, updated_at, is_support, category, subtitle, picture)
VALUES
  (1, 'Introducing FundLoop: A New Economic Model for Digital Communities', 'introducing-fundloop', 'Learn how FundLoop is creating a sustainable economic model for the digital age through mutual prosperity.', 'Full content of the blog post goes here...', 1, NOW() - INTERVAL '2 WEEK', NOW() - INTERVAL '2 WEEK', NOW(), FALSE, NULL, NULL, '/placeholder.jpg?height=400&width=800'),
  (2, 'Why Projects Are Joining the 1% Pledge Movement', 'why-projects-joining-pledge', 'Discover the benefits that projects are experiencing after joining the FundLoop ecosystem.', 'Full content of the blog post goes here...', 3, NOW() - INTERVAL '1 WEEK', NOW() - INTERVAL '1 WEEK', NOW(), FALSE, NULL, NULL, '/placeholder.jpg?height=400&width=800'),
  (3, 'The Math Behind Citizen Salaries: How FundLoop Distributes Value', 'math-behind-citizen-salaries', 'A deep dive into how FundLoop calculates and distributes citizen salaries to active members.', 'Full content of the blog post goes here...', 5, NOW() - INTERVAL '3 DAY', NOW() - INTERVAL '3 DAY', NOW(), FALSE, NULL, NULL, '/placeholder.jpg?height=400&width=800'),
  (4, 'Building a Network State: Lessons from Month One', 'building-network-state-lessons', 'Reflections on the challenges and successes from our first month of building the FundLoop network state.', 'Full content of the blog post goes here...', 9, NOW() - INTERVAL '1 MONTH', NOW() - INTERVAL '1 MONTH', NOW(), FALSE, NULL, NULL, '/placeholder.jpg?height=400&width=800'),
  (5, 'How to Maximize Your Contributions to the FundLoop Ecosystem', 'maximize-contributions-fundloop', 'Tips and strategies for users to increase their participation and value within the network.', 'Full content of the blog post goes here...', 7, NOW() - INTERVAL '6 WEEK', NOW() - INTERVAL '6 WEEK', NOW(), FALSE, NULL, NULL, '/placeholder.jpg?height=400&width=800');

-- Monthly Network Stats (for analytics)
INSERT INTO monthly_network_stats (month, year, total_funds, project_count, user_count, avg_salary, created_at, updated_at)
VALUES
  (1, 2023, 120000, 42, 8500, 14.12, NOW(), NOW()),
  (2, 2023, 145000, 48, 9200, 15.76, NOW(), NOW()),
  (3, 2023, 162000, 53, 10100, 16.04, NOW(), NOW()),
  (4, 2023, 190000, 61, 11500, 16.52, NOW(), NOW()),
  (5, 2023, 215000, 68, 13200, 16.29, NOW(), NOW()),
  (6, 2023, 252000, 74, 15800, 15.95, NOW(), NOW()),
  (7, 2023, 278000, 79, 18400, 15.11, NOW(), NOW()),
  (8, 2023, 305000, 85, 21000, 14.52, NOW(), NOW()),
  (9, 2023, 342000, 92, 24500, 13.96, NOW(), NOW()),
  (10, 2023, 380000, 98, 28200, 13.48, NOW(), NOW()),
  (11, 2023, 425000, 105, 32100, 13.24, NOW(), NOW()),
  (12, 2023, 480000, 112, 36500, 13.15, NOW(), NOW());

-- Support Requests
INSERT INTO support_requests (name, email, subject, category, message, created_at) VALUES ('Test User', 'test@example.com', 'General Question', 'general', 'How do I use FundLoop?', NOW());

