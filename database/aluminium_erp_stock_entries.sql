-- MySQL dump 10.13  Distrib 8.0.43, for Win64 (x86_64)
--
-- Host: localhost    Database: aluminium_erp
-- ------------------------------------------------------
-- Server version	8.0.43

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `stock_entries`
--

DROP TABLE IF EXISTS `stock_entries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stock_entries` (
  `id` int NOT NULL AUTO_INCREMENT,
  `entry_no` varchar(50) NOT NULL,
  `entry_date` datetime NOT NULL,
  `entry_type` enum('Material Receipt','Material Issue','Material Transfer','Manufacturing Return','Repack','Scrap Entry') NOT NULL,
  `from_warehouse_id` int DEFAULT NULL,
  `to_warehouse_id` int DEFAULT NULL,
  `purpose` varchar(255) DEFAULT NULL,
  `reference_doctype` varchar(100) DEFAULT NULL,
  `reference_name` varchar(100) DEFAULT NULL,
  `status` enum('Draft','Submitted','Cancelled') DEFAULT 'Draft',
  `total_qty` decimal(12,2) DEFAULT '0.00',
  `total_value` decimal(16,2) DEFAULT '0.00',
  `remarks` text,
  `created_by` int NOT NULL,
  `updated_by` int DEFAULT NULL,
  `approved_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `submitted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `entry_no` (`entry_no`),
  KEY `idx_entry_no` (`entry_no`),
  KEY `idx_entry_date` (`entry_date`),
  KEY `idx_status` (`status`),
  KEY `idx_entry_type` (`entry_type`)
) ENGINE=InnoDB AUTO_INCREMENT=39 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stock_entries`
--

LOCK TABLES `stock_entries` WRITE;
/*!40000 ALTER TABLE `stock_entries` DISABLE KEYS */;
INSERT INTO `stock_entries` VALUES (8,'MA-202511-000001','2025-11-22 00:00:00','Material Receipt',NULL,3,'GRN: GRN-1763799922558','GRN','GRN-1763799922558','Draft',10.00,1000.00,'',1,NULL,NULL,'2025-11-22 17:51:45','2025-11-22 17:51:45',NULL),(9,'MA-202511-000002','2025-11-22 00:00:00','Material Receipt',NULL,3,'GRN: GRN-1763799922558','GRN','GRN-1763799922558','Draft',10.00,1000.00,'',1,NULL,NULL,'2025-11-22 17:52:23','2025-11-22 17:52:23',NULL),(19,'MA-202511-000003','2025-11-24 00:00:00','Material Receipt',NULL,3,'GRN: GRN-1763799922558','GRN','GRN-1763799922558','Draft',10.00,1000.00,'',1,NULL,NULL,'2025-11-24 04:55:02','2025-11-24 04:55:02',NULL),(20,'MA-202511-000004','2025-11-24 10:54:11','Material Receipt',NULL,2,'GRN Approved - GRN-1763799249557','GRN Request','GRN-1763799249557','Draft',10.00,1000.00,'Auto-generated from GRN Request GRN-1763799249557 - Inventory Approved',1,NULL,NULL,'2025-11-24 05:24:10','2025-11-24 05:24:10',NULL),(21,'MA-202511-000005','2025-11-24 00:00:00','Material Receipt',NULL,3,'GRN: GRN-1763799922558','GRN','GRN-1763799922558','Draft',10.00,1000.00,'',1,NULL,NULL,'2025-11-24 05:24:29','2025-11-24 05:24:29',NULL),(22,'MA-202511-000006','2025-11-24 00:00:00','Material Receipt',NULL,3,'GRN: GRN-1763799922558','GRN','GRN-1763799922558','Draft',10.00,1000.00,'',1,NULL,NULL,'2025-11-24 06:11:48','2025-11-24 06:11:48',NULL),(23,'MA-202511-000007','2025-11-24 00:00:00','Material Receipt',NULL,3,'GRN: GRN-1763799922558','GRN','GRN-1763799922558','Draft',10.00,1000.00,'',1,NULL,NULL,'2025-11-24 06:18:39','2025-11-24 06:18:39',NULL),(24,'MA-202511-000008','2025-11-24 00:00:00','Material Receipt',NULL,3,'GRN: GRN-1763799922558','GRN','GRN-1763799922558','Draft',10.00,1000.00,'',1,NULL,NULL,'2025-11-24 06:24:24','2025-11-24 06:24:24',NULL),(25,'MA-202511-000009','2025-11-24 00:00:00','Material Receipt',NULL,3,'GRN: GRN-1763799249557','GRN','GRN-1763799249557','Draft',10.00,1000.00,'',1,NULL,NULL,'2025-11-24 06:24:46','2025-11-24 06:24:46',NULL),(26,'MA-202511-000010','2025-11-24 00:00:00','Material Receipt',NULL,3,'GRN: GRN-1763799922558','GRN','GRN-1763799922558','Draft',10.00,1000.00,'',1,NULL,NULL,'2025-11-24 06:25:04','2025-11-24 06:25:04',NULL),(27,'MA-202511-000011','2025-11-24 00:00:00','Material Issue',3,2,'sjdjadhjhsdj','production','adasdsd','Draft',1.00,1000.00,'',1,NULL,NULL,'2025-11-24 06:26:02','2025-11-24 06:26:02',NULL),(37,'MA-202511-000012','2025-11-24 00:00:00','Material Receipt',2,3,'GRN: GRN-1763799922558','GRN','GRN-1763799922558','Submitted',10.00,1000.00,'',1,NULL,1,'2025-11-24 07:43:36','2025-11-24 07:43:36','2025-11-24 13:13:36'),(38,'MA-202511-000013','2025-11-24 00:00:00','Material Receipt',2,3,'GRN: GRN-1763799249557','GRN','GRN-1763799249557','Submitted',10.00,1000.00,'',1,NULL,1,'2025-11-24 07:52:56','2025-11-24 07:52:56','2025-11-24 13:22:56');
/*!40000 ALTER TABLE `stock_entries` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-12-03 17:37:45
