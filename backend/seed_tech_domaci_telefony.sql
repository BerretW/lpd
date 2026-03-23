-- =============================================================================
-- SEED: Technologie – Domácí telefony / videotelefony
-- Vzor: Tesla Garant (4+n analogový) a Tesla 2BUS (digitální)
-- Elementy: tabla · bytová stanice · monitor · napájecí zdroj · expandér · vrátník
-- =============================================================================
-- POUŽITÍ: Spusťte v psql nebo pgAdmin.
-- Nastavte správné company_id v proměnné v_company_id níže.
-- =============================================================================

DO $$
DECLARE
    v_company_id INT := 1; -- ← ZMĚŇTE na ID vaší společnosti
    v_dtel_id    INT;
BEGIN

-- ============================================================
-- Domácí tel. – Domácí telefony / videotelefony
--
-- Systémy v terénu:
--   • 4+n (analogový) – Tesla Garant, Amos, Fermax…
--     Tabla napájená ze zdroje, 4 vodiče ke každé bytové stanici
--     + n extra vodičů pro video / kódy / vrátník
--   • 2BUS (digitální) – Tesla 2BUS, Comelit 2wire, Urmet 2Voice…
--     Pouze 2 vodiče po celé instalaci, sběrnicová topologie,
--     každý prvek má adresu, video přes stejný kabel
--   • IP/SIP – 2N Helios, Grandstream, Akuvox…
--     Prvky jako IP zařízení v síti, PoE napájení
-- ============================================================
INSERT INTO plugin_obj_tech_types (company_id, name, color)
VALUES (v_company_id, 'Domácí tel.', 'bg-indigo-600')
RETURNING id INTO v_dtel_id;

INSERT INTO plugin_obj_tech_fields
    (tech_type_id, name, type, show_in_overview, is_main, options, inventory_param, sort_order)
VALUES
    -- Identifikace prvku
    (v_dtel_id, 'Typ prvku',
        'select', true, false,
        '["Tabla (venkovní stanice)", "Tabla – hlavní vstup", "Tabla – vedlejší vstup / garážové stání", "Bytová stanice (sluchátko)", "Videomonitor (vnitřní)", "Hands-free panel (vnitřní)", "Napájecí zdroj / trafo", "Rozbočovač / distributor 2BUS", "Expandér / rozšiřovač (4+n)", "Řídící modul / ústředna", "Kódová klávesnice", "Přístupová čtečka RFID", "Elektrický vrátník / zámek", "Elektromagnetický zámek", "Videomodul (kamera)", "Čidlo otevření dveří"]',
        NULL, 1),

    (v_dtel_id, 'Označení / č. bytu',  'text',   true,  true,  NULL, NULL, 2),
    (v_dtel_id, 'Výrobce',             'text',   false, false,
        NULL,  -- Tesla, Comelit, Urmet, 2N, Fermax, ABB, Siedle, Golmar, Hikvision
        NULL, 3),
    (v_dtel_id, 'Model',               'text',   true,  false, NULL, NULL, 4),
    (v_dtel_id, 'Sériové číslo',       'text',   false, false, NULL, NULL, 5),

    -- Typ systému a zapojení
    (v_dtel_id, 'Typ systému',
        'select', true, false,
        '["4+n (analogový)", "2BUS (digitální)", "IP / SIP", "Hybridní 2BUS + IP"]',
        NULL, 6),

    (v_dtel_id, 'Typ připojení / kabel',
        'select', false, false,
        '["4+n – UTP/CYY 4×0,5", "4+n – UTP/CYY 6×0,5", "4+n – koaxiál (video)", "2BUS – 2 vodiče (CYKY/SYKFY)", "IP – UTP Cat 5e / Cat 6 (PoE)", "IP – WiFi", "N/A"]',
        NULL, 7),

    -- Specifické pro tablu
    (v_dtel_id, 'Počet tlačítek (bytů)',       'number', false, false, NULL, NULL, 8),
    (v_dtel_id, 'Kamera v table',
        'select', false, false,
        '["Ano – barevná", "Ano – černobílá", "Ne"]',
        NULL, 9),
    (v_dtel_id, 'Noční vidění / IR přísvit',
        'select', false, false,
        '["Ano", "Ne", "N/A"]',
        NULL, 10),
    (v_dtel_id, 'Rozlišení kamery',
        'select', false, false,
        '["VGA (640×480)", "HD 720p", "FHD 1080p", "N/A"]',
        NULL, 11),
    (v_dtel_id, 'Kódová klávesnice v table',
        'select', false, false,
        '["Ano – PIN", "Ano – PIN + RFID", "Ne"]',
        NULL, 12),
    (v_dtel_id, 'RFID technologie',
        'select', false, false,
        '["125 kHz EM", "MIFARE 13,56 MHz", "N/A"]',
        NULL, 13),

    -- Specifické pro 2BUS a IP
    (v_dtel_id, 'Adresa na sběrnici (2BUS)',   'text',   false, false, NULL, NULL, 14),
    (v_dtel_id, 'IP adresa',                   'text',   false, false, NULL, NULL, 15),
    (v_dtel_id, 'SIP účet / linka',            'text',   false, false, NULL, NULL, 16),
    (v_dtel_id, 'PoE napájení',
        'select', false, false,
        '["Ano – PoE 802.3af", "Ano – PoE+ 802.3at", "Ne – vlastní zdroj", "N/A"]',
        NULL, 17),

    -- Vrátník a zámek
    (v_dtel_id, 'Elektrický vrátník / zámek',
        'select', false, false,
        '["Integrován – elektrická střelka", "Integrován – elektromagnet", "Externí – ovládán výstupem", "Není"]',
        NULL, 18),
    (v_dtel_id, 'Napětí vrátníku (V)',
        'select', false, false,
        '["12 V DC", "12 V AC", "24 V DC", "24 V AC", "N/A"]',
        NULL, 19),

    (v_dtel_id, 'Typ zámku',
        'select', true, false,
        '["Elektrická střelka (fail-secure)", "Elektrická střelka (fail-safe)", "Elektromagnetický zámek (fail-safe)", "Motorický zámek", "Samozamykací elektrozámek", "Turniket / závora", "Bez zámku", "N/A"]',
        NULL, 20),

    (v_dtel_id, 'Typ kabelu',
        'select', false, false,
        '["SYKFY 4×0,5 (standard 4+n)", "SYKFY 6×0,5 (4+n s videem)", "SYKFY 8×0,5 (4+n rozšířený)", "CYKY 2×1,5 (2BUS napájení)", "CYKY 2×0,75 (2BUS signál)", "UTP Cat 5e (IP / PoE)", "UTP Cat 6 (IP / PoE)", "Koaxiál RG-59 (analog video)", "Koaxiál RG-6 (analog video)", "N/A"]',
        NULL, 21),

    -- Umístění
    (v_dtel_id, 'Podlaží',             'text',   true,  false, NULL, NULL, 22),
    (v_dtel_id, 'Umístění v objektu',  'text',   true,  false, NULL, NULL, 23),

    -- Servis a revize
    (v_dtel_id, 'Datum instalace',       'date',  true,  false, NULL, NULL, 24),
    (v_dtel_id, 'Datum poslední revize', 'date',  false, false, NULL, NULL, 25),
    (v_dtel_id, 'Datum příští revize',   'date',  false, false, NULL, NULL, 26),
    (v_dtel_id, 'Odpovědná osoba',       'text',  false, false, NULL, NULL, 27),

    (v_dtel_id, 'Stav',
        'select', true, false,
        '["OK", "Nefunkční kamera", "Nefunkční zvuk", "Nefunkční vrátník", "Mimo provoz", "Servis"]',
        NULL, 28),

    (v_dtel_id, 'Poznámka',             'text',  false, false, NULL, NULL, 29);


-- Příslušenství (počty pro celou instalaci)
INSERT INTO plugin_obj_accessory_types (tech_type_id, name, unit)
VALUES
    (v_dtel_id, 'Tably (venkovní stanice)',    'ks'),
    (v_dtel_id, 'Bytové stanice (sluchátka)',  'ks'),
    (v_dtel_id, 'Videomonitory vnitřní',       'ks'),
    (v_dtel_id, 'Napájecí zdroje / trafika',   'ks'),
    (v_dtel_id, 'Rozbočovače 2BUS',           'ks'),
    (v_dtel_id, 'Expandéry (4+n)',             'ks'),
    (v_dtel_id, 'Elektrické vrátníky / zámky', 'ks'),
    (v_dtel_id, 'RFID čipy / karty',          'ks');


RAISE NOTICE 'Import dokončen – Domácí tel. (id = %)', v_dtel_id;

END $$;
