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
-- Table structure for table `job_card`
--

DROP TABLE IF EXISTS `job_card`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `job_card` (
  `job_card_id` varchar(50) NOT NULL,
  `work_order_id` varchar(50) DEFAULT NULL,
  `machine_id` varchar(100) DEFAULT NULL,
  `operator_id` varchar(100) DEFAULT NULL,
  `planned_quantity` decimal(18,6) DEFAULT NULL,
  `produced_quantity` decimal(18,6) DEFAULT '0.000000',
  `rejected_quantity` decimal(18,6) DEFAULT '0.000000',
  `scheduled_start_date` datetime DEFAULT NULL,
  `scheduled_end_date` datetime DEFAULT NULL,
  `actual_start_date` datetime DEFAULT NULL,
  `actual_end_date` datetime DEFAULT NULL,
  `status` varchar(50) DEFAULT 'Open',
  `notes` text,
  `created_by` varchar(100) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`job_card_id`),
  KEY `idx_status` (`status`),
  KEY `idx_work_order_id` (`work_order_id`),
  KEY `idx_machine_id` (`machine_id`),
  KEY `idx_operator_id` (`operator_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `job_card`
--

LOCK TABLES `job_card` WRITE;
/*!40000 ALTER TABLE `job_card` DISABLE KEYS */;
INSERT INTO `job_card` VALUES ('JC-1764324210791-1','WO-1764324210716','ws-001','EMP-1764328289765',10.000000,9.000000,0.000000,'2025-01-01 00:00:00','2025-01-02 00:00:00',NULL,NULL,'draft','Operation: Assembly, Workstation: WS-01, Time: 2h','test','2025-11-28 10:03:30','2025-12-03 10:34:55'),('JC-1764324210798-2','WO-1764324210716','ws-001','EMP-1764328289765',9.000000,10.000000,0.000000,'2024-12-31 00:00:00','2025-01-18 00:00:00',NULL,NULL,'Open','Operation: Testing, Workstation: WS-02, Time: 1h','test','2025-11-28 10:03:30','2025-12-03 11:03:53'),('JC-1764324210804-3','WO-1764324210716',NULL,NULL,10.000000,0.000000,0.000000,'2025-01-15 00:00:00','2025-01-22 00:00:00',NULL,NULL,'Open','Operation: Packaging, Workstation: WS-03, Time: 0.5h','test','2025-11-28 10:03:30','2025-11-28 10:03:30'),('JC-1764330263103','WO-1764321734050','ws-001','EMP-1764328289765',100.000000,0.000000,0.000000,'2025-11-26 00:00:00','2025-11-27 00:00:00',NULL,NULL,'Open','','system','2025-11-28 11:44:23','2025-12-02 09:29:56');
/*!40000 ALTER TABLE `job_card` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-12-03 17:37:52
