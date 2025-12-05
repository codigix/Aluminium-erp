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
-- Table structure for table `grn_request_logs`
--

DROP TABLE IF EXISTS `grn_request_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `grn_request_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `grn_request_id` int NOT NULL,
  `action` varchar(100) DEFAULT NULL,
  `status_from` varchar(50) DEFAULT NULL,
  `status_to` varchar(50) DEFAULT NULL,
  `reason` text,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_grn_request_id` (`grn_request_id`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `grn_request_logs_ibfk_1` FOREIGN KEY (`grn_request_id`) REFERENCES `grn_requests` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=32 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `grn_request_logs`
--

LOCK TABLES `grn_request_logs` WRITE;
/*!40000 ALTER TABLE `grn_request_logs` DISABLE KEYS */;
INSERT INTO `grn_request_logs` VALUES (1,1,'START_INSPECTION','pending','inspecting',NULL,NULL,'2025-11-20 12:21:56'),(2,2,'START_INSPECTION','pending','inspecting',NULL,NULL,'2025-11-20 12:22:48'),(3,2,'APPROVED','pending','approved',NULL,NULL,'2025-11-20 12:26:22'),(4,1,'APPROVED','pending','approved',NULL,NULL,'2025-11-20 12:26:46'),(5,3,'START_INSPECTION','pending','inspecting',NULL,NULL,'2025-11-21 11:52:19'),(6,3,'INSPECTION_COMPLETE','inspecting','awaiting_inventory_approval',NULL,NULL,'2025-11-21 11:59:50'),(7,3,'INVENTORY_APPROVED','awaiting_inventory_approval','approved',NULL,NULL,'2025-11-21 12:00:01'),(8,2,'START_INSPECTION','pending','inspecting',NULL,NULL,'2025-11-21 12:08:02'),(9,2,'INSPECTION_COMPLETE','inspecting','awaiting_inventory_approval',NULL,NULL,'2025-11-21 12:08:22'),(10,2,'INVENTORY_APPROVED','awaiting_inventory_approval','approved',NULL,NULL,'2025-11-21 12:08:32'),(11,1,'START_INSPECTION','pending','inspecting',NULL,NULL,'2025-11-21 12:14:50'),(12,1,'INSPECTION_COMPLETE','inspecting','awaiting_inventory_approval',NULL,NULL,'2025-11-21 12:15:28'),(13,1,'INVENTORY_APPROVED','awaiting_inventory_approval','approved',NULL,NULL,'2025-11-21 12:15:48'),(14,4,'START_INSPECTION','pending','inspecting',NULL,NULL,'2025-11-21 12:16:57'),(15,4,'INSPECTION_COMPLETE','inspecting','awaiting_inventory_approval',NULL,NULL,'2025-11-21 12:17:23'),(16,4,'INVENTORY_APPROVED','awaiting_inventory_approval','approved',NULL,NULL,'2025-11-21 12:17:29'),(17,5,'START_INSPECTION','pending','inspecting',NULL,1,'2025-11-21 12:21:11'),(18,5,'INSPECTION_COMPLETE','inspecting','awaiting_inventory_approval',NULL,1,'2025-11-21 12:21:41'),(19,5,'INVENTORY_APPROVED','awaiting_inventory_approval','approved',NULL,1,'2025-11-21 12:21:46'),(20,6,'INSPECTION_COMPLETE','inspecting','awaiting_inventory_approval',NULL,1,'2025-11-22 07:27:55'),(21,6,'INVENTORY_APPROVED','awaiting_inventory_approval','approved',NULL,1,'2025-11-22 07:28:08'),(22,6,'INVENTORY_APPROVED','awaiting_inventory_approval','approved',NULL,1,'2025-11-22 07:28:10'),(23,6,'INVENTORY_APPROVED','awaiting_inventory_approval','approved',NULL,1,'2025-11-22 07:28:24'),(24,6,'INVENTORY_APPROVED','awaiting_inventory_approval','approved',NULL,1,'2025-11-22 07:28:29'),(25,7,'INSPECTION_COMPLETE','inspecting','awaiting_inventory_approval',NULL,1,'2025-11-22 08:14:09'),(26,7,'INVENTORY_APPROVED','awaiting_inventory_approval','approved',NULL,1,'2025-11-22 08:14:22'),(27,7,'INVENTORY_APPROVED','awaiting_inventory_approval','approved',NULL,1,'2025-11-22 08:14:28'),(28,8,'INSPECTION_COMPLETE','inspecting','awaiting_inventory_approval',NULL,1,'2025-11-22 08:25:22'),(29,8,'INVENTORY_APPROVED','awaiting_inventory_approval','approved',NULL,1,'2025-11-22 08:25:28'),(30,8,'INVENTORY_APPROVED','awaiting_inventory_approval','approved',NULL,1,'2025-11-22 10:53:55'),(31,7,'INVENTORY_APPROVED','awaiting_inventory_approval','approved',NULL,1,'2025-11-24 05:24:10');
/*!40000 ALTER TABLE `grn_request_logs` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-12-05 14:04:43
