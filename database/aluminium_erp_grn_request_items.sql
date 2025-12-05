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
-- Table structure for table `grn_request_items`
--

DROP TABLE IF EXISTS `grn_request_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `grn_request_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `grn_request_id` int NOT NULL,
  `item_code` varchar(100) DEFAULT NULL,
  `item_name` varchar(255) DEFAULT NULL,
  `po_qty` decimal(18,4) DEFAULT NULL,
  `received_qty` decimal(18,4) DEFAULT NULL,
  `accepted_qty` decimal(18,4) DEFAULT '0.0000',
  `rejected_qty` decimal(18,4) DEFAULT '0.0000',
  `batch_no` varchar(100) DEFAULT NULL,
  `warehouse_name` varchar(255) DEFAULT NULL,
  `item_status` enum('pending','accepted','rejected','partially_accepted') DEFAULT 'pending',
  `qc_checks` json DEFAULT NULL,
  `notes` text,
  `inspected_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `qc_status` varchar(50) DEFAULT 'pass' COMMENT 'QC Status: pass, fail, hold',
  `bin_rack` varchar(100) DEFAULT NULL COMMENT 'Warehouse bin/rack location',
  `valuation_rate` decimal(18,4) DEFAULT '0.0000' COMMENT 'Cost per unit for inventory valuation',
  PRIMARY KEY (`id`),
  KEY `idx_grn_request_id` (`grn_request_id`),
  KEY `idx_item_status` (`item_status`),
  KEY `idx_item_code` (`item_code`),
  CONSTRAINT `grn_request_items_ibfk_1` FOREIGN KEY (`grn_request_id`) REFERENCES `grn_requests` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `grn_request_items`
--

LOCK TABLES `grn_request_items` WRITE;
/*!40000 ALTER TABLE `grn_request_items` DISABLE KEYS */;
INSERT INTO `grn_request_items` VALUES (1,1,'ITEM-ALUMINIUMS','aluminium sheet',10.0000,10.0000,10.0000,0.0000,'','?','partially_accepted','{\"documentation\": true, \"quantity_check\": true, \"visual_inspection\": true, \"packaging_condition\": true}','','2025-11-21 17:45:12','2025-11-21 11:47:41','2025-11-21 12:15:28','pass',NULL,0.0000),(2,2,'ITEM-ALUMINIUMS','aluminium sheet',10.0000,10.0000,10.0000,0.0000,'','?','partially_accepted','{\"documentation\": true, \"quantity_check\": true, \"visual_inspection\": true, \"packaging_condition\": true}','','2025-11-21 17:38:19','2025-11-21 11:48:06','2025-11-21 12:08:22','pass',NULL,0.0000),(3,3,'ITEM-ALUMINIUMS','aluminium sheet',10.0000,10.0000,10.0000,0.0000,'','?','partially_accepted','{\"documentation\": true, \"quantity_check\": true, \"visual_inspection\": true, \"packaging_condition\": true}','','2025-11-21 17:23:12','2025-11-21 11:52:03','2025-11-21 11:59:50','pass',NULL,0.0000),(4,4,'ITEM-ALUMINIUMS','aluminium sheet',10.0000,10.0000,10.0000,0.0000,'','main wharehouse','partially_accepted','{\"documentation\": true, \"quantity_check\": true, \"visual_inspection\": true, \"packaging_condition\": true}','','2025-11-21 17:47:13','2025-11-21 12:16:49','2025-11-21 12:17:23','pass',NULL,0.0000),(5,5,'ITEM-ALUMINIUMS','aluminium sheet',10.0000,10.0000,10.0000,0.0000,'','main wharehouse','partially_accepted','{\"documentation\": true, \"quantity_check\": true, \"visual_inspection\": true, \"packaging_condition\": true}','','2025-11-21 17:51:32','2025-11-21 12:21:05','2025-11-21 12:21:41','pass',NULL,0.0000),(6,6,'ITEM-ALUMINIUMS','aluminium sheet',10.0000,10.0000,10.0000,0.0000,'','?','accepted',NULL,NULL,NULL,'2025-11-22 07:27:55','2025-11-22 07:27:55','pass',NULL,0.0000),(7,7,'ITEM-ALUMINIUMS','aluminium sheet',10.0000,10.0000,10.0000,0.0000,'','Gokul Nagar','accepted',NULL,NULL,NULL,'2025-11-22 08:14:09','2025-11-24 05:24:10','pass','A-001',100.0000),(8,8,'ITEM-ALUMINIUMS','aluminium sheet',10.0000,10.0000,10.0000,0.0000,'','main wharehouse','accepted',NULL,NULL,NULL,'2025-11-22 08:25:22','2025-11-22 10:53:55','pass','A-01-1',100.0000);
/*!40000 ALTER TABLE `grn_request_items` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-12-03 17:37:44
