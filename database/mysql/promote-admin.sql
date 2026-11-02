-- First create/sign in to the account in Atlas, then replace this value with
-- that exact email before running this file as a MySQL administrator.
SET @admin_email = 'replace-with-the-registered-admin-email';

INSERT IGNORE INTO roles (role_name) VALUES ('Researcher'), ('Admin');

UPDATE users AS u
JOIN roles AS r ON r.role_name = 'Admin'
SET u.role_id = r.role_id
WHERE u.email = @admin_email;

SELECT u.email, r.role_name
FROM users AS u
JOIN roles AS r ON r.role_id = u.role_id
WHERE u.email = @admin_email;
