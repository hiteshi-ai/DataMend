-- =============================================================================
-- DataMend Seed Data
-- =============================================================================
-- Run this AFTER schema.sql has been applied successfully.
-- This file inserts default application settings and provides instructions
-- for bootstrapping the first admin user.
-- =============================================================================

-- =============================================================================
-- APP_SETTINGS – Default global configuration
-- =============================================================================

INSERT INTO public.app_settings (id, key, value, updated_by, updated_at)
VALUES
    -- Maximum file size users are allowed to upload (in megabytes)
    (
        gen_random_uuid(),
        'max_file_size_mb',
        '50'::jsonb,
        NULL,
        NOW()
    ),

    -- Allowed upload file formats (must match the datasets.file_format CHECK constraint)
    (
        gen_random_uuid(),
        'allowed_formats',
        '["csv", "xlsx", "xls", "json"]'::jsonb,
        NULL,
        NOW()
    ),

    -- Maximum number of rows permitted in a single uploaded dataset
    (
        gen_random_uuid(),
        'max_rows',
        '500000'::jsonb,
        NULL,
        NOW()
    ),

    -- Whether new user registrations are open to the public
    (
        gen_random_uuid(),
        'allow_public_signup',
        'true'::jsonb,
        NULL,
        NOW()
    ),

    -- Default theme applied to new user profiles
    (
        gen_random_uuid(),
        'default_theme',
        '"lavender"'::jsonb,
        NULL,
        NOW()
    ),

    -- How long (in days) to retain completed analysis runs before auto-deletion (0 = never)
    (
        gen_random_uuid(),
        'analysis_retention_days',
        '90'::jsonb,
        NULL,
        NOW()
    ),

    -- Maximum number of saved recipes per user (0 = unlimited)
    (
        gen_random_uuid(),
        'max_saved_recipes_per_user',
        '50'::jsonb,
        NULL,
        NOW()
    ),

    -- Contact / support email displayed in the UI
    (
        gen_random_uuid(),
        'support_email',
        '"support@datamend.app"'::jsonb,
        NULL,
        NOW()
    )

ON CONFLICT (key) DO NOTHING;  -- Safe to re-run; skips existing keys

-- =============================================================================
-- ANNOUNCEMENTS – Welcome message shown on first launch
-- =============================================================================

-- NOTE: created_by requires a valid profile UUID.
-- Uncomment and replace <ADMIN_UUID> with the actual admin user's UUID
-- after creating the admin account (see instructions below).

/*
INSERT INTO public.announcements (id, title, body, is_active, created_by, created_at)
VALUES (
    gen_random_uuid(),
    'Welcome to DataMend! 🎉',
    'DataMend is now live. Upload your first dataset and let AI clean it for you in seconds.',
    true,
    '<ADMIN_UUID>',  -- Replace with your admin profile UUID
    NOW()
);
*/

-- =============================================================================
-- HOW TO CREATE THE FIRST ADMIN USER
-- =============================================================================
--
-- DataMend uses Supabase Authentication. Follow ONE of the methods below.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- METHOD A: Supabase Dashboard (recommended for local dev / staging)
-- ─────────────────────────────────────────────────────────────────────────────
--
--  1. Open your Supabase project → Authentication → Users.
--  2. Click "Add user" → enter the admin email + password → Create.
--  3. The `on_auth_user_created` trigger will automatically create a matching
--     row in public.profiles with role = 'user'.
--  4. In the Supabase Table Editor (or SQL Editor), open public.profiles,
--     find the row with the admin's email, and change role to 'admin':
--
--       UPDATE public.profiles
--       SET role = 'admin'
--       WHERE id = '<UUID_FROM_AUTH_USERS>';
--
--  5. Copy that UUID and paste it into the announcements INSERT above if needed.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- METHOD B: Supabase CLI (for CI/CD or scripted bootstrap)
-- ─────────────────────────────────────────────────────────────────────────────
--
--  Prerequisites: supabase CLI installed and project linked.
--
--  # 1. Create the auth user (returns the new UUID)
--  supabase auth users create \
--      --email admin@example.com \
--      --password "ChangeMe123!" \
--      --email-confirm
--
--  # 2. Promote to admin via psql / SQL Editor
--  #    (replace <UUID> with the value returned in step 1)
--  UPDATE public.profiles SET role = 'admin' WHERE id = '<UUID>';
--
-- ─────────────────────────────────────────────────────────────────────────────
-- METHOD C: Direct SQL (self-hosted Supabase / Postgres)
-- ─────────────────────────────────────────────────────────────────────────────
--
--  Only do this on a self-hosted instance where you control the database directly.
--
--  -- Step 1: Insert into auth.users (Supabase handles password hashing)
--  INSERT INTO auth.users (
--      id, email, encrypted_password, email_confirmed_at,
--      created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
--      aud, role
--  )
--  VALUES (
--      gen_random_uuid(),
--      'admin@example.com',
--      crypt('ChangeMe123!', gen_salt('bf')),   -- requires pgcrypto
--      NOW(), NOW(), NOW(),
--      '{"provider":"email","providers":["email"]}'::jsonb,
--      '{"full_name":"DataMend Admin"}'::jsonb,
--      'authenticated',
--      'authenticated'
--  )
--  RETURNING id;   -- note the UUID
--
--  -- Step 2: The trigger auto-creates the profile; elevate to admin:
--  UPDATE public.profiles SET role = 'admin' WHERE id = '<UUID_FROM_STEP_1>';
--
-- ─────────────────────────────────────────────────────────────────────────────
-- IMPORTANT SECURITY NOTES
-- ─────────────────────────────────────────────────────────────────────────────
--
--  • Change default passwords immediately after creating accounts.
--  • Never commit real credentials to source control.
--  • The `is_admin()` helper function used in RLS policies queries public.profiles
--    at query time, so role changes take effect immediately without needing to
--    re-login (though the client JWT won't reflect the change until next sign-in).
--  • To revoke admin access: UPDATE public.profiles SET role = 'user' WHERE id = '<UUID>';
--
-- =============================================================================
-- END OF SEED FILE
-- =============================================================================
