INSERT INTO users (firebase_uid, email, name)
VALUES
('seed_uid_kalyan', 'kalyan@example.com', 'Kalyan'),
('seed_uid_ravi', 'ravi@example.com', 'Ravi'),
('seed_uid_sai', 'sai@example.com', 'Sai'),
('seed_uid_ajay', 'ajay@example.com', 'Ajay'),
('seed_uid_neha', 'neha@example.com', 'Neha')
ON CONFLICT (firebase_uid) DO NOTHING;
