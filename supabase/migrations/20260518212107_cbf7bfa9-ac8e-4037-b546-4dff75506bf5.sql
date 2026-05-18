DO $$
DECLARE
  v_uid uuid;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE email = 'hr@test.com';
  IF v_uid IS NULL THEN
    v_uid := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
      'hr@test.com', crypt('00000000', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}', '{"full_name":"موظف الموارد البشرية"}',
      now(), now(), '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), v_uid, jsonb_build_object('sub', v_uid::text, 'email', 'hr@test.com'), 'email', v_uid::text, now(), now(), now());
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'hr')
    ON CONFLICT (user_id, role) DO NOTHING;
END $$;