-- Create downloads bucket for app installers
INSERT INTO storage.buckets (id, name, public) VALUES ('downloads', 'downloads', true);

-- Allow anyone to read/download files from the downloads bucket
CREATE POLICY "Downloads are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'downloads');

-- Allow authenticated users to upload to downloads bucket
CREATE POLICY "Authenticated users can upload downloads"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'downloads');
