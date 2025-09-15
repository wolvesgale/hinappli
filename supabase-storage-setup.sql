-- Create storage bucket for register photos
INSERT INTO storage.buckets (id, name, public) VALUES ('register-photos', 'register-photos', true);

-- Set up storage policies
CREATE POLICY "Allow authenticated users to upload register photos" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'register-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Allow public access to register photos" ON storage.objects
FOR SELECT USING (bucket_id = 'register-photos');
