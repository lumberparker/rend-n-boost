/*
  # Initial Schema for Freelance Creative Management System

  1. New Tables
    - `creatives`
      - `id` (uuid, primary key) - Links to auth.users
      - `name` (text) - Creative's name
      - `email` (text) - Email address
      - `sla_days` (int) - Minimum SLA in business days
      - `max_credits_per_day` (int) - Maximum hours/credits per day
      - `work_days` (jsonb) - Working days configuration
      - `urgency_multiplier` (decimal) - Multiplier for urgent tasks
      - `created_at` (timestamptz)
    
    - `clients`
      - `id` (uuid, primary key)
      - `name` (text) - Client name or company
      - `email` (text) - Contact email
      - `creative_id` (uuid) - Reference to creative
      - `plan_type` (text) - 'project' or 'monthly'
      - `credits_available` (int) - Current credit balance
      - `stripe_customer_id` (text) - Stripe customer reference
      - `created_at` (timestamptz)
    
    - `projects`
      - `id` (uuid, primary key)
      - `name` (text) - Project name
      - `description` (text) - Project description
      - `client_id` (uuid) - Reference to client
      - `active` (boolean) - Project status
      - `credits_assigned` (int) - Total credits for project
      - `credits_consumed` (int) - Credits used
      - `start_date` (date)
      - `end_date` (date)
      - `created_at` (timestamptz)
    
    - `tasks`
      - `id` (uuid, primary key)
      - `project_id` (uuid) - Reference to project
      - `title` (text) - Task title
      - `description` (text) - Task description
      - `status` (text) - Task status
      - `credits_estimated` (int) - Client's estimate
      - `credits_approved` (int) - Creative's approved credits
      - `is_urgent` (boolean) - Urgent flag
      - `requested_date` (date) - Client's requested delivery
      - `committed_date` (date) - Agreed delivery date
      - `delivered_date` (date) - Actual delivery date
      - `deliverable_url` (text) - Link to deliverable file
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `credits_history`
      - `id` (uuid, primary key)
      - `client_id` (uuid) - Reference to client
      - `project_id` (uuid) - Reference to project (optional)
      - `type` (text) - Transaction type
      - `description` (text) - Transaction description
      - `amount` (int) - Credits amount (positive or negative)
      - `reference` (text) - External reference (Stripe ID, etc.)
      - `created_at` (timestamptz)
    
    - `public_links`
      - `token` (uuid, primary key) - Unique public token
      - `project_id` (uuid) - Reference to project
      - `expires_at` (timestamptz) - Optional expiration
      - `created_by` (uuid) - Creative who created link
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated creatives
    - Add policies for public token-based access
*/

-- Create creatives table
CREATE TABLE IF NOT EXISTS creatives (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  sla_days int DEFAULT 4,
  max_credits_per_day int DEFAULT 6,
  work_days jsonb DEFAULT '{"monday": true, "tuesday": true, "wednesday": true, "thursday": true, "friday": true, "saturday": false, "sunday": false}'::jsonb,
  urgency_multiplier decimal DEFAULT 1.5,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE creatives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creatives can view own profile"
  ON creatives FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Creatives can update own profile"
  ON creatives FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Creatives can insert own profile"
  ON creatives FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Create clients table
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  creative_id uuid NOT NULL REFERENCES creatives(id) ON DELETE CASCADE,
  plan_type text DEFAULT 'project' CHECK (plan_type IN ('project', 'monthly')),
  credits_available int DEFAULT 0,
  stripe_customer_id text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creatives can view own clients"
  ON clients FOR SELECT
  TO authenticated
  USING (creative_id = auth.uid());

CREATE POLICY "Creatives can insert own clients"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (creative_id = auth.uid());

CREATE POLICY "Creatives can update own clients"
  ON clients FOR UPDATE
  TO authenticated
  USING (creative_id = auth.uid())
  WITH CHECK (creative_id = auth.uid());

CREATE POLICY "Creatives can delete own clients"
  ON clients FOR DELETE
  TO authenticated
  USING (creative_id = auth.uid());

-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  active boolean DEFAULT true,
  credits_assigned int DEFAULT 0,
  credits_consumed int DEFAULT 0,
  start_date date DEFAULT CURRENT_DATE,
  end_date date,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creatives can view own projects"
  ON projects FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT id FROM clients WHERE creative_id = auth.uid()
    )
  );

CREATE POLICY "Creatives can insert own projects"
  ON projects FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id IN (
      SELECT id FROM clients WHERE creative_id = auth.uid()
    )
  );

CREATE POLICY "Creatives can update own projects"
  ON projects FOR UPDATE
  TO authenticated
  USING (
    client_id IN (
      SELECT id FROM clients WHERE creative_id = auth.uid()
    )
  )
  WITH CHECK (
    client_id IN (
      SELECT id FROM clients WHERE creative_id = auth.uid()
    )
  );

CREATE POLICY "Creatives can delete own projects"
  ON projects FOR DELETE
  TO authenticated
  USING (
    client_id IN (
      SELECT id FROM clients WHERE creative_id = auth.uid()
    )
  );

-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'in_progress', 'completed', 'rejected', 'blocked')),
  credits_estimated int NOT NULL,
  credits_approved int,
  is_urgent boolean DEFAULT false,
  requested_date date,
  committed_date date,
  delivered_date date,
  deliverable_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creatives can view tasks from own projects"
  ON tasks FOR SELECT
  TO authenticated
  USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN clients c ON c.id = p.client_id
      WHERE c.creative_id = auth.uid()
    )
  );

CREATE POLICY "Creatives can insert tasks"
  ON tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN clients c ON c.id = p.client_id
      WHERE c.creative_id = auth.uid()
    )
  );

CREATE POLICY "Creatives can update tasks from own projects"
  ON tasks FOR UPDATE
  TO authenticated
  USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN clients c ON c.id = p.client_id
      WHERE c.creative_id = auth.uid()
    )
  )
  WITH CHECK (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN clients c ON c.id = p.client_id
      WHERE c.creative_id = auth.uid()
    )
  );

CREATE POLICY "Creatives can delete tasks from own projects"
  ON tasks FOR DELETE
  TO authenticated
  USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN clients c ON c.id = p.client_id
      WHERE c.creative_id = auth.uid()
    )
  );

-- Create credits_history table
CREATE TABLE IF NOT EXISTS credits_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('purchase', 'monthly_allocation', 'task_usage', 'refund', 'adjustment')),
  description text NOT NULL,
  amount int NOT NULL,
  reference text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE credits_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creatives can view credits history for own clients"
  ON credits_history FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT id FROM clients WHERE creative_id = auth.uid()
    )
  );

CREATE POLICY "Creatives can insert credits history"
  ON credits_history FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id IN (
      SELECT id FROM clients WHERE creative_id = auth.uid()
    )
  );

-- Create public_links table
CREATE TABLE IF NOT EXISTS public_links (
  token uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  expires_at timestamptz,
  created_by uuid NOT NULL REFERENCES creatives(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creatives can manage own public links"
  ON public_links FOR ALL
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Public access policies for clients using tokens
CREATE POLICY "Public can view projects with valid token"
  ON projects FOR SELECT
  TO anon
  USING (
    id IN (
      SELECT project_id FROM public_links
      WHERE (expires_at IS NULL OR expires_at > now())
    )
  );

CREATE POLICY "Public can view tasks with valid token"
  ON tasks FOR SELECT
  TO anon
  USING (
    project_id IN (
      SELECT project_id FROM public_links
      WHERE (expires_at IS NULL OR expires_at > now())
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_clients_creative_id ON clients(creative_id);
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_committed_date ON tasks(committed_date);
CREATE INDEX IF NOT EXISTS idx_credits_history_client_id ON credits_history(client_id);
CREATE INDEX IF NOT EXISTS idx_public_links_project_id ON public_links(project_id);

-- Create updated_at trigger for tasks
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();