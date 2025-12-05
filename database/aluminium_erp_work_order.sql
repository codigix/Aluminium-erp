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
-- Table structure for table `work_order`
--

DROP TABLE IF EXISTS `work_order`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `work_order` (
  `wo_id` varchar(50) NOT NULL,
  `sales_order_id` varchar(50) DEFAULT NULL,
  `item_code` varchar(100) DEFAULT NULL,
  `quantity` int DEFAULT NULL,
  `unit_cost` decimal(15,2) DEFAULT NULL,
  `total_cost` decimal(15,2) DEFAULT NULL,
  `required_date` date DEFAULT NULL,
  `status` enum('draft','approved','in_progress','completed','cancelled') DEFAULT 'draft',
  `assigned_to_id` varchar(50) DEFAULT NULL,
  `priority` enum('low','medium','high','critical') DEFAULT 'medium',
  `notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `bom_no` varchar(50) DEFAULT NULL,
  `planned_start_date` datetime DEFAULT NULL,
  `planned_end_date` datetime DEFAULT NULL,
  `actual_start_date` datetime DEFAULT NULL,
  `actual_end_date` datetime DEFAULT NULL,
  `expected_delivery_date` date DEFAULT NULL,
  PRIMARY KEY (`wo_id`),
  KEY `idx_status` (`status`),
  KEY `idx_so_id` (`sales_order_id`),
  KEY `idx_item_code` (`item_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `work_order`
--

LOCK TABLES `work_order` WRITE;
/*!40000 ALTER TABLE `work_order` DISABLE KEYS */;
INSERT INTO `work_order` VALUES ('WO-1764321734050',NULL,'ITEM-ALUMINIUMS',10,NULL,NULL,NULL,'draft',NULL,'medium','','2025-11-28 09:22:14','2025-11-28 09:22:14','BOM-1764161170640','2025-11-29 14:51:00','2025-11-30 14:51:00','2025-11-29 14:51:00','2025-11-30 14:51:00','2025-12-06'),('WO-1764323942023',NULL,'ITEM-001',10,NULL,NULL,NULL,'draft',NULL,'high','Test work order for job card creation','2025-11-28 09:59:02','2025-11-28 09:59:02','BOM-001','2025-11-28 00:00:00','2025-12-05 00:00:00',NULL,NULL,NULL),('WO-1764323966740',NULL,'ITEM-001',10,NULL,NULL,NULL,'draft',NULL,'high','Test work order for job card creation','2025-11-28 09:59:26','2025-11-28 09:59:26','BOM-001','2025-11-28 00:00:00','2025-12-05 00:00:00',NULL,NULL,NULL),('WO-1764324002643',NULL,'ITEM-001',10,NULL,NULL,NULL,'draft',NULL,'high',NULL,'2025-11-28 10:00:02','2025-11-28 10:00:02','BOM-001','2025-01-15 00:00:00','2025-01-22 00:00:00',NULL,NULL,NULL),('WO-1764324049128',NULL,'ITEM-001',10,NULL,NULL,NULL,'draft',NULL,NULL,NULL,'2025-11-28 10:00:49','2025-11-28 10:00:49','BOM-001',NULL,NULL,NULL,NULL,NULL),('WO-1764324056592',NULL,'ITEM-001',10,NULL,NULL,NULL,'draft',NULL,NULL,NULL,'2025-11-28 10:00:56','2025-11-28 10:00:56','BOM-001',NULL,NULL,NULL,NULL,NULL),('WO-1764324210716',NULL,'ITEM-001',10,NULL,NULL,NULL,'draft',NULL,'high',NULL,'2025-11-28 10:03:30','2025-11-28 10:03:30','BOM-001','2025-01-15 00:00:00','2025-01-22 00:00:00',NULL,NULL,NULL);
/*!40000 ALTER TABLE `work_order` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-12-03 17:37:47
