CREATE TABLE IF NOT EXISTS epic
(
    id          uuid DEFAULT gen_random_uuid() NOT NULL
        CONSTRAINT epic_pk
            PRIMARY KEY,
    name        text,
    created_at  timestamp with time zone,
    modified_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS team_member
(
    id           uuid                     DEFAULT gen_random_uuid() NOT NULL
        CONSTRAINT team_member_pk
            PRIMARY KEY,
    name         text,
    created_at   timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at   timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    last_epic_id uuid
        CONSTRAINT team_member_epic_id_fk
            REFERENCES epic
);

CREATE TABLE IF NOT EXISTS work_item
(
    id             uuid                     DEFAULT gen_random_uuid() NOT NULL
        CONSTRAINT work_item_pk
            PRIMARY KEY,
    description    text,
    team_member_id uuid
        CONSTRAINT work_item_team_member_id_fk
            REFERENCES team_member,
    epic_id        uuid
        CONSTRAINT work_item_epic_id_fk
            REFERENCES epic,
    percent_of_day integer,
    created_at     timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at     timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);
