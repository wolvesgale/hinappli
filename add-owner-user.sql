-- wolvesgale0512@gmail.com をownerとして追加
INSERT INTO user_roles (email, display_name, role) 
VALUES ('wolvesgale0512@gmail.com', 'マエダ', 'owner')
ON CONFLICT (email) DO UPDATE SET 
  display_name = EXCLUDED.display_name,
  role = EXCLUDED.role;
