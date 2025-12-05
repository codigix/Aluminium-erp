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
-- Table structure for table `grn_requests`
--

DROP TABLE IF EXISTS `grn_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `grn_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `grn_no` varchar(100) NOT NULL,
  `po_no` varchar(100) NOT NULL,
  `supplier_id` varchar(100) DEFAULT NULL,
  `supplier_name` varchar(255) DEFAULT NULL,
  `receipt_date` datetime DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `status` enum('pending','inspecting','awaiting_inventory_approval','approved','rejected','sent_back') DEFAULT 'pending',
  `assigned_to` int DEFAULT NULL,
  `approval_date` datetime DEFAULT NULL,
  `approved_by` int DEFAULT NULL,
  `rejection_date` datetime DEFAULT NULL,
  `rejection_reason` text,
  `total_items` int DEFAULT '0',
  `total_accepted` int DEFAULT '0',
  `total_rejected` int DEFAULT '0',
  `notes` text,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `inspection_completed_by` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `grn_no` (`grn_no`),
  KEY `idx_grn_no` (`grn_no`),
  KEY `idx_po_no` (`po_no`),
  KEY `idx_status` (`status`),
  KEY `idx_created_by` (`created_by`),
  KEY `idx_assigned_to` (`assigned_to`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `grn_requests`
--

LOCK TABLES `grn_requests` WRITE;
/*!40000 ALTER TABLE `grn_requests` DISABLE KEYS */;
INSERT INTO `grn_requests` VALUES (1,'GRN-1763725661675','PO-1763724578416','SUP-1763710276028','nitin kamble','2025-11-21 00:00:00',NULL,'2025-11-21 11:47:41','awaiting_inventory_approval',NULL,'2025-11-21 17:45:48',NULL,NULL,NULL,1,10,0,'','2025-11-22 10:16:32',NULL),(2,'GRN-1763725686266','PO-1763724578416','SUP-1763710276028','nitin kamble','2025-11-21 00:00:00',NULL,'2025-11-21 11:48:06','awaiting_inventory_approval',NULL,'2025-11-21 17:38:32',NULL,NULL,NULL,1,10,0,'','2025-11-22 10:16:32',NULL),(3,'GRN-1763725923770','PO-1763724578416','SUP-1763710276028','nitin kamble','2025-11-21 00:00:00',NULL,'2025-11-21 11:52:03','awaiting_inventory_approval',NULL,'2025-11-21 17:30:01',NULL,NULL,NULL,1,10,0,'','2025-11-22 10:16:32',NULL),(4,'GRN-1763727409645','PO-1763724578416','SUP-1763710276028','nitin kamble','2025-11-21 00:00:00',NULL,'2025-11-21 12:16:49','awaiting_inventory_approval',NULL,'2025-11-21 17:47:29',NULL,NULL,NULL,1,10,0,'','2025-11-22 10:16:32',NULL),(5,'GRN-1763727664976','PO-1763722318177','SUP-1763710276028','nitin kamble','2025-11-21 00:00:00',1,'2025-11-21 12:21:05','awaiting_inventory_approval',1,'2025-11-21 17:51:46',1,NULL,NULL,1,10,0,'','2025-11-22 10:16:32',1),(6,'GRN-1763796475654','PO-1763724578416','SUP-1763710276028','nitin kamble','2025-11-22 00:00:00',1,'2025-11-22 07:27:55','awaiting_inventory_approval',NULL,'2025-11-22 12:58:29',1,NULL,NULL,1,10,0,'','2025-11-22 10:16:32',1),(7,'GRN-1763799249557','PO-1763722318177','SUP-1763710276028','nitin kamble','2025-11-22 00:00:00',1,'2025-11-22 08:14:09','approved',NULL,'2025-11-24 10:54:10',1,NULL,NULL,1,10,0,'','2025-11-24 05:24:10',1),(8,'GRN-1763799922558','PO-1763724578416','SUP-1763710276028','nitin kamble','2025-11-22 00:00:00',1,'2025-11-22 08:25:22','approved',NULL,'2025-11-22 16:23:55',1,NULL,NULL,1,10,0,'','2025-11-22 10:53:55',1);
/*!40000 ALTER TABLE `grn_requests` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-12-05 14:04:50
