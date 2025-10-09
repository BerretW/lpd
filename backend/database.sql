/*
Navicat MariaDB Data Transfer

Source Server         : local
Source Server Version : 120002
Source Host           : localhost:3306
Source Database       : database

Target Server Type    : MariaDB
Target Server Version : 120002
File Encoding         : 65001

Date: 2025-10-09 15:17:23
*/

SET FOREIGN_KEY_CHECKS=0;

-- ----------------------------
-- Table structure for clients
-- ----------------------------
DROP TABLE IF EXISTS `clients`;
CREATE TABLE `clients` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `company_id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `created_at` timestamp NOT NULL,
  `legal_name` varchar(255) DEFAULT NULL,
  `contact_person` varchar(255) DEFAULT NULL,
  `ico` varchar(20) DEFAULT NULL,
  `dic` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_client_company_name` (`company_id`,`name`),
  KEY `ix_clients_company_id` (`company_id`),
  KEY `ix_clients_ico` (`ico`),
  KEY `ix_clients_dic` (`dic`),
  CONSTRAINT `clients_ibfk_1` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Records of clients
-- ----------------------------
INSERT INTO `clients` VALUES ('1', '1', 'ČSOB', null, null, 'Někde', '2025-10-09 08:13:25', 'ČSOB', null, null, null);
INSERT INTO `clients` VALUES ('2', '2', 'Billing Client', null, null, null, '2025-10-09 08:24:51', null, null, '87654321', null);
INSERT INTO `clients` VALUES ('3', '6', 'Direct Assign Client', null, null, null, '2025-10-09 09:54:19', null, null, null, null);
INSERT INTO `clients` VALUES ('4', '7', 'Direct Assign Client', null, null, null, '2025-10-09 12:09:56', null, null, null, null);

-- ----------------------------
-- Table structure for companies
-- ----------------------------
DROP TABLE IF EXISTS `companies`;
CREATE TABLE `companies` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `slug` varchar(255) NOT NULL,
  `logo_url` varchar(512) DEFAULT NULL,
  `created_at` timestamp NOT NULL,
  `legal_name` varchar(255) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `ico` varchar(20) DEFAULT NULL,
  `dic` varchar(20) DEFAULT NULL,
  `executive` varchar(255) DEFAULT NULL,
  `bank_account` varchar(50) DEFAULT NULL,
  `iban` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ix_companies_slug` (`slug`),
  UNIQUE KEY `ix_companies_name` (`name`),
  KEY `ix_companies_ico` (`ico`),
  KEY `ix_companies_dic` (`dic`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Records of companies
-- ----------------------------
INSERT INTO `companies` VALUES ('1', 'Test Co 1759996769', 'test-co-1759996769', null, '2025-10-09 07:59:30', null, null, null, null, null, null, null);
INSERT INTO `companies` VALUES ('2', 'Test Co 1759998290', 'test-co-1759998290', null, '2025-10-09 08:24:50', null, 'Testovací 1, Praha', '12345678', 'CZ12345678', null, null, null);
INSERT INTO `companies` VALUES ('3', 'Test Co 1760003466', 'test-co-1760003466', null, '2025-10-09 09:51:06', null, null, null, null, null, null, null);
INSERT INTO `companies` VALUES ('4', 'Test Co 1760003568', 'test-co-1760003568', null, '2025-10-09 09:52:48', null, null, null, null, null, null, null);
INSERT INTO `companies` VALUES ('5', 'Test Co 1760003614', 'test-co-1760003614', null, '2025-10-09 09:53:34', null, null, null, null, null, null, null);
INSERT INTO `companies` VALUES ('6', 'Test Co 1760003658', 'test-co-1760003658', null, '2025-10-09 09:54:18', null, null, null, null, null, null, null);
INSERT INTO `companies` VALUES ('7', 'Test Co 1760011794', 'test-co-1760011794', null, '2025-10-09 12:09:54', null, null, null, null, null, null, null);

-- ----------------------------
-- Table structure for company_smtp_settings
-- ----------------------------
DROP TABLE IF EXISTS `company_smtp_settings`;
CREATE TABLE `company_smtp_settings` (
  `company_id` int(11) NOT NULL,
  `is_enabled` tinyint(1) NOT NULL,
  `smtp_host` varchar(255) NOT NULL,
  `smtp_port` int(11) NOT NULL,
  `smtp_user` varchar(255) NOT NULL,
  `encrypted_password` varchar(512) NOT NULL,
  `sender_email` varchar(255) NOT NULL,
  `security_protocol` enum('NONE','TLS','SSL') NOT NULL,
  `notification_settings` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`notification_settings`)),
  PRIMARY KEY (`company_id`),
  CONSTRAINT `company_smtp_settings_ibfk_1` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Records of company_smtp_settings
-- ----------------------------
INSERT INTO `company_smtp_settings` VALUES ('1', '1', 'smtp.gmail.com', '587', 'spoiledmousecz@gmail.com', 'gAAAAABo52tibmR1-W7ufkIGu2hE2wKytyLJEmcbZ_AZ1i3-Osw5DH1JLoBOm46iSx99fnlWN8PpIkTYh889n52fzQwjlGePYcxTDCS9b1kQG9P9VCdQsXA=', 'spoiledmousecz@gmail.com', 'TLS', 0x7B226F6E5F696E766974655F63726561746564223A20747275652C20226F6E5F6275646765745F616C657274223A20747275652C20226F6E5F6C6F775F73746F636B5F616C657274223A20747275657D);

-- ----------------------------
-- Table structure for inventory_audit_logs
-- ----------------------------
DROP TABLE IF EXISTS `inventory_audit_logs`;
CREATE TABLE `inventory_audit_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `item_id` int(11) DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `company_id` int(11) NOT NULL,
  `action` enum('created','updated','deleted','quantity_adjusted','location_placed','location_withdrawn','location_transferred','write_off','picking_fulfilled') NOT NULL,
  `details` text DEFAULT NULL,
  `timestamp` timestamp NOT NULL,
  PRIMARY KEY (`id`),
  KEY `item_id` (`item_id`),
  KEY `ix_inventory_audit_logs_company_id` (`company_id`),
  KEY `ix_inventory_audit_logs_timestamp` (`timestamp`),
  KEY `ix_inventory_audit_logs_user_id` (`user_id`),
  CONSTRAINT `inventory_audit_logs_ibfk_1` FOREIGN KEY (`item_id`) REFERENCES `inventory_items` (`id`) ON DELETE SET NULL,
  CONSTRAINT `inventory_audit_logs_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `inventory_audit_logs_ibfk_3` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=78 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Records of inventory_audit_logs
-- ----------------------------
INSERT INTO `inventory_audit_logs` VALUES ('1', '1', '1', '1', 'created', 'Položka \'A20\' byla vytvořena s nulovým stavem.', '2025-10-09 08:04:06');
INSERT INTO `inventory_audit_logs` VALUES ('2', '1', '1', '1', 'location_placed', 'Naskladněno 1 ks na lokaci \'Sklad 1\'.', '2025-10-09 08:04:52');
INSERT INTO `inventory_audit_logs` VALUES ('3', '1', '1', '1', 'location_placed', 'Naskladněno 1 ks na lokaci \'Sklad 1\'.', '2025-10-09 08:05:06');
INSERT INTO `inventory_audit_logs` VALUES ('4', '1', '1', '1', 'location_placed', 'Naskladněno 1 ks na lokaci \'Sklad 1\'.', '2025-10-09 08:06:39');
INSERT INTO `inventory_audit_logs` VALUES ('5', '1', '1', '1', 'location_transferred', 'Přesunuto 1 ks z \'Sklad 1\' na \'Auto Lojza\'.', '2025-10-09 08:06:59');
INSERT INTO `inventory_audit_logs` VALUES ('6', '2', '3', '2', 'created', 'Položka \'Monitorable Item\' byla vytvořena s nulovým stavem.', '2025-10-09 08:24:51');
INSERT INTO `inventory_audit_logs` VALUES ('7', '2', '3', '2', 'location_placed', 'Naskladněno 15 ks na lokaci \'Main Warehouse\'.', '2025-10-09 08:24:51');
INSERT INTO `inventory_audit_logs` VALUES ('8', '2', '3', '2', 'location_withdrawn', 'Odebráno 6 ks z lokace \'Main Warehouse\' pro úkol ID: 2. Stav na lokaci změněn z 15 na 9.', '2025-10-09 08:24:51');
INSERT INTO `inventory_audit_logs` VALUES ('9', '1', '2', '1', 'location_withdrawn', 'Odebráno 1 ks z lokace \'Auto Lojza\' pro úkol ID: 1. Stav na lokaci změněn z 1 na 0.', '2025-10-09 08:35:19');
INSERT INTO `inventory_audit_logs` VALUES ('10', '1', '2', '1', 'quantity_adjusted', 'Vráceno 1 ks položky \'A20\' zpět na sklad (lokace: \'Auto Lojza\') z úkolu ID: 1.', '2025-10-09 08:38:29');
INSERT INTO `inventory_audit_logs` VALUES ('11', '1', '1', '1', 'quantity_adjusted', 'Přímý příjem 100 ks položky \'A20\' (SKU: 5678) a okamžité přiřazení k úkolu ID: 1. z ADI', '2025-10-09 08:48:21');
INSERT INTO `inventory_audit_logs` VALUES ('12', '1', '1', '1', 'quantity_adjusted', 'Vráceno 100 ks položky \'A20\' zpět na sklad (lokace: \'Neznámá lokace\') z úkolu ID: 1.', '2025-10-09 08:53:16');
INSERT INTO `inventory_audit_logs` VALUES ('13', '1', '2', '1', 'quantity_adjusted', 'Přímý příjem 14 ks položky \'A20\' (SKU: 5678) a okamžité přiřazení k úkolu ID: 1. 567898765678', '2025-10-09 08:55:00');
INSERT INTO `inventory_audit_logs` VALUES ('14', '1', '2', '1', 'quantity_adjusted', 'Vráceno 14 ks položky \'A20\' zpět na sklad (lokace: \'Neznámá lokace\') z úkolu ID: 1.', '2025-10-09 08:55:04');
INSERT INTO `inventory_audit_logs` VALUES ('15', '1', '1', '1', 'quantity_adjusted', 'Přímý příjem 1 ks položky \'A20\' (SKU: 5678) a okamžité přiřazení k úkolu ID: 3.', '2025-10-09 08:56:14');
INSERT INTO `inventory_audit_logs` VALUES ('16', '1', '1', '1', 'quantity_adjusted', 'Přímý příjem 1 ks položky \'A20\' (SKU: 5678) a okamžité přiřazení k úkolu ID: 3.', '2025-10-09 08:56:24');
INSERT INTO `inventory_audit_logs` VALUES ('17', '1', '1', '1', 'quantity_adjusted', 'Vráceno 1 ks položky \'A20\' zpět na sklad (lokace: \'Neznámá lokace\') z úkolu ID: 3.', '2025-10-09 08:56:28');
INSERT INTO `inventory_audit_logs` VALUES ('18', '1', '1', '1', 'quantity_adjusted', 'Množství položky \'A20\' pro úkol ID:3 upraveno z 1 na 2. Změna stavu na lokaci \'N/A\': -1 ks.', '2025-10-09 08:56:30');
INSERT INTO `inventory_audit_logs` VALUES ('19', '1', '1', '1', 'quantity_adjusted', 'Množství položky \'A20\' pro úkol ID:3 upraveno z 2 na 1. Změna stavu na lokaci \'N/A\': +1 ks.', '2025-10-09 08:56:43');
INSERT INTO `inventory_audit_logs` VALUES ('20', '1', '1', '1', 'quantity_adjusted', 'Přímý příjem 100 ks položky \'A20\' (SKU: 5678) a okamžité přiřazení k úkolu ID: 3.', '2025-10-09 09:20:44');
INSERT INTO `inventory_audit_logs` VALUES ('21', '1', '1', '1', 'quantity_adjusted', 'Vráceno 100 ks položky \'A20\' zpět na sklad (lokace: \'Neznámá lokace\') z úkolu ID: 3.', '2025-10-09 09:21:00');
INSERT INTO `inventory_audit_logs` VALUES ('22', '1', '1', '1', 'quantity_adjusted', 'Přímý příjem 100 ks položky \'A20\' (SKU: 5678) a okamžité přiřazení k úkolu ID: 3.', '2025-10-09 09:25:45');
INSERT INTO `inventory_audit_logs` VALUES ('23', '1', '1', '1', 'quantity_adjusted', 'Naskladněno 100 ks položky \'A20\' na výchozí sklad \'Auto Lojza\' po smazání z přímého nákupu u úkolu ID: 3.', '2025-10-09 09:25:52');
INSERT INTO `inventory_audit_logs` VALUES ('24', '1', '1', '1', 'write_off', 'Odpis 100 ks z lokace \'Auto Lojza\'. Stav změněn z 101 na 1. Důvod: Vysypal je z auta do rybníka', '2025-10-09 09:32:41');
INSERT INTO `inventory_audit_logs` VALUES ('25', '1', '2', '1', 'location_withdrawn', 'Odebráno 1 ks z lokace \'Auto Lojza\' pro úkol ID: 1. Stav na lokaci změněn z 1 na 0.', '2025-10-09 09:41:31');
INSERT INTO `inventory_audit_logs` VALUES ('26', '3', '7', '4', 'created', 'Položka \'Čidlo A\' byla vytvořena s nulovým stavem.', '2025-10-09 09:52:50');
INSERT INTO `inventory_audit_logs` VALUES ('27', '4', '7', '4', 'created', 'Položka \'Kabel B\' byla vytvořena s nulovým stavem.', '2025-10-09 09:52:50');
INSERT INTO `inventory_audit_logs` VALUES ('28', '3', '7', '4', 'location_placed', 'Naskladněno 50 ks na lokaci \'Hlavní sklad\'.', '2025-10-09 09:52:50');
INSERT INTO `inventory_audit_logs` VALUES ('29', '4', '7', '4', 'location_placed', 'Naskladněno 100 ks na lokaci \'Hlavní sklad\'.', '2025-10-09 09:52:50');
INSERT INTO `inventory_audit_logs` VALUES ('30', '3', '7', '4', 'write_off', 'Odpis 5 ks z lokace \'Hlavní sklad\'. Stav změněn z 50 na 45. Důvod: Poškozeno při přepravě', '2025-10-09 09:52:51');
INSERT INTO `inventory_audit_logs` VALUES ('31', '5', '9', '5', 'created', 'Položka \'Čidlo A\' byla vytvořena s nulovým stavem.', '2025-10-09 09:53:35');
INSERT INTO `inventory_audit_logs` VALUES ('32', '6', '9', '5', 'created', 'Položka \'Kabel B\' byla vytvořena s nulovým stavem.', '2025-10-09 09:53:35');
INSERT INTO `inventory_audit_logs` VALUES ('33', '5', '9', '5', 'location_placed', 'Naskladněno 50 ks na lokaci \'Hlavní sklad\'.', '2025-10-09 09:53:35');
INSERT INTO `inventory_audit_logs` VALUES ('34', '6', '9', '5', 'location_placed', 'Naskladněno 100 ks na lokaci \'Hlavní sklad\'.', '2025-10-09 09:53:35');
INSERT INTO `inventory_audit_logs` VALUES ('35', '5', '9', '5', 'write_off', 'Odpis 5 ks z lokace \'Hlavní sklad\'. Stav změněn z 50 na 45. Důvod: Poškozeno při přepravě', '2025-10-09 09:53:35');
INSERT INTO `inventory_audit_logs` VALUES ('36', '7', '11', '6', 'created', 'Položka \'Čidlo A\' byla vytvořena s nulovým stavem.', '2025-10-09 09:54:19');
INSERT INTO `inventory_audit_logs` VALUES ('37', '8', '11', '6', 'created', 'Položka \'Kabel B\' byla vytvořena s nulovým stavem.', '2025-10-09 09:54:19');
INSERT INTO `inventory_audit_logs` VALUES ('38', '7', '11', '6', 'location_placed', 'Naskladněno 50 ks na lokaci \'Hlavní sklad\'.', '2025-10-09 09:54:19');
INSERT INTO `inventory_audit_logs` VALUES ('39', '8', '11', '6', 'location_placed', 'Naskladněno 100 ks na lokaci \'Hlavní sklad\'.', '2025-10-09 09:54:19');
INSERT INTO `inventory_audit_logs` VALUES ('40', '7', '11', '6', 'write_off', 'Odpis 5 ks z lokace \'Hlavní sklad\'. Stav změněn z 50 na 45. Důvod: Poškozeno při přepravě', '2025-10-09 09:54:19');
INSERT INTO `inventory_audit_logs` VALUES ('41', '9', '11', '6', 'created', 'Položka \'Nová svorka, 5mm\' byla vytvořena s nulovým stavem.', '2025-10-09 09:54:19');
INSERT INTO `inventory_audit_logs` VALUES ('42', '9', '11', '6', 'location_placed', 'Naskladněno 20 ks na lokaci \'Hlavní sklad\'.', '2025-10-09 09:54:19');
INSERT INTO `inventory_audit_logs` VALUES ('43', '7', '11', '6', 'picking_fulfilled', 'Splněn požadavek #3: 10 ks přesunuto z \'Hlavní sklad\' do \'Vozidlo Technika\'.', '2025-10-09 09:54:19');
INSERT INTO `inventory_audit_logs` VALUES ('44', '9', '11', '6', 'picking_fulfilled', 'Splněn požadavek #3: 5 ks přesunuto z \'Hlavní sklad\' do \'Vozidlo Technika\'.', '2025-10-09 09:54:19');
INSERT INTO `inventory_audit_logs` VALUES ('45', '8', '11', '6', 'quantity_adjusted', 'Přímý příjem 15 ks položky \'Kabel B\' (SKU: KABEL-B-1760003658) a okamžité přiřazení k úkolu ID: 4. Zakoupeno přímo na stavbě', '2025-10-09 09:54:19');
INSERT INTO `inventory_audit_logs` VALUES ('46', '8', '11', '6', 'quantity_adjusted', 'Naskladněno 15 ks položky \'Kabel B\' na výchozí sklad \'Hlavní sklad\' po smazání z přímého nákupu u úkolu ID: 4.', '2025-10-09 09:54:19');
INSERT INTO `inventory_audit_logs` VALUES ('47', '10', '1', '1', 'created', 'Položka \'AD800AM\' byla vytvořena s nulovým stavem.', '2025-10-09 10:14:11');
INSERT INTO `inventory_audit_logs` VALUES ('48', '10', '1', '1', 'location_placed', 'Naskladněno 5 ks na lokaci \'Sklad 1\'.', '2025-10-09 10:22:03');
INSERT INTO `inventory_audit_logs` VALUES ('49', '10', '1', '1', 'picking_fulfilled', 'Splněn požadavek #4: 1 ks přesunuto z \'Sklad 1\' do \'Auto Lojza\'.', '2025-10-09 10:22:25');
INSERT INTO `inventory_audit_logs` VALUES ('50', '1', '1', '1', 'picking_fulfilled', 'Splněn požadavek #7: 1 ks přesunuto z \'Sklad 1\' do \'Auto Lojza\'.', '2025-10-09 11:04:32');
INSERT INTO `inventory_audit_logs` VALUES ('51', '1', '1', '1', 'updated', 'Pole \'ean\' změněno z \'\' na \'None\'.', '2025-10-09 11:57:04');
INSERT INTO `inventory_audit_logs` VALUES ('52', '10', '2', '1', 'location_withdrawn', 'Odebráno 1 ks z lokace \'Auto Lojza\' pro úkol ID: 5. Stav na lokaci změněn z 1 na 0.', '2025-10-09 12:08:05');
INSERT INTO `inventory_audit_logs` VALUES ('53', '11', '13', '7', 'created', 'Položka \'Čidlo A\' byla vytvořena s nulovým stavem.', '2025-10-09 12:09:55');
INSERT INTO `inventory_audit_logs` VALUES ('54', '12', '13', '7', 'created', 'Položka \'Kabel B\' byla vytvořena s nulovým stavem.', '2025-10-09 12:09:55');
INSERT INTO `inventory_audit_logs` VALUES ('55', '11', '13', '7', 'location_placed', 'Naskladněno 50 ks na lokaci \'Hlavní sklad\'.', '2025-10-09 12:09:55');
INSERT INTO `inventory_audit_logs` VALUES ('56', '12', '13', '7', 'location_placed', 'Naskladněno 100 ks na lokaci \'Hlavní sklad\'.', '2025-10-09 12:09:55');
INSERT INTO `inventory_audit_logs` VALUES ('57', '11', '13', '7', 'write_off', 'Odpis 5 ks z lokace \'Hlavní sklad\'. Stav změněn z 50 na 45. Důvod: Poškozeno při přepravě', '2025-10-09 12:09:55');
INSERT INTO `inventory_audit_logs` VALUES ('58', '13', '13', '7', 'created', 'Položka \'Nová svorka, 5mm\' byla vytvořena s nulovým stavem.', '2025-10-09 12:09:55');
INSERT INTO `inventory_audit_logs` VALUES ('59', '13', '13', '7', 'location_placed', 'Naskladněno 20 ks na lokaci \'Hlavní sklad\'.', '2025-10-09 12:09:55');
INSERT INTO `inventory_audit_logs` VALUES ('60', '11', '13', '7', 'picking_fulfilled', 'Splněn požadavek #9: 10 ks přesunuto z \'Hlavní sklad\' do \'Vozidlo Technika\'.', '2025-10-09 12:09:56');
INSERT INTO `inventory_audit_logs` VALUES ('61', '13', '13', '7', 'picking_fulfilled', 'Splněn požadavek #9: 5 ks přesunuto z \'Hlavní sklad\' do \'Vozidlo Technika\'.', '2025-10-09 12:09:56');
INSERT INTO `inventory_audit_logs` VALUES ('62', '12', '13', '7', 'quantity_adjusted', 'Přímý příjem 15 ks položky \'Kabel B\' (SKU: KABEL-B-1760011794) a okamžité přiřazení k úkolu ID: 6. Zakoupeno přímo na stavbě', '2025-10-09 12:09:56');
INSERT INTO `inventory_audit_logs` VALUES ('63', '12', '13', '7', 'quantity_adjusted', 'Naskladněno 15 ks položky \'Kabel B\' na výchozí sklad \'Hlavní sklad\' po smazání z přímého nákupu u úkolu ID: 6.', '2025-10-09 12:09:56');
INSERT INTO `inventory_audit_logs` VALUES ('64', '1', '1', '1', 'location_placed', 'Splněn požadavek na pořízení #8: 5 ks naskladněno do \'Auto Lojza\'.', '2025-10-09 12:11:05');
INSERT INTO `inventory_audit_logs` VALUES ('65', '10', '1', '1', 'location_placed', 'Splněn požadavek na pořízení #12: 2 ks naskladněno do \'Auto Lojza\'.', '2025-10-09 12:15:25');
INSERT INTO `inventory_audit_logs` VALUES ('66', '1', '1', '1', 'location_placed', 'Naskladněno 10 ks na lokaci \'Sklad 1\'.', '2025-10-09 12:17:49');
INSERT INTO `inventory_audit_logs` VALUES ('67', '10', '1', '1', 'location_placed', 'Naskladněno 10 ks na lokaci \'Sklad 1\'.', '2025-10-09 12:17:55');
INSERT INTO `inventory_audit_logs` VALUES ('68', '1', '1', '1', 'updated', 'Pole \'category_id\' změněno z \'1\' na \'13\'. | Pole \'ean\' změněno z \'None\' na \'\'.', '2025-10-09 12:34:06');
INSERT INTO `inventory_audit_logs` VALUES ('69', '10', '1', '1', 'updated', 'Pole \'description\' změněno z \'None\' na \'\'. | Pole \'category_id\' změněno z \'1\' na \'8\'. | Pole \'ean\' změněno z \'None\' na \'\'. | Pole \'vat_rate\' změněno z \'None\' na \'21.0\'.', '2025-10-09 12:34:11');
INSERT INTO `inventory_audit_logs` VALUES ('70', '1', '1', '1', 'location_placed', 'Splněn požadavek na pořízení #13: 6 ks naskladněno do \'Auto Lojza\'.', '2025-10-09 12:35:41');
INSERT INTO `inventory_audit_logs` VALUES ('71', '1', '1', '1', 'picking_fulfilled', 'Splněn požadavek #14: 1 ks přesunuto z \'Sklad 1\' do \'Sklad 1\'.', '2025-10-09 12:55:20');
INSERT INTO `inventory_audit_logs` VALUES ('72', '1', '1', '1', 'picking_fulfilled', 'Splněn požadavek #15: 2 ks přesunuto z \'Sklad 1\' do \'Auto Lojza\'.', '2025-10-09 12:57:19');
INSERT INTO `inventory_audit_logs` VALUES ('73', '10', '1', '1', 'picking_fulfilled', 'Splněn požadavek #16: 3 ks přesunuto z \'Sklad 1\' do \'Auto Lojza\'.', '2025-10-09 13:00:42');
INSERT INTO `inventory_audit_logs` VALUES ('74', '1', '1', '1', 'location_transferred', 'Přesunuto 14 ks z \'Auto Lojza\' na \'Sklad 1\'.', '2025-10-09 13:04:16');
INSERT INTO `inventory_audit_logs` VALUES ('75', '10', '1', '1', 'location_transferred', 'Přesunuto 5 ks z \'Auto Lojza\' na \'Sklad 1\'.', '2025-10-09 13:04:30');
INSERT INTO `inventory_audit_logs` VALUES ('76', '1', '1', '1', 'location_placed', 'Naskladněno 1 ks na lokaci \'Zbyňa auto\'.', '2025-10-09 13:08:57');
INSERT INTO `inventory_audit_logs` VALUES ('77', '1', '1', '1', 'location_transferred', 'Přesunuto 1 ks z \'Sklad 1\' na \'Auto Lojza\'.', '2025-10-09 13:09:20');

-- ----------------------------
-- Table structure for inventory_categories
-- ----------------------------
DROP TABLE IF EXISTS `inventory_categories`;
CREATE TABLE `inventory_categories` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `company_id` int(11) NOT NULL,
  `parent_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_category_company_name_parent` (`company_id`,`name`,`parent_id`),
  KEY `parent_id` (`parent_id`),
  KEY `ix_inventory_categories_company_id` (`company_id`),
  CONSTRAINT `inventory_categories_ibfk_1` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  CONSTRAINT `inventory_categories_ibfk_2` FOREIGN KEY (`parent_id`) REFERENCES `inventory_categories` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=25 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Records of inventory_categories
-- ----------------------------
INSERT INTO `inventory_categories` VALUES ('15', 'ANALOG', '1', '4');
INSERT INTO `inventory_categories` VALUES ('8', 'AUDIO', '1', '6');
INSERT INTO `inventory_categories` VALUES ('23', 'AXIS', '1', '14');
INSERT INTO `inventory_categories` VALUES ('11', 'BEZDRÁT', '1', '6');
INSERT INTO `inventory_categories` VALUES ('4', 'CCTV', '1', '1');
INSERT INTO `inventory_categories` VALUES ('6', 'ČIDLA', '1', '3');
INSERT INTO `inventory_categories` VALUES ('21', 'DAHUA', '1', '14');
INSERT INTO `inventory_categories` VALUES ('18', 'DAHUA', '1', '15');
INSERT INTO `inventory_categories` VALUES ('13', 'DUAL', '1', '7');
INSERT INTO `inventory_categories` VALUES ('5', 'EKV', '1', '1');
INSERT INTO `inventory_categories` VALUES ('20', 'HIKVISION', '1', '14');
INSERT INTO `inventory_categories` VALUES ('17', 'HIKVISION', '1', '15');
INSERT INTO `inventory_categories` VALUES ('14', 'IP', '1', '4');
INSERT INTO `inventory_categories` VALUES ('24', 'JABLOTRON', '1', '6');
INSERT INTO `inventory_categories` VALUES ('9', 'MG', '1', '6');
INSERT INTO `inventory_categories` VALUES ('12', 'PIR', '1', '7');
INSERT INTO `inventory_categories` VALUES ('7', 'POHYB', '1', '6');
INSERT INTO `inventory_categories` VALUES ('3', 'PZTS', '1', '1');
INSERT INTO `inventory_categories` VALUES ('19', 'RŮZNÉ', '1', '15');
INSERT INTO `inventory_categories` VALUES ('1', 'Slaboproud', '1', null);
INSERT INTO `inventory_categories` VALUES ('10', 'TL', '1', '6');
INSERT INTO `inventory_categories` VALUES ('22', 'WISENET', '1', '14');
INSERT INTO `inventory_categories` VALUES ('16', 'WISENET', '1', '15');

-- ----------------------------
-- Table structure for inventory_items
-- ----------------------------
DROP TABLE IF EXISTS `inventory_items`;
CREATE TABLE `inventory_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `company_id` int(11) NOT NULL,
  `category_id` int(11) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `sku` varchar(100) NOT NULL,
  `ean` varchar(13) DEFAULT NULL,
  `image_url` varchar(512) DEFAULT NULL,
  `price` float DEFAULT NULL,
  `vat_rate` float DEFAULT NULL,
  `description` text DEFAULT NULL,
  `is_monitored_for_stock` tinyint(1) NOT NULL DEFAULT 0,
  `low_stock_threshold` int(11) DEFAULT NULL,
  `low_stock_alert_sent` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL,
  `updated_at` timestamp NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_inventory_item_company_sku` (`company_id`,`sku`),
  KEY `ix_inventory_items_ean` (`ean`),
  KEY `ix_inventory_items_is_monitored_for_stock` (`is_monitored_for_stock`),
  KEY `ix_inventory_items_category_id` (`category_id`),
  KEY `ix_inventory_items_company_id` (`company_id`),
  KEY `ix_inventory_items_sku` (`sku`),
  CONSTRAINT `inventory_items_ibfk_1` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  CONSTRAINT `inventory_items_ibfk_2` FOREIGN KEY (`category_id`) REFERENCES `inventory_categories` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Records of inventory_items
-- ----------------------------
INSERT INTO `inventory_items` VALUES ('1', '1', '13', 'A20', '5678', '', null, '1333', '21', 'sss', '0', null, '0', '2025-10-09 08:04:06', '2025-10-09 12:34:06');
INSERT INTO `inventory_items` VALUES ('2', '2', null, 'Monitorable Item', 'MON-1759998290', null, null, '500', null, null, '0', null, '0', '2025-10-09 08:24:51', '2025-10-09 08:24:51');
INSERT INTO `inventory_items` VALUES ('3', '4', null, 'Čidlo A', 'CIDLO-A-1760003568', null, null, '150', null, null, '0', null, '0', '2025-10-09 09:52:50', '2025-10-09 09:52:50');
INSERT INTO `inventory_items` VALUES ('4', '4', null, 'Kabel B', 'KABEL-B-1760003568', null, null, '25', null, null, '0', null, '0', '2025-10-09 09:52:50', '2025-10-09 09:52:50');
INSERT INTO `inventory_items` VALUES ('5', '5', null, 'Čidlo A', 'CIDLO-A-1760003614', null, null, '150', null, null, '0', null, '0', '2025-10-09 09:53:35', '2025-10-09 09:53:35');
INSERT INTO `inventory_items` VALUES ('6', '5', null, 'Kabel B', 'KABEL-B-1760003614', null, null, '25', null, null, '0', null, '0', '2025-10-09 09:53:35', '2025-10-09 09:53:35');
INSERT INTO `inventory_items` VALUES ('7', '6', null, 'Čidlo A', 'CIDLO-A-1760003658', null, null, '150', null, null, '0', null, '0', '2025-10-09 09:54:19', '2025-10-09 09:54:19');
INSERT INTO `inventory_items` VALUES ('8', '6', null, 'Kabel B', 'KABEL-B-1760003658', null, null, '25', null, null, '0', null, '0', '2025-10-09 09:54:19', '2025-10-09 09:54:19');
INSERT INTO `inventory_items` VALUES ('9', '6', null, 'Nová svorka, 5mm', 'SVORKA-C-1760003658', null, null, '5', null, null, '0', null, '0', '2025-10-09 09:54:19', '2025-10-09 09:54:19');
INSERT INTO `inventory_items` VALUES ('10', '1', '8', 'AD800AM', 'DHJ7897', '', null, '980', '21', '', '0', null, '0', '2025-10-09 10:14:11', '2025-10-09 12:34:11');
INSERT INTO `inventory_items` VALUES ('11', '7', null, 'Čidlo A', 'CIDLO-A-1760011794', null, null, '150', null, null, '0', null, '0', '2025-10-09 12:09:55', '2025-10-09 12:09:55');
INSERT INTO `inventory_items` VALUES ('12', '7', null, 'Kabel B', 'KABEL-B-1760011794', null, null, '25', null, null, '0', null, '0', '2025-10-09 12:09:55', '2025-10-09 12:09:55');
INSERT INTO `inventory_items` VALUES ('13', '7', null, 'Nová svorka, 5mm', 'SVORKA-C-1760011794', null, null, '5', null, null, '0', null, '0', '2025-10-09 12:09:55', '2025-10-09 12:09:55');

-- ----------------------------
-- Table structure for invites
-- ----------------------------
DROP TABLE IF EXISTS `invites`;
CREATE TABLE `invites` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `company_id` int(11) NOT NULL,
  `email` varchar(255) NOT NULL,
  `role` enum('owner','admin','member') NOT NULL,
  `token` varchar(255) NOT NULL,
  `expires_at` timestamp NOT NULL,
  `accepted_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_invite_company_email` (`company_id`,`email`),
  UNIQUE KEY `ix_invites_token` (`token`),
  KEY `ix_invites_company_id` (`company_id`),
  KEY `ix_invites_email` (`email`),
  CONSTRAINT `invites_ibfk_1` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Records of invites
-- ----------------------------
INSERT INTO `invites` VALUES ('1', '2', 'test.employee.1759998290@example.com', 'member', 'f6yigzWOB3cbTbO2bKGzLIjy3RIqEQagWy1mTWYHx-c', '2025-10-16 08:24:50', '2025-10-09 08:24:50', '2025-10-09 08:24:50');

-- ----------------------------
-- Table structure for item_location_stock
-- ----------------------------
DROP TABLE IF EXISTS `item_location_stock`;
CREATE TABLE `item_location_stock` (
  `inventory_item_id` int(11) NOT NULL,
  `location_id` int(11) NOT NULL,
  `quantity` int(11) NOT NULL,
  PRIMARY KEY (`inventory_item_id`,`location_id`),
  KEY `location_id` (`location_id`),
  CONSTRAINT `item_location_stock_ibfk_1` FOREIGN KEY (`inventory_item_id`) REFERENCES `inventory_items` (`id`) ON DELETE CASCADE,
  CONSTRAINT `item_location_stock_ibfk_2` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Records of item_location_stock
-- ----------------------------
INSERT INTO `item_location_stock` VALUES ('1', '1', '22');
INSERT INTO `item_location_stock` VALUES ('1', '2', '1');
INSERT INTO `item_location_stock` VALUES ('1', '14', '1');
INSERT INTO `item_location_stock` VALUES ('2', '3', '9');
INSERT INTO `item_location_stock` VALUES ('3', '6', '45');
INSERT INTO `item_location_stock` VALUES ('4', '6', '100');
INSERT INTO `item_location_stock` VALUES ('5', '8', '45');
INSERT INTO `item_location_stock` VALUES ('6', '8', '100');
INSERT INTO `item_location_stock` VALUES ('7', '10', '35');
INSERT INTO `item_location_stock` VALUES ('7', '11', '10');
INSERT INTO `item_location_stock` VALUES ('8', '10', '115');
INSERT INTO `item_location_stock` VALUES ('9', '10', '15');
INSERT INTO `item_location_stock` VALUES ('9', '11', '5');
INSERT INTO `item_location_stock` VALUES ('10', '1', '16');
INSERT INTO `item_location_stock` VALUES ('10', '2', '0');
INSERT INTO `item_location_stock` VALUES ('11', '12', '35');
INSERT INTO `item_location_stock` VALUES ('11', '13', '10');
INSERT INTO `item_location_stock` VALUES ('12', '12', '115');
INSERT INTO `item_location_stock` VALUES ('13', '12', '15');
INSERT INTO `item_location_stock` VALUES ('13', '13', '5');

-- ----------------------------
-- Table structure for locations
-- ----------------------------
DROP TABLE IF EXISTS `locations`;
CREATE TABLE `locations` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `company_id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_location_company_name` (`company_id`,`name`),
  KEY `ix_locations_company_id` (`company_id`),
  CONSTRAINT `locations_ibfk_1` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Records of locations
-- ----------------------------
INSERT INTO `locations` VALUES ('1', '1', 'Sklad 1', '');
INSERT INTO `locations` VALUES ('2', '1', 'Auto Lojza', '');
INSERT INTO `locations` VALUES ('3', '2', 'Main Warehouse', null);
INSERT INTO `locations` VALUES ('4', '3', 'Hlavní sklad', null);
INSERT INTO `locations` VALUES ('5', '3', 'Vozidlo Technika', null);
INSERT INTO `locations` VALUES ('6', '4', 'Hlavní sklad', null);
INSERT INTO `locations` VALUES ('7', '4', 'Vozidlo Technika', null);
INSERT INTO `locations` VALUES ('8', '5', 'Hlavní sklad', null);
INSERT INTO `locations` VALUES ('9', '5', 'Vozidlo Technika', null);
INSERT INTO `locations` VALUES ('10', '6', 'Hlavní sklad', null);
INSERT INTO `locations` VALUES ('11', '6', 'Vozidlo Technika', null);
INSERT INTO `locations` VALUES ('12', '7', 'Hlavní sklad', null);
INSERT INTO `locations` VALUES ('13', '7', 'Vozidlo Technika', null);
INSERT INTO `locations` VALUES ('14', '1', 'Zbyňa auto', 'To co má v tom kufru na kolečkách');

-- ----------------------------
-- Table structure for location_permissions
-- ----------------------------
DROP TABLE IF EXISTS `location_permissions`;
CREATE TABLE `location_permissions` (
  `location_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  PRIMARY KEY (`location_id`,`user_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `location_permissions_ibfk_1` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `location_permissions_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Records of location_permissions
-- ----------------------------
INSERT INTO `location_permissions` VALUES ('2', '2');
INSERT INTO `location_permissions` VALUES ('14', '2');

-- ----------------------------
-- Table structure for memberships
-- ----------------------------
DROP TABLE IF EXISTS `memberships`;
CREATE TABLE `memberships` (
  `user_id` int(11) NOT NULL,
  `company_id` int(11) NOT NULL,
  `role` enum('owner','admin','member') NOT NULL,
  `created_at` timestamp NOT NULL,
  PRIMARY KEY (`user_id`,`company_id`),
  KEY `company_id` (`company_id`),
  CONSTRAINT `memberships_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `memberships_ibfk_2` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Records of memberships
-- ----------------------------
INSERT INTO `memberships` VALUES ('1', '1', 'owner', '2025-10-09 07:59:30');
INSERT INTO `memberships` VALUES ('2', '1', 'member', '2025-10-09 08:03:14');
INSERT INTO `memberships` VALUES ('3', '2', 'owner', '2025-10-09 08:24:50');
INSERT INTO `memberships` VALUES ('4', '2', 'member', '2025-10-09 08:24:50');
INSERT INTO `memberships` VALUES ('5', '3', 'owner', '2025-10-09 09:51:06');
INSERT INTO `memberships` VALUES ('6', '3', 'member', '2025-10-09 09:51:06');
INSERT INTO `memberships` VALUES ('7', '4', 'owner', '2025-10-09 09:52:48');
INSERT INTO `memberships` VALUES ('8', '4', 'member', '2025-10-09 09:52:50');
INSERT INTO `memberships` VALUES ('9', '5', 'owner', '2025-10-09 09:53:34');
INSERT INTO `memberships` VALUES ('10', '5', 'member', '2025-10-09 09:53:34');
INSERT INTO `memberships` VALUES ('11', '6', 'owner', '2025-10-09 09:54:18');
INSERT INTO `memberships` VALUES ('12', '6', 'member', '2025-10-09 09:54:19');
INSERT INTO `memberships` VALUES ('13', '7', 'owner', '2025-10-09 12:09:55');
INSERT INTO `memberships` VALUES ('14', '7', 'member', '2025-10-09 12:09:55');

-- ----------------------------
-- Table structure for notification_triggers
-- ----------------------------
DROP TABLE IF EXISTS `notification_triggers`;
CREATE TABLE `notification_triggers` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `company_id` int(11) NOT NULL,
  `is_active` tinyint(1) NOT NULL,
  `trigger_type` enum('WORK_ORDER_BUDGET','INVENTORY_LOW_STOCK') NOT NULL,
  `condition` enum('PERCENTAGE_REACHED','QUANTITY_BELOW') NOT NULL,
  `threshold_value` float NOT NULL,
  `recipient_emails` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`recipient_emails`)),
  `created_at` timestamp NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_company_trigger_type` (`company_id`,`trigger_type`),
  KEY `ix_notification_triggers_company_id` (`company_id`),
  CONSTRAINT `notification_triggers_ibfk_1` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Records of notification_triggers
-- ----------------------------

-- ----------------------------
-- Table structure for picking_orders
-- ----------------------------
DROP TABLE IF EXISTS `picking_orders`;
CREATE TABLE `picking_orders` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `company_id` int(11) NOT NULL,
  `requester_id` int(11) NOT NULL,
  `source_location_id` int(11) DEFAULT NULL,
  `destination_location_id` int(11) NOT NULL,
  `status` enum('NEW','IN_PROGRESS','COMPLETED','CANCELLED') NOT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL,
  `completed_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_picking_orders_requester_id` (`requester_id`),
  KEY `ix_picking_orders_status` (`status`),
  KEY `ix_picking_orders_destination_location_id` (`destination_location_id`),
  KEY `ix_picking_orders_created_at` (`created_at`),
  KEY `ix_picking_orders_company_id` (`company_id`),
  KEY `ix_picking_orders_source_location_id` (`source_location_id`),
  CONSTRAINT `picking_orders_ibfk_1` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  CONSTRAINT `picking_orders_ibfk_2` FOREIGN KEY (`requester_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `picking_orders_ibfk_3` FOREIGN KEY (`source_location_id`) REFERENCES `locations` (`id`),
  CONSTRAINT `picking_orders_ibfk_4` FOREIGN KEY (`destination_location_id`) REFERENCES `locations` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Records of picking_orders
-- ----------------------------
INSERT INTO `picking_orders` VALUES ('13', '1', '2', null, '2', 'COMPLETED', 'malo mam', '2025-10-09 12:35:09', '2025-10-09 12:35:41');
INSERT INTO `picking_orders` VALUES ('14', '1', '1', null, '1', 'COMPLETED', 'sws', '2025-10-09 12:50:18', '2025-10-09 12:55:20');
INSERT INTO `picking_orders` VALUES ('15', '1', '1', null, '2', 'COMPLETED', 'ss', '2025-10-09 12:57:02', '2025-10-09 12:57:19');
INSERT INTO `picking_orders` VALUES ('16', '1', '1', null, '2', 'COMPLETED', 'tdt', '2025-10-09 12:57:52', '2025-10-09 13:00:42');

-- ----------------------------
-- Table structure for picking_order_items
-- ----------------------------
DROP TABLE IF EXISTS `picking_order_items`;
CREATE TABLE `picking_order_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `picking_order_id` int(11) NOT NULL,
  `inventory_item_id` int(11) DEFAULT NULL,
  `requested_item_description` varchar(512) DEFAULT NULL,
  `requested_quantity` int(11) NOT NULL,
  `picked_quantity` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `inventory_item_id` (`inventory_item_id`),
  KEY `ix_picking_order_items_picking_order_id` (`picking_order_id`),
  CONSTRAINT `picking_order_items_ibfk_1` FOREIGN KEY (`picking_order_id`) REFERENCES `picking_orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `picking_order_items_ibfk_2` FOREIGN KEY (`inventory_item_id`) REFERENCES `inventory_items` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Records of picking_order_items
-- ----------------------------
INSERT INTO `picking_order_items` VALUES ('17', '13', '1', null, '6', '6');
INSERT INTO `picking_order_items` VALUES ('18', '14', '1', null, '1', '1');
INSERT INTO `picking_order_items` VALUES ('19', '15', '1', null, '2', '2');
INSERT INTO `picking_order_items` VALUES ('20', '16', '10', null, '3', '3');

-- ----------------------------
-- Table structure for tasks
-- ----------------------------
DROP TABLE IF EXISTS `tasks`;
CREATE TABLE `tasks` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `work_order_id` int(11) NOT NULL,
  `assignee_id` int(11) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `status` varchar(50) NOT NULL,
  `created_at` timestamp NOT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_tasks_work_order_id` (`work_order_id`),
  KEY `ix_tasks_status` (`status`),
  KEY `ix_tasks_assignee_id` (`assignee_id`),
  CONSTRAINT `tasks_ibfk_1` FOREIGN KEY (`work_order_id`) REFERENCES `work_orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `tasks_ibfk_2` FOREIGN KEY (`assignee_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Records of tasks
-- ----------------------------
INSERT INTO `tasks` VALUES ('1', '1', '2', 'Zámek', null, 'billed', '2025-10-09 08:14:24');
INSERT INTO `tasks` VALUES ('2', '2', '4', 'Budget Test Task', null, 'todo', '2025-10-09 08:24:51');
INSERT INTO `tasks` VALUES ('3', '1', '1', 'Výměna čidla', null, 'in_progress', '2025-10-09 08:56:03');
INSERT INTO `tasks` VALUES ('4', '3', null, 'Direct Assign Task', null, 'todo', '2025-10-09 09:54:19');
INSERT INTO `tasks` VALUES ('5', '1', '2', 'ssss', null, 'todo', '2025-10-09 10:58:35');
INSERT INTO `tasks` VALUES ('6', '4', null, 'Direct Assign Task', null, 'todo', '2025-10-09 12:09:56');

-- ----------------------------
-- Table structure for time_logs
-- ----------------------------
DROP TABLE IF EXISTS `time_logs`;
CREATE TABLE `time_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `company_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `entry_type` enum('WORK','VACATION','SICK_DAY','DOCTOR','UNPAID_LEAVE') NOT NULL,
  `task_id` int(11) DEFAULT NULL,
  `work_type_id` int(11) DEFAULT NULL,
  `start_time` timestamp NOT NULL,
  `end_time` timestamp NOT NULL,
  `break_duration_minutes` int(11) NOT NULL,
  `is_overtime` tinyint(1) NOT NULL,
  `notes` text DEFAULT NULL,
  `status` enum('pending','approved','rejected') NOT NULL,
  `created_at` timestamp NOT NULL,
  PRIMARY KEY (`id`),
  KEY `work_type_id` (`work_type_id`),
  KEY `ix_time_logs_start_time` (`start_time`),
  KEY `ix_time_logs_user_id` (`user_id`),
  KEY `ix_time_logs_task_id` (`task_id`),
  KEY `ix_time_logs_status` (`status`),
  KEY `ix_time_logs_company_id` (`company_id`),
  CONSTRAINT `time_logs_ibfk_1` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  CONSTRAINT `time_logs_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `time_logs_ibfk_3` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`) ON DELETE CASCADE,
  CONSTRAINT `time_logs_ibfk_4` FOREIGN KEY (`work_type_id`) REFERENCES `work_types` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Records of time_logs
-- ----------------------------
INSERT INTO `time_logs` VALUES ('3', '2', '4', 'WORK', '2', '2', '2025-10-09 08:00:00', '2025-10-09 16:30:00', '0', '0', null, 'pending', '2025-10-09 08:24:51');
INSERT INTO `time_logs` VALUES ('4', '1', '1', 'WORK', '3', '1', '2025-10-09 08:00:00', '2025-10-09 16:30:00', '0', '0', null, 'pending', '2025-10-09 08:56:03');
INSERT INTO `time_logs` VALUES ('5', '1', '2', 'WORK', '5', '1', '2025-10-10 08:00:00', '2025-10-10 16:30:00', '0', '0', null, 'pending', '2025-10-09 10:58:35');
INSERT INTO `time_logs` VALUES ('7', '1', '2', 'UNPAID_LEAVE', null, null, '2025-10-09 12:00:00', '2025-10-09 12:30:00', '0', '0', 'Pauza na oběd', 'pending', '2025-10-09 12:07:36');
INSERT INTO `time_logs` VALUES ('8', '1', '2', 'WORK', '5', '1', '2025-10-09 08:00:00', '2025-10-09 12:00:00', '0', '0', null, 'pending', '2025-10-09 12:07:46');
INSERT INTO `time_logs` VALUES ('9', '1', '2', 'WORK', '5', '1', '2025-10-09 12:30:00', '2025-10-09 16:30:00', '0', '0', null, 'pending', '2025-10-09 12:07:51');

-- ----------------------------
-- Table structure for used_inventory_items
-- ----------------------------
DROP TABLE IF EXISTS `used_inventory_items`;
CREATE TABLE `used_inventory_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `task_id` int(11) NOT NULL,
  `inventory_item_id` int(11) NOT NULL,
  `quantity` int(11) NOT NULL,
  `log_date` timestamp NOT NULL,
  `from_location_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `from_location_id` (`from_location_id`),
  KEY `ix_used_inventory_items_task_id` (`task_id`),
  KEY `ix_used_inventory_items_inventory_item_id` (`inventory_item_id`),
  CONSTRAINT `used_inventory_items_ibfk_1` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`) ON DELETE CASCADE,
  CONSTRAINT `used_inventory_items_ibfk_2` FOREIGN KEY (`inventory_item_id`) REFERENCES `inventory_items` (`id`),
  CONSTRAINT `used_inventory_items_ibfk_3` FOREIGN KEY (`from_location_id`) REFERENCES `locations` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Records of used_inventory_items
-- ----------------------------
INSERT INTO `used_inventory_items` VALUES ('1', '2', '2', '6', '2025-10-09 08:24:51', '3');
INSERT INTO `used_inventory_items` VALUES ('5', '3', '1', '1', '2025-10-09 08:56:14', null);
INSERT INTO `used_inventory_items` VALUES ('9', '1', '1', '1', '2025-10-09 09:41:31', '2');
INSERT INTO `used_inventory_items` VALUES ('11', '5', '10', '1', '2025-10-09 12:08:05', '2');

-- ----------------------------
-- Table structure for users
-- ----------------------------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `is_active` tinyint(1) NOT NULL,
  `created_at` timestamp NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ix_users_email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Records of users
-- ----------------------------
INSERT INTO `users` VALUES ('1', 'admin@admin.com', '$2b$12$.sKDDRSNg4rHNucIMW34F.3d7KtfvTAYXXYgR2stRRSG2M0S1L7am', '1', '2025-10-09 07:59:30');
INSERT INTO `users` VALUES ('2', 'spoiledmousecz@gmail.com', '$2b$12$.sKDDRSNg4rHNucIMW34F.3d7KtfvTAYXXYgR2stRRSG2M0S1L7am', '1', '2025-10-09 08:03:14');
INSERT INTO `users` VALUES ('3', 'test.admin.1759998290@example.com', '$2b$12$ah9lGuL94EMY9MMxFqSBOubxublt7kLQ7jZl.sgKYkWi9FAmf55xi', '1', '2025-10-09 08:24:50');
INSERT INTO `users` VALUES ('4', 'test.employee.1759998290@example.com', '$2b$12$MLKBMp0JmNTeEAeXkfcKBOCRYuPNCrJKiU2ja7p0pu8nbPinq4dmq', '1', '2025-10-09 08:24:50');
INSERT INTO `users` VALUES ('5', 'test.admin.1760003466@example.com', '$2b$12$US..ZpyOpir6.f9pLnoEF.x99NGpgL9Hq9ww4F5IibwDq8B30sGdu', '1', '2025-10-09 09:51:06');
INSERT INTO `users` VALUES ('6', 'test.employee.1760003466@example.com', '$2b$12$R1iPoYPyUXFEFkCVxoCGzuFgmX4vl5MQPcfcqouMasXuGIQVhWYea', '1', '2025-10-09 09:51:06');
INSERT INTO `users` VALUES ('7', 'test.admin.1760003568@example.com', '$2b$12$vWZpK7I4qXiKNciIz/3sJ...XbCE8VfCeNOsn2I3MYCUkN8QhJGjm', '1', '2025-10-09 09:52:48');
INSERT INTO `users` VALUES ('8', 'test.employee.1760003568@example.com', '$2b$12$qgm37nQpiqLDrCWVKU0HBukF2iO.OtiDo6olAmpgswgLneL2Aya4e', '1', '2025-10-09 09:52:50');
INSERT INTO `users` VALUES ('9', 'test.admin.1760003614@example.com', '$2b$12$4zt1oeCYWHSZPUu.GpCXVOVvdviVtUSLuhzTooRqOSNBMoxmRJpDG', '1', '2025-10-09 09:53:34');
INSERT INTO `users` VALUES ('10', 'test.employee.1760003614@example.com', '$2b$12$QBVhCZdF0H7qKVivtY17LuOkgEO4uJnKQLFt/3mN4Ai.rojVDGjSC', '1', '2025-10-09 09:53:34');
INSERT INTO `users` VALUES ('11', 'test.admin.1760003658@example.com', '$2b$12$RzWeVEqbuCX.HaC6Ski7fe3sYcFsMXhoTg4DXhfR9VkrC9Cq/rcTS', '1', '2025-10-09 09:54:18');
INSERT INTO `users` VALUES ('12', 'test.employee.1760003658@example.com', '$2b$12$964TVT78qaL5e/rraAPTiOdFadseKWUb79wJRbmHRO0E/UmL6AcvC', '1', '2025-10-09 09:54:19');
INSERT INTO `users` VALUES ('13', 'test.admin.1760011794@example.com', '$2b$12$GsVdzJXWxVtUodoOTgy.Je5sgRrgY4aLw6GdK0QQbpLDYkP0thxRy', '1', '2025-10-09 12:09:55');
INSERT INTO `users` VALUES ('14', 'test.employee.1760011794@example.com', '$2b$12$lLG/s6g0ZDnNTfbl/aNoOOeIxQ/uZOXgMqmE1td4bHJGUqm4f2oNO', '1', '2025-10-09 12:09:55');

-- ----------------------------
-- Table structure for work_orders
-- ----------------------------
DROP TABLE IF EXISTS `work_orders`;
CREATE TABLE `work_orders` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `company_id` int(11) NOT NULL,
  `client_id` int(11) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `status` varchar(50) NOT NULL,
  `budget_hours` float DEFAULT NULL,
  `created_at` timestamp NOT NULL,
  `budget_alert_sent` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `ix_work_orders_company_id` (`company_id`),
  KEY `ix_work_orders_client_id` (`client_id`),
  KEY `ix_work_orders_status` (`status`),
  CONSTRAINT `work_orders_ibfk_1` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  CONSTRAINT `work_orders_ibfk_2` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Records of work_orders
-- ----------------------------
INSERT INTO `work_orders` VALUES ('1', '1', '1', 'ČSOB Hroznova', '', 'new', null, '2025-10-09 08:13:44', '0');
INSERT INTO `work_orders` VALUES ('2', '2', '2', 'Budget Test Work Order', null, 'new', '10', '2025-10-09 08:24:51', '0');
INSERT INTO `work_orders` VALUES ('3', '6', '3', 'Direct Assign Work Order', null, 'new', null, '2025-10-09 09:54:19', '0');
INSERT INTO `work_orders` VALUES ('4', '7', '4', 'Direct Assign Work Order', null, 'new', null, '2025-10-09 12:09:56', '0');

-- ----------------------------
-- Table structure for work_types
-- ----------------------------
DROP TABLE IF EXISTS `work_types`;
CREATE TABLE `work_types` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `company_id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `rate` float NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_work_type_company_name` (`company_id`,`name`),
  KEY `ix_work_types_company_id` (`company_id`),
  CONSTRAINT `work_types_ibfk_1` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Records of work_types
-- ----------------------------
INSERT INTO `work_types` VALUES ('1', '1', 'Servis ČSOB', '600');
INSERT INTO `work_types` VALUES ('2', '2', 'Test Work', '1000');
SET FOREIGN_KEY_CHECKS=1;
