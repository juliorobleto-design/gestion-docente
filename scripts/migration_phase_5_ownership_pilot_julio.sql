-- ==========================================
-- PHASE 5: OWNERSHIP MIGRATION (PILOT JULIO)
-- ==========================================
-- Targeted migration for user "Julio" (ID 1)
-- to associate all his records with his Supabase Auth UUID.

DO $$
DECLARE
    target_old_id INT := 1; -- Julio
    target_uuid UUID;
BEGIN
    -- 1. Get the UUID from the migration map
    SELECT new_auth_user_id INTO target_uuid 
    FROM user_migration_map 
    WHERE old_user_id = target_old_id;

    IF target_uuid IS NULL THEN
        RAISE EXCEPTION 'UUID not found for user ID %. Ensure Identity Validation is complete.', target_old_id;
    END IF;

    RAISE NOTICE 'Starting ownership migration for Julio (ID 1) -> UUID %', target_uuid;

    -- 2. Update Groups
    UPDATE groups SET owner_id = target_uuid WHERE user_id = target_old_id;
    
    -- 3. Update Students (via relationship check to be safe, or direct if applicable)
    -- Since students table now has owner_id, we can propagate it
    UPDATE students s
    SET owner_id = target_uuid
    FROM groups g
    WHERE s.group_id = g.id AND g.owner_id = target_uuid;

    -- 4. Update Attendance
    UPDATE attendance_lessons al
    SET owner_id = target_uuid
    FROM students s
    WHERE al.student_id = s.id AND s.owner_id = target_uuid;

    -- 5. Update Anecdotal Records
    UPDATE anecdotal_records ar
    SET owner_id = target_uuid
    FROM students s
    WHERE ar.student_id = s.id AND s.owner_id = target_uuid;

    -- 6. Update Schedules
    UPDATE schedules sch
    SET owner_id = target_uuid
    FROM groups g
    WHERE sch.group_id = g.id AND g.owner_id = target_uuid;

    -- 7. Update Grades and Daily Work (if they have data)
    UPDATE grades gr
    SET owner_id = target_uuid
    FROM students s
    WHERE gr.student_id = s.id AND s.owner_id = target_uuid;

    UPDATE daily_work_scores dw
    SET owner_id = target_uuid
    FROM students s
    WHERE dw.student_id = s.id AND s.owner_id = target_uuid;

    RAISE NOTICE 'Ownership migration for Julio COMPLETED successfully.';

END $$;
