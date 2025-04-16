-- Insert default values into reference tables
INSERT INTO ref_genders (name, display_order) VALUES 
('Male', 1),
('Female', 2),
('Non-binary', 3),
('Other', 4),
('Prefer not to say', 5);

INSERT INTO ref_roles (name, display_order) VALUES 
('admin', 1),
('member', 2);

INSERT INTO ref_payment_methods (name, code, description, display_order) VALUES 
('Credit Card', 'credit_card', 'Regular monthly charges to your card', 1),
('Bank Transfer', 'bank_transfer', 'Automatic monthly bank transfers', 2),
('Cryptocurrency', 'crypto', 'Pay with Bitcoin, Ethereum, or other cryptocurrencies', 3),
('Revenue Share Integration', 'revenue_share', 'Direct integration with your revenue system', 4),
('Manual Payments', 'manual', 'Receive monthly invoices to pay manually', 5);

INSERT INTO ref_payment_statuses (name, code, description, display_order) VALUES 
('Draft', 'draft', 'Payment record created but not submitted', 1),
('Pending', 'pending', 'Payment is pending processing', 2),
('Awaiting Confirmation', 'awaiting_confirmation', 'Payment has been made and is awaiting confirmation', 3),
('Confirmed', 'confirmed', 'Payment has been confirmed', 4),
('Failed', 'failed', 'Payment failed to process', 5);

INSERT INTO ref_notification_types (name, code, description, display_order) VALUES 
('Invitation', 'invitation', 'Invitation to join an organization', 1),
('Mention', 'mention', 'Mentioned in a comment or post', 2),
('Payment', 'payment', 'Payment notification', 3),
('System', 'system', 'System notification', 4);

INSERT INTO ref_invitation_statuses (name, code, description, display_order) VALUES 
('Pending', 'pending', 'Invitation has been sent but not yet accepted or declined', 1),
('Accepted', 'accepted', 'Invitation has been accepted', 2),
('Declined', 'declined', 'Invitation has been declined', 3),
('Expired', 'expired', 'Invitation has expired', 4);

INSERT INTO ref_payment_periodicities (name, code, description, display_order) VALUES 
('Weekly', 'week', 'Payment periods are calculated weekly', 1),
('Monthly', 'month', 'Payment periods are calculated monthly', 2),
('Custom', 'custom', 'Payment periods are calculated based on a custom number of days', 3);

-- Insert some initial values for search-as-you-type reference tables
INSERT INTO ref_locations (name, country, region) VALUES 
('New York, USA', 'USA', 'North America'),
('London, UK', 'UK', 'Europe'),
('Tokyo, Japan', 'Japan', 'Asia'),
('Berlin, Germany', 'Germany', 'Europe'),
('Sydney, Australia', 'Australia', 'Oceania'),
('Toronto, Canada', 'Canada', 'North America'),
('São Paulo, Brazil', 'Brazil', 'South America'),
('Mumbai, India', 'India', 'Asia');

INSERT INTO ref_occupations (name, category) VALUES 
('Software Engineer', 'Technology'),
('Product Manager', 'Technology'),
('Marketing Specialist', 'Marketing'),
('Graphic Designer', 'Design'),
('Teacher', 'Education'),
('Doctor', 'Healthcare'),
('Financial Analyst', 'Finance'),
('Writer', 'Media');

INSERT INTO ref_interests (name, category) VALUES 
('Technology', 'Technology'),
('Environment', 'Environment'),
('Social Impact', 'Social'),
('Education', 'Education'),
('Health', 'Health'),
('Finance', 'Finance'),
('Arts & Culture', 'Arts'),
('Sports', 'Sports'),
('Food & Agriculture', 'Food'),
('Travel', 'Travel');

INSERT INTO ref_categories (name, parent_category) VALUES 
('Technology', NULL),
('Finance', NULL),
('Education', NULL),
('Health', NULL),
('Media', NULL),
('Retail', NULL),
('Food', NULL),
('Energy', NULL),
('Transportation', NULL),
('Environment', NULL),
('Social Impact', NULL),
('Entertainment', NULL),
('Workspace', NULL),
('Housing', NULL),
('Art & Culture', NULL),
('Sports & Fitness', NULL),
('Other', NULL);

-- Locations
INSERT INTO ref_locations (id, name, created_at, updated_at)
VALUES
  (1, 'Barcelona, Spain', NOW(), NOW()),
  (2, 'Toronto, Canada', NOW(), NOW()),
  (3, 'Berlin, Germany', NOW(), NOW()),
  (4, 'Seoul, South Korea', NOW(), NOW()),
  (5, 'Mumbai, India', NOW(), NOW()),
  (6, 'São Paulo, Brazil', NOW(), NOW()),
  (7, 'Melbourne, Australia', NOW(), NOW()),
  (8, 'Ho Chi Minh City, Vietnam', NOW(), NOW());

-- Categories
INSERT INTO ref_categories (id, name, created_at, updated_at)
VALUES
  (1, 'Media', NOW(), NOW()),
  (2, 'Food', NOW(), NOW()),
  (3, 'Workspace', NOW(), NOW()),
  (4, 'Finance', NOW(), NOW()),
  (5, 'Climate', NOW(), NOW()),
  (6, 'Education', NOW(), NOW()),
  (7, 'Retail', NOW(), NOW()),
  (8, 'Health', NOW(), NOW()),
  (9, 'Energy', NOW(), NOW());
