-- Add content column to document_templates for in-app editing
ALTER TABLE document_templates ADD COLUMN IF NOT EXISTS content text DEFAULT '';
