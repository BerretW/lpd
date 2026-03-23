-- =============================================================================
-- SEED: Předvytvořené technologie pro Objects Management Plugin
-- Technologie: CCTV, PZTS, EKV, MZS, DT, SK, PV, LAN/WiFi, ID
-- =============================================================================
-- FILOZOFIE:
--   Každý ObjTechField definuje atribut JEDNOHO fyzického prvku (ObjTechElement).
--   Technologie CCTV → elementy: 1× NVR + N× kamera
--   Technologie PZTS → elementy: 1× ústředna + N× čidlo/klávesnice/siréna
--   atd. — technik přidává každé zařízení zvlášť.
--
--   is_main   = true  → pole slouží jako zobrazovaný název záznamu prvku
--   show_in_overview  → pole se zobrazí v přehledové tabulce prvků
-- =============================================================================
-- POUŽITÍ: Spusťte v psql nebo pgAdmin.
-- Nastavte správné company_id v proměnné v_company_id níže.
-- =============================================================================

DO $$
DECLARE
    v_company_id INT := 1; -- ← ZMĚŇTE na ID vaší společnosti

    v_cctv_id    INT;
    v_pzts_id    INT;
    v_ekv_id     INT;
    v_mzs_id     INT;
    v_dt_id      INT;
    v_sk_id      INT;
    v_pv_id      INT;
    v_lw_id      INT;
    v_id_id      INT;
BEGIN

-- ============================================================
-- 1. CCTV – Kamerový systém
--    Elementy: NVR/DVR · Kamera Fixed · Kamera PTZ · Monitor
-- ============================================================
INSERT INTO plugin_obj_tech_types (company_id, name, color)
VALUES (v_company_id, 'CCTV', 'bg-blue-600')
RETURNING id INTO v_cctv_id;

INSERT INTO plugin_obj_tech_fields
    (tech_type_id, name, type, show_in_overview, is_main, options, inventory_param, sort_order)
VALUES
    (v_cctv_id, 'Typ prvku',              'select', true,  false, '["NVR / DVR", "Kamera – Fixed", "Kamera – Dome", "Kamera – PTZ", "Kamera – Fisheye", "Monitor / zobrazovač", "PoE switch", "Pevný disk"]', NULL, 1),
    (v_cctv_id, 'Označení',              'text',   true,  true,  NULL,                                                                                 NULL, 2),
    (v_cctv_id, 'Výrobce',               'text',   false, false, NULL,                                                                                 NULL, 3),
    (v_cctv_id, 'Model',                 'text',   true,  false, NULL,                                                                                 NULL, 4),
    (v_cctv_id, 'Sériové číslo',         'text',   false, false, NULL,                                                                                 NULL, 5),
    (v_cctv_id, 'IP adresa',             'text',   false, false, NULL,                                                                                 NULL, 6),
    (v_cctv_id, 'Kanál / port NVR',      'number', false, false, NULL,                                                                                 NULL, 7),
    (v_cctv_id, 'Rozlišení',             'select', false, false, '["2 MP (FHD)", "4 MP", "8 MP (4K)", "12 MP", "Není aplikovatelné"]',                NULL, 8),
    (v_cctv_id, 'Noční vidění',          'select', false, false, '["IR", "Full-color", "Dual-light", "Ne"]',                                           NULL, 9),
    (v_cctv_id, 'Typ připojení',         'select', false, false, '["IP / PoE", "IP / napájení 12V", "Analog", "HD-CVI", "HD-TVI", "AHD"]',            NULL, 10),
    (v_cctv_id, 'Umístění v objektu',    'text',   true,  false, NULL,                                                                                 NULL, 11),
    (v_cctv_id, 'Zorné pole / pokrytí',  'text',   false, false, NULL,                                                                                 NULL, 12),
    (v_cctv_id, 'Kapacita (TB / dny)',   'text',   false, false, NULL,                                                                                 NULL, 13),
    (v_cctv_id, 'Datum instalace',       'date',   true,  false, NULL,                                                                                 NULL, 14),
    (v_cctv_id, 'Datum poslední revize', 'date',   false, false, NULL,                                                                                 NULL, 15),
    (v_cctv_id, 'Datum příští revize',   'date',   false, false, NULL,                                                                                 NULL, 16),
    (v_cctv_id, 'Odpovědná osoba',       'text',   false, false, NULL,                                                                                 NULL, 17),
    (v_cctv_id, 'Stav',                  'select', true,  false, '["OK", "Částečná porucha", "Mimo provoz", "Servis"]',                               NULL, 18),
    (v_cctv_id, 'Poznámka',              'text',   false, false, NULL,                                                                                 NULL, 19);

INSERT INTO plugin_obj_accessory_types (tech_type_id, name, unit)
VALUES
    (v_cctv_id, 'Kamery celkem',     'ks'),
    (v_cctv_id, 'NVR/DVR',          'ks'),
    (v_cctv_id, 'Monitory',         'ks'),
    (v_cctv_id, 'PoE přepínače',    'ks'),
    (v_cctv_id, 'HDD celkem (TB)',  'TB');


-- ============================================================
-- 2. PZTS – Poplachový zabezpečovací a tísňový systém
--    Elementy: Ústředna · PIR · Mag. kontakt · Klávesnice · Siréna · GSM
-- ============================================================
INSERT INTO plugin_obj_tech_types (company_id, name, color)
VALUES (v_company_id, 'PZTS', 'bg-red-600')
RETURNING id INTO v_pzts_id;

INSERT INTO plugin_obj_tech_fields
    (tech_type_id, name, type, show_in_overview, is_main, options, inventory_param, sort_order)
VALUES
    (v_pzts_id, 'Typ prvku',              'select', true,  false, '["Ústředna", "Detektor PIR", "Detektor PIR imunní", "Magnetický kontakt", "Detektor rozbití skla", "Otřesový detektor", "Detektor pohybu mikrovolný", "Klávesnice", "Čtečka karet / tag", "Siréna vnitřní", "Siréna venkovní", "GSM / IP komunikátor", "Záložní zdroj (UPS/akumulátor)", "Tísňové tlačítko"]', NULL, 1),
    (v_pzts_id, 'Označení / název',       'text',   true,  true,  NULL,                                                                                NULL, 2),
    (v_pzts_id, 'Výrobce',               'text',   false, false, NULL,                                                                                 NULL, 3),
    (v_pzts_id, 'Model',                 'text',   true,  false, NULL,                                                                                 NULL, 4),
    (v_pzts_id, 'Sériové číslo',         'text',   false, false, NULL,                                                                                 NULL, 5),
    (v_pzts_id, 'Zóna č.',              'text',   true,  false, NULL,                                                                                  NULL, 6),
    (v_pzts_id, 'Umístění v objektu',    'text',   true,  false, NULL,                                                                                 NULL, 7),
    (v_pzts_id, 'Typ připojení',         'select', false, false, '["Drátový", "Bezdrátový", "Hybridní (drát+rádiový)"]',                               NULL, 8),
    (v_pzts_id, 'Stupeň zabezpečení',    'select', false, false, '["Stupeň 1", "Stupeň 2", "Stupeň 3", "Stupeň 4", "N/A"]',                          NULL, 9),
    (v_pzts_id, 'Připojení na PCO',      'select', false, false, '["Ano", "Ne", "N/A"]',                                                              NULL, 10),
    (v_pzts_id, 'Název PCO',             'text',   false, false, NULL,                                                                                 NULL, 11),
    (v_pzts_id, 'Záloha napájení (hod)', 'number', false, false, NULL,                                                                                 NULL, 12),
    (v_pzts_id, 'Datum instalace',       'date',   true,  false, NULL,                                                                                 NULL, 13),
    (v_pzts_id, 'Datum výměny baterie',  'date',   false, false, NULL,                                                                                 NULL, 14),
    (v_pzts_id, 'Datum poslední revize', 'date',   false, false, NULL,                                                                                 NULL, 15),
    (v_pzts_id, 'Datum příští revize',   'date',   false, false, NULL,                                                                                 NULL, 16),
    (v_pzts_id, 'Odpovědná osoba',       'text',   false, false, NULL,                                                                                 NULL, 17),
    (v_pzts_id, 'Číslo certifikátu',     'text',   false, false, NULL,                                                                                 NULL, 18),
    (v_pzts_id, 'Stav',                  'select', true,  false, '["OK", "Částečná porucha", "Mimo provoz", "Servis"]',                               NULL, 19),
    (v_pzts_id, 'Poznámka',              'text',   false, false, NULL,                                                                                 NULL, 20);

INSERT INTO plugin_obj_accessory_types (tech_type_id, name, unit)
VALUES
    (v_pzts_id, 'Detektory PIR',         'ks'),
    (v_pzts_id, 'Magnetické kontakty',   'ks'),
    (v_pzts_id, 'Klávesnice',           'ks'),
    (v_pzts_id, 'Sirény vnitřní',       'ks'),
    (v_pzts_id, 'Sirény venkovní',      'ks'),
    (v_pzts_id, 'GSM / IP komunikátory','ks');


-- ============================================================
-- 3. EKV – Elektronická kontrola vstupu
--    Elementy: Řídící jednotka · Čtečka · Zámek · Turniket · REX
-- ============================================================
INSERT INTO plugin_obj_tech_types (company_id, name, color)
VALUES (v_company_id, 'EKV', 'bg-green-600')
RETURNING id INTO v_ekv_id;

INSERT INTO plugin_obj_tech_fields
    (tech_type_id, name, type, show_in_overview, is_main, options, inventory_param, sort_order)
VALUES
    (v_ekv_id, 'Typ prvku',              'select', true,  false, '["Řídící jednotka / kontrolér", "Čtečka karet – vstup", "Čtečka karet – výstup", "Klávesnice PIN", "Biometrická čtečka (otisk)", "Biometrická čtečka (žíla prstu)", "Elektromagnetický zámek", "Elektrická střelka", "Motorický zámek", "Turniket", "Tlačítko odchodu (REX)", "Záložní zdroj"]', NULL, 1),
    (v_ekv_id, 'Označení / dveře',       'text',   true,  true,  NULL,                                                                                NULL, 2),
    (v_ekv_id, 'Výrobce',               'text',   false, false, NULL,                                                                                  NULL, 3),
    (v_ekv_id, 'Model',                 'text',   true,  false, NULL,                                                                                  NULL, 4),
    (v_ekv_id, 'Sériové číslo',         'text',   false, false, NULL,                                                                                  NULL, 5),
    (v_ekv_id, 'Technologie karet/čipů','select', false, false, '["125 kHz EM", "MIFARE 13,56 MHz", "HID iCLASS", "DESFire EV3", "PIN", "Biometrie", "Smíšená", "N/A"]', NULL, 6),
    (v_ekv_id, 'Umístění v objektu',    'text',   true,  false, NULL,                                                                                  NULL, 7),
    (v_ekv_id, 'Strana',               'select', false, false, '["Vstup", "Výstup", "Vstup i výstup", "N/A"]',                                        NULL, 8),
    (v_ekv_id, 'Antipassback',          'select', false, false, '["Aktivní", "Neaktivní", "N/A"]',                                                     NULL, 9),
    (v_ekv_id, 'IP adresa',             'text',   false, false, NULL,                                                                                  NULL, 10),
    (v_ekv_id, 'Datum instalace',       'date',   true,  false, NULL,                                                                                  NULL, 11),
    (v_ekv_id, 'Datum poslední revize', 'date',   false, false, NULL,                                                                                  NULL, 12),
    (v_ekv_id, 'Datum příští revize',   'date',   false, false, NULL,                                                                                  NULL, 13),
    (v_ekv_id, 'Odpovědná osoba',       'text',   false, false, NULL,                                                                                  NULL, 14),
    (v_ekv_id, 'Stav',                  'select', true,  false, '["OK", "Částečná porucha", "Mimo provoz", "Servis"]',                                NULL, 15),
    (v_ekv_id, 'Poznámka',              'text',   false, false, NULL,                                                                                  NULL, 16);

INSERT INTO plugin_obj_accessory_types (tech_type_id, name, unit)
VALUES
    (v_ekv_id, 'Čtečky karet',            'ks'),
    (v_ekv_id, 'Elektromagnetické zámky', 'ks'),
    (v_ekv_id, 'Elektrické střelky',      'ks'),
    (v_ekv_id, 'Turnikety',              'ks'),
    (v_ekv_id, 'Přidělené karty/čipy',   'ks'),
    (v_ekv_id, 'Dálkové ovladače',        'ks');


-- ============================================================
-- 4. MZS – Mechanický zabezpečovací systém (bankomatové přístupy)
--    Elementy: Řídící jednotka · ATM/box · Čtečka · Zámek · Biometrie · UPS
-- ============================================================
INSERT INTO plugin_obj_tech_types (company_id, name, color)
VALUES (v_company_id, 'MZS', 'bg-amber-600')
RETURNING id INTO v_mzs_id;

INSERT INTO plugin_obj_tech_fields
    (tech_type_id, name, type, show_in_overview, is_main, options, inventory_param, sort_order)
VALUES
    (v_mzs_id, 'Typ prvku',               'select', true,  false, '["Řídící jednotka", "ATM / bankomat", "Přístupový box / kazeta", "Čtečka karet", "Biometrická čtečka (otisk)", "Biometrická čtečka (žíla prstu)", "Klávesnice PIN", "Elektromagnetický zámek", "Motorický zámek", "Elektronický trezorový zámek", "UPS / záloha napájení", "GSM / IP komunikátor"]', NULL, 1),
    (v_mzs_id, 'Označení / č. boxu',      'text',   true,  true,  NULL,                                                                                NULL, 2),
    (v_mzs_id, 'Výrobce',                'text',   false, false, NULL,                                                                                  NULL, 3),
    (v_mzs_id, 'Model',                  'text',   true,  false, NULL,                                                                                  NULL, 4),
    (v_mzs_id, 'Sériové číslo',          'text',   false, false, NULL,                                                                                  NULL, 5),
    (v_mzs_id, 'Umístění v objektu',     'text',   true,  false, NULL,                                                                                  NULL, 6),
    (v_mzs_id, 'Technologie čtečky',     'select', false, false, '["125 kHz EM", "MIFARE 13,56 MHz", "HID iCLASS", "DESFire EV3", "Biometrie", "Smíšená", "N/A"]', NULL, 7),
    (v_mzs_id, 'Typ zámku',             'select', false, false, '["Elektromagnetický", "Elektrická střelka", "Motorický", "Elektronický trezorový", "N/A"]', NULL, 8),
    (v_mzs_id, 'Dvoufaktorová autent.',  'select', true,  false, '["Aktivní", "Neaktivní", "N/A"]',                                                    NULL, 9),
    (v_mzs_id, 'Antipassback',           'select', false, false, '["Aktivní", "Neaktivní", "N/A"]',                                                    NULL, 10),
    (v_mzs_id, 'Audit log',             'select', false, false, '["Lokální", "Centrální server", "Cloud", "Ne"]',                                       NULL, 11),
    (v_mzs_id, 'Propojení s bankovním systémem', 'select', false, false, '["Ano", "Ne", "N/A"]',                                                       NULL, 12),
    (v_mzs_id, 'Propojení s PZTS',      'select', false, false, '["Ano", "Ne"]',                                                                       NULL, 13),
    (v_mzs_id, 'Propojení s CCTV',      'select', false, false, '["Ano", "Ne"]',                                                                       NULL, 14),
    (v_mzs_id, 'IP adresa',             'text',   false, false, NULL,                                                                                   NULL, 15),
    (v_mzs_id, 'Datum instalace',        'date',   true,  false, NULL,                                                                                  NULL, 16),
    (v_mzs_id, 'Datum poslední revize',  'date',   false, false, NULL,                                                                                  NULL, 17),
    (v_mzs_id, 'Datum příští revize',    'date',   false, false, NULL,                                                                                  NULL, 18),
    (v_mzs_id, 'Odpovědná osoba',        'text',   false, false, NULL,                                                                                  NULL, 19),
    (v_mzs_id, 'Správce databáze karet', 'text',   false, false, NULL,                                                                                  NULL, 20),
    (v_mzs_id, 'Certifikační číslo',     'text',   false, false, NULL,                                                                                  NULL, 21),
    (v_mzs_id, 'Stav',                   'select', true,  false, '["OK", "Částečná porucha", "Mimo provoz", "Servis"]',                                NULL, 22),
    (v_mzs_id, 'Poznámka',               'text',   false, false, NULL,                                                                                  NULL, 23);

INSERT INTO plugin_obj_accessory_types (tech_type_id, name, unit)
VALUES
    (v_mzs_id, 'Čtečky karet/čipů',      'ks'),
    (v_mzs_id, 'Biometrické čtečky',      'ks'),
    (v_mzs_id, 'Motorické / el. zámky',   'ks'),
    (v_mzs_id, 'Řídící jednotky',         'ks'),
    (v_mzs_id, 'UPS / záloha napájení',   'ks'),
    (v_mzs_id, 'Přidělené karty/čipy',    'ks');


-- ============================================================
-- 5. DT – Dohledové a detekční technologie
--    Elementy: Ústředna · Kouřový detektor · Teplotní · CO · Záplava · Siréna
-- ============================================================
INSERT INTO plugin_obj_tech_types (company_id, name, color)
VALUES (v_company_id, 'DT', 'bg-purple-600')
RETURNING id INTO v_dt_id;

INSERT INTO plugin_obj_tech_fields
    (tech_type_id, name, type, show_in_overview, is_main, options, inventory_param, sort_order)
VALUES
    (v_dt_id, 'Typ prvku',              'select', true,  false, '["Ústředna EPS", "Detektor kouře – optický", "Detektor kouře – ionizační", "Detektor tepla", "Detektor kouře+tepla (kombinovaný)", "Lineární detektor (paprsek)", "Aspirační systém (VESDA)", "Tlačítkový hlásič", "Detektor CO", "Detektor plynu LPG/CH4", "Čidlo záplavy / úniku vody", "Teplotní čidlo", "Akustická siréna", "Vizuální hlásič (maják)", "Záložní zdroj"]', NULL, 1),
    (v_dt_id, 'Označení / název',       'text',   true,  true,  NULL,                                                                                NULL, 2),
    (v_dt_id, 'Výrobce',               'text',   false, false, NULL,                                                                                  NULL, 3),
    (v_dt_id, 'Model',                 'text',   true,  false, NULL,                                                                                  NULL, 4),
    (v_dt_id, 'Sériové číslo',         'text',   false, false, NULL,                                                                                  NULL, 5),
    (v_dt_id, 'Zóna / okruh č.',       'text',   true,  false, NULL,                                                                                  NULL, 6),
    (v_dt_id, 'Smyčka č.',             'text',   false, false, NULL,                                                                                  NULL, 7),
    (v_dt_id, 'Adresa na sběrnici',    'text',   false, false, NULL,                                                                                  NULL, 8),
    (v_dt_id, 'Umístění v objektu',    'text',   true,  false, NULL,                                                                                  NULL, 9),
    (v_dt_id, 'Typ připojení',         'select', false, false, '["Drátový (2-vodič)", "Drátový (4-vodič)", "Bezdrátový", "Adresovatelná smyčka"]',    NULL, 10),
    (v_dt_id, 'Připojení PCO / HZS',   'select', false, false, '["Ano – PCO", "Ano – HZS přímé", "Ne", "N/A"]',                                      NULL, 11),
    (v_dt_id, 'Záloha napájení (hod)', 'number', false, false, NULL,                                                                                  NULL, 12),
    (v_dt_id, 'Datum instalace',       'date',   true,  false, NULL,                                                                                  NULL, 13),
    (v_dt_id, 'Datum posledního testu','date',   false, false, NULL,                                                                                  NULL, 14),
    (v_dt_id, 'Datum poslední revize', 'date',   false, false, NULL,                                                                                  NULL, 15),
    (v_dt_id, 'Datum příští revize',   'date',   false, false, NULL,                                                                                  NULL, 16),
    (v_dt_id, 'Odpovědná osoba',       'text',   false, false, NULL,                                                                                  NULL, 17),
    (v_dt_id, 'Číslo revizní zprávy',  'text',   false, false, NULL,                                                                                  NULL, 18),
    (v_dt_id, 'Stav',                  'select', true,  false, '["OK", "Částečná porucha", "Mimo provoz", "Servis"]',                                NULL, 19),
    (v_dt_id, 'Poznámka',              'text',   false, false, NULL,                                                                                  NULL, 20);

INSERT INTO plugin_obj_accessory_types (tech_type_id, name, unit)
VALUES
    (v_dt_id, 'Kouřové detektory',    'ks'),
    (v_dt_id, 'Tepelné detektory',    'ks'),
    (v_dt_id, 'Tlačítkové hlásiče',  'ks'),
    (v_dt_id, 'Detektory CO',        'ks'),
    (v_dt_id, 'Detektory plynu',      'ks'),
    (v_dt_id, 'Čidla záplavy',        'ks'),
    (v_dt_id, 'Akustické sirény',     'ks');


-- ============================================================
-- 6. SK – Strukturovaná kabeláž (pasivní datová infrastruktura)
--    Elementy: Patch panel · Datová zásuvka · Rack · Kabelová trasa · Optická vana
-- ============================================================
INSERT INTO plugin_obj_tech_types (company_id, name, color)
VALUES (v_company_id, 'SK', 'bg-cyan-600')
RETURNING id INTO v_sk_id;

INSERT INTO plugin_obj_tech_fields
    (tech_type_id, name, type, show_in_overview, is_main, options, inventory_param, sort_order)
VALUES
    (v_sk_id, 'Typ prvku',               'select', true,  false, '["Rack / datová skříň", "Patch panel", "Datová zásuvka", "Kabelová trasa", "Optická vana (splice box)", "Optický patch panel", "Horizontální manažer"]', NULL, 1),
    (v_sk_id, 'Označení / č. portu',     'text',   true,  true,  NULL,                                                                                NULL, 2),
    (v_sk_id, 'Výrobce',                'text',   false, false, NULL,                                                                                  NULL, 3),
    (v_sk_id, 'Model / typ',            'text',   false, false, NULL,                                                                                  NULL, 4),
    (v_sk_id, 'Kategorie / třída',      'select', true,  false, '["Cat 5e", "Cat 6", "Cat 6A", "Cat 7", "Cat 8", "Optika OM3", "Optika OM4", "Optika OS2 (SM)", "Smíšená"]', NULL, 5),
    (v_sk_id, 'Počet portů / zásuvek',  'number', false, false, NULL,                                                                                  NULL, 6),
    (v_sk_id, 'Délka trasy (m)',        'number', false, false, NULL,                                                                                  NULL, 7),
    (v_sk_id, 'PoE standard',           'select', false, false, '["Bez PoE", "PoE 802.3af (15W)", "PoE+ 802.3at (30W)", "PoE++ 802.3bt (90W)", "N/A"]', NULL, 8),
    (v_sk_id, 'Umístění v objektu',     'text',   true,  false, NULL,                                                                                  NULL, 9),
    (v_sk_id, 'Trasa od – do',          'text',   false, false, NULL,                                                                                  NULL, 10),
    (v_sk_id, 'Certifikace naměřena',   'select', false, false, '["Ano – splňuje", "Ano – nesplňuje", "Ne"]',                                         NULL, 11),
    (v_sk_id, 'Dokumentace trasy',      'select', false, false, '["Kompletní", "Částečná", "Chybí"]',                                                  NULL, 12),
    (v_sk_id, 'Datum instalace',        'date',   true,  false, NULL,                                                                                  NULL, 13),
    (v_sk_id, 'Záruční certifikát do',  'date',   false, false, NULL,                                                                                  NULL, 14),
    (v_sk_id, 'Datum poslední revize',  'date',   false, false, NULL,                                                                                  NULL, 15),
    (v_sk_id, 'Odpovědná osoba',        'text',   false, false, NULL,                                                                                  NULL, 16),
    (v_sk_id, 'Stav',                   'select', true,  false, '["OK", "Degradovaný výkon", "Fyzické poškození", "Mimo provoz"]',                    NULL, 17),
    (v_sk_id, 'Poznámka',               'text',   false, false, NULL,                                                                                  NULL, 18);

INSERT INTO plugin_obj_accessory_types (tech_type_id, name, unit)
VALUES
    (v_sk_id, 'Datové zásuvky',          'ks'),
    (v_sk_id, 'Patch panely (port)',      'port'),
    (v_sk_id, 'Optické konektory (SC/LC)','ks'),
    (v_sk_id, 'Racky 19"',              'ks'),
    (v_sk_id, 'Kabelové trasy (m)',      'm'),
    (v_sk_id, 'Patch kabely',            'ks');


-- ============================================================
-- 7. PV – Pozemní vysílání (anténní a televizní rozvody)
--    Elementy: Headend · Anténní stanoviště · Zesilovač · Splitter · TV vývod · LNB
-- ============================================================
INSERT INTO plugin_obj_tech_types (company_id, name, color)
VALUES (v_company_id, 'PV', 'bg-orange-500')
RETURNING id INTO v_pv_id;

INSERT INTO plugin_obj_tech_fields
    (tech_type_id, name, type, show_in_overview, is_main, options, inventory_param, sort_order)
VALUES
    (v_pv_id, 'Typ prvku',                  'select', true,  false, '["Headend / centrální zesilovač", "Anténní stanoviště", "Anténa – Yagi", "Anténa – Logaritmická", "Anténa – Parabolická (SAT)", "Anténa – Omni", "Sloupkový zesilovač", "Rozbočovač / splitter", "LNB konvertor", "TV zásuvka (vývod)", "Stožár / konzola", "Bleskosvod antény"]', NULL, 1),
    (v_pv_id, 'Označení / č. vývodu',       'text',   true,  true,  NULL,                                                                                NULL, 2),
    (v_pv_id, 'Výrobce',                   'text',   false, false, NULL,                                                                                  NULL, 3),
    (v_pv_id, 'Model',                     'text',   false, false, NULL,                                                                                  NULL, 4),
    (v_pv_id, 'Typ rozvodu / signálu',     'select', true,  false, '["DVB-T2", "DVB-S2 (SAT)", "DVB-C (kabel)", "IPTV", "FM rádio", "DAB+", "Kombinovaný"]', NULL, 5),
    (v_pv_id, 'Umístění v objektu',        'text',   true,  false, NULL,                                                                                  NULL, 6),
    (v_pv_id, 'Úroveň signálu (dBμV)',     'number', false, false, NULL,                                                                                  NULL, 7),
    (v_pv_id, 'Zisk / zesílení (dB)',      'number', false, false, NULL,                                                                                  NULL, 8),
    (v_pv_id, 'Typ koaxiálního kabelu',    'select', false, false, '["RG-6", "RG-11", "Tri-shield 75Ω", "Quad-shield 75Ω", "Optický koax (HFC)", "N/A"]', NULL, 9),
    (v_pv_id, 'LNB typ',                  'select', false, false, '["Single", "Twin", "Quad", "Octo", "Unicable (EN50494)", "N/A"]',                      NULL, 10),
    (v_pv_id, 'Multiplexy DVB-T2',        'select', false, false, '["MUX1–4", "MUX1–6", "MUX1–8", "N/A"]',                                             NULL, 11),
    (v_pv_id, 'Datum instalace',           'date',   true,  false, NULL,                                                                                  NULL, 12),
    (v_pv_id, 'Datum měření signálu',      'date',   false, false, NULL,                                                                                  NULL, 13),
    (v_pv_id, 'Datum poslední revize',     'date',   false, false, NULL,                                                                                  NULL, 14),
    (v_pv_id, 'Datum příští revize',       'date',   false, false, NULL,                                                                                  NULL, 15),
    (v_pv_id, 'Odpovědná osoba',           'text',   false, false, NULL,                                                                                  NULL, 16),
    (v_pv_id, 'Stav',                      'select', true,  false, '["OK", "Degradovaný signál", "Výpadek", "Servis"]',                                  NULL, 17),
    (v_pv_id, 'Poznámka',                  'text',   false, false, NULL,                                                                                  NULL, 18);

INSERT INTO plugin_obj_accessory_types (tech_type_id, name, unit)
VALUES
    (v_pv_id, 'Antény',                 'ks'),
    (v_pv_id, 'Zesilovače',            'ks'),
    (v_pv_id, 'Rozbočovače / splittry','ks'),
    (v_pv_id, 'TV zásuvky (vývody)',   'ks'),
    (v_pv_id, 'LNB konvertory',        'ks'),
    (v_pv_id, 'Stožáry / konzoly',     'ks'),
    (v_pv_id, 'Koaxiální kabel (m)',   'm');


-- ============================================================
-- 8. LAN/WiFi – Aktivní síťová infrastruktura
--    Elementy: Firewall · Switch · Access point · PoE injektor · UPS · SFP
-- ============================================================
INSERT INTO plugin_obj_tech_types (company_id, name, color)
VALUES (v_company_id, 'LAN/WiFi', 'bg-teal-600')
RETURNING id INTO v_lw_id;

INSERT INTO plugin_obj_tech_fields
    (tech_type_id, name, type, show_in_overview, is_main, options, inventory_param, sort_order)
VALUES
    (v_lw_id, 'Typ prvku',               'select', true,  false, '["Firewall / UTM", "Router", "L3 switch (směrovací)", "L2 switch (přepínač)", "Access point (AP)", "Wireless controller", "PoE injektor", "Mediakonvertor", "UPS pro síť", "SFP / SFP+ modul"]', NULL, 1),
    (v_lw_id, 'Označení / název',        'text',   true,  true,  NULL,                                                                                NULL, 2),
    (v_lw_id, 'Výrobce',               'text',   false, false, NULL,                                                                                   NULL, 3),
    (v_lw_id, 'Model',                 'text',   true,  false, NULL,                                                                                   NULL, 4),
    (v_lw_id, 'Sériové číslo',         'text',   false, false, NULL,                                                                                   NULL, 5),
    (v_lw_id, 'IP adresa',             'text',   true,  false, NULL,                                                                                   NULL, 6),
    (v_lw_id, 'MAC adresa',            'text',   false, false, NULL,                                                                                   NULL, 7),
    (v_lw_id, 'VLAN / segment',        'text',   false, false, NULL,                                                                                   NULL, 8),
    (v_lw_id, 'Počet portů',           'number', false, false, NULL,                                                                                   NULL, 9),
    (v_lw_id, 'WiFi standard',         'select', false, false, '["802.11n (WiFi 4)", "802.11ac (WiFi 5)", "802.11ax (WiFi 6)", "802.11ax (WiFi 6E)", "802.11be (WiFi 7)", "N/A"]', NULL, 10),
    (v_lw_id, 'Frekvenční pásmo',      'select', false, false, '["2,4 GHz", "5 GHz", "6 GHz", "Dual-band 2,4+5", "Tri-band 2,4+5+6", "N/A"]',        NULL, 11),
    (v_lw_id, 'PoE (výstup)',          'select', false, false, '["Bez PoE", "PoE 802.3af (15W)", "PoE+ 802.3at (30W)", "PoE++ 802.3bt (90W)", "N/A"]', NULL, 12),
    (v_lw_id, 'Umístění v objektu',    'text',   true,  false, NULL,                                                                                   NULL, 13),
    (v_lw_id, 'Verze firmware',        'text',   false, false, NULL,                                                                                   NULL, 14),
    (v_lw_id, 'Správa zařízení',       'select', false, false, '["Cloud (vendor)", "On-premise controller", "Lokální web GUI", "CLI", "N/A"]',         NULL, 15),
    (v_lw_id, 'Datum instalace',       'date',   true,  false, NULL,                                                                                   NULL, 16),
    (v_lw_id, 'Datum aktualizace FW',  'date',   false, false, NULL,                                                                                   NULL, 17),
    (v_lw_id, 'Datum poslední revize', 'date',   false, false, NULL,                                                                                   NULL, 18),
    (v_lw_id, 'Datum příští revize',   'date',   false, false, NULL,                                                                                   NULL, 19),
    (v_lw_id, 'Odpovědná osoba',       'text',   false, false, NULL,                                                                                   NULL, 20),
    (v_lw_id, 'Správce sítě (kontakt)','text',   false, false, NULL,                                                                                   NULL, 21),
    (v_lw_id, 'Stav',                  'select', true,  false, '["OK", "Degradovaný výkon", "Výpadek", "Servis"]',                                    NULL, 22),
    (v_lw_id, 'Poznámka',              'text',   false, false, NULL,                                                                                   NULL, 23);

INSERT INTO plugin_obj_accessory_types (tech_type_id, name, unit)
VALUES
    (v_lw_id, 'Access pointy (AP)',    'ks'),
    (v_lw_id, 'Přepínače (switche)',   'ks'),
    (v_lw_id, 'Routery / firewall',    'ks'),
    (v_lw_id, 'PoE injektory',         'ks'),
    (v_lw_id, 'UPS pro síť',           'ks'),
    (v_lw_id, 'SFP / SFP+ moduly',    'ks');


-- ============================================================
-- 9. ID – Inteligentní domácnost / budova
--    Připraveno pro Loxone; kompatibilní s KNX, ABB, HDL, …
--    Elementy: Miniserver · Tree ext. · Air zař. · Touch panel · Aktuátory
-- ============================================================
INSERT INTO plugin_obj_tech_types (company_id, name, color)
VALUES (v_company_id, 'ID', 'bg-violet-600')
RETURNING id INTO v_id_id;

INSERT INTO plugin_obj_tech_fields
    (tech_type_id, name, type, show_in_overview, is_main, options, inventory_param, sort_order)
VALUES
    (v_id_id, 'Typ prvku',                   'select', true,  false, '["Miniserver / centrální jednotka", "Tree Extension", "Tree I/O modul", "Air Base (přijímač)", "Air zařízení (bezdrátové)", "Dotykový panel (Touch)", "Stmívač (dimmer)", "Spínací aktuátor", "Žaluziový aktuátor", "Termostatická hlavice", "Meteorologická stanice", "Loxone NFC Code Touch", "Inteligentní zásuvka", "Relé modul", "UPS pro řídicí jednotku"]', NULL, 1),
    (v_id_id, 'Označení / název',             'text',   true,  true,  NULL,                                                                               NULL, 2),
    (v_id_id, 'Výrobce',                    'text',   false, false, NULL,                                                                                  NULL, 3),
    (v_id_id, 'Model / typ',               'text',   true,  false, NULL,                                                                                  NULL, 4),
    (v_id_id, 'Sériové číslo',             'text',   false, false, NULL,                                                                                  NULL, 5),
    (v_id_id, 'MAC adresa / UUID',          'text',   false, false, NULL,                                                                                  NULL, 6),
    (v_id_id, 'Sběrnice / protokol',        'select', true,  false, '["Tree", "Air (868 MHz)", "Link (RS485)", "Ethernet / IP", "KNX TP", "KNX IP", "Modbus RTU", "Modbus TCP", "0–10V", "PWM", "Interní / přímý"]', NULL, 7),
    (v_id_id, 'Ovládaný okruh / funkce',    'select', true,  false, '["Osvětlení", "Stmívání", "Žaluzie / rolety", "Topení", "Chlazení", "Klimatizace", "Podlahové topení", "Zavlažování", "Bazén / sauna", "Audio / video", "Měření spotřeby", "Meteorologie", "Zabezpečení (PZTS)", "EKV / přístup", "Obecný vstup/výstup", "Jiný"]', NULL, 8),
    (v_id_id, 'Místnost / zóna',            'text',   true,  false, NULL,                                                                                  NULL, 9),
    (v_id_id, 'IP adresa',                  'text',   false, false, NULL,                                                                                  NULL, 10),

    -- Loxone-specifická pole (relevantní hlavně pro Miniserver)
    (v_id_id, 'Loxone – typ Miniserveru',   'select', false, false, '["Miniserver Gen 1", "Miniserver Gen 2", "Miniserver Go Gen 1", "Miniserver Go Gen 2", "Compact Server", "N/A"]', NULL, 11),
    (v_id_id, 'Loxone – verze firmware',    'text',   false, false, NULL,                                                                                  NULL, 12),
    (v_id_id, 'Loxone – Config projekt',    'text',   false, false, NULL,                                                                                  NULL, 13),
    (v_id_id, 'Loxone – záloha projektu',   'select', false, false, '["Cloud (myLoxone)", "Lokální (NAS/server)", "Obě", "Žádná", "N/A"]',               NULL, 14),
    (v_id_id, 'Loxone – vzdálený přístup',  'select', false, false, '["myLoxone Cloud", "VPN", "Přímý IP", "Kombinovaný", "Není", "N/A"]',               NULL, 15),

    -- Společná pole
    (v_id_id, 'Propojení s PZTS',           'select', false, false, '["Ano", "Ne"]',                                                                      NULL, 16),
    (v_id_id, 'Propojení s EKV',            'select', false, false, '["Ano", "Ne"]',                                                                      NULL, 17),
    (v_id_id, 'Propojení s FVE / baterií',  'select', false, false, '["Ano", "Ne"]',                                                                      NULL, 18),
    (v_id_id, 'Instalatér / programátor',   'text',   false, false, NULL,                                                                                  NULL, 19),
    (v_id_id, 'Datum instalace',             'date',   true,  false, NULL,                                                                                  NULL, 20),
    (v_id_id, 'Datum aktualizace FW',        'date',   false, false, NULL,                                                                                  NULL, 21),
    (v_id_id, 'Datum poslední revize',       'date',   false, false, NULL,                                                                                  NULL, 22),
    (v_id_id, 'Datum příští revize',         'date',   false, false, NULL,                                                                                  NULL, 23),
    (v_id_id, 'Odpovědná osoba',             'text',   false, false, NULL,                                                                                  NULL, 24),
    (v_id_id, 'Stav',                        'select', true,  false, '["OK", "Částečná porucha", "Mimo provoz", "Servis / update"]',                      NULL, 25),
    (v_id_id, 'Poznámka',                    'text',   false, false, NULL,                                                                                  NULL, 26);

INSERT INTO plugin_obj_accessory_types (tech_type_id, name, unit)
VALUES
    (v_id_id, 'Miniservery / centrály',    'ks'),
    (v_id_id, 'Tree Extension moduly',     'ks'),
    (v_id_id, 'Air zařízení',             'ks'),
    (v_id_id, 'Dotykové panely (Touch)',   'ks'),
    (v_id_id, 'Stmívače (dimmer)',         'ks'),
    (v_id_id, 'Spínací aktuátory',        'ks'),
    (v_id_id, 'Žaluziové aktuátory',      'ks'),
    (v_id_id, 'Termostatické hlavice',     'ks'),
    (v_id_id, 'Meteorologické stanice',    'ks'),
    (v_id_id, 'UPS pro řídicí jednotku',   'ks');


RAISE NOTICE 'Import dokončen. Typy: CCTV (%), PZTS (%), EKV (%), MZS (%), DT (%), SK (%), PV (%), LAN/WiFi (%), ID (%)',
    v_cctv_id, v_pzts_id, v_ekv_id, v_mzs_id, v_dt_id, v_sk_id, v_pv_id, v_lw_id, v_id_id;

END $$;
