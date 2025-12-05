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
-- Table structure for table `operation`
--

DROP TABLE IF EXISTS `operation`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `operation` (
  `name` varchar(100) NOT NULL,
  `operation_name` varchar(255) NOT NULL,
  `default_workstation` varchar(100) DEFAULT NULL,
  `is_corrective_operation` tinyint(1) DEFAULT '0',
  `create_job_card_based_on_batch_size` tinyint(1) DEFAULT '0',
  `batch_size` int DEFAULT '1',
  `quality_inspection_template` varchar(100) DEFAULT NULL,
  `description` longtext,
  `status` enum('active','inactive','draft') DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` varchar(100) DEFAULT NULL,
  `modified_by` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`name`),
  KEY `idx_name` (`name`),
  KEY `idx_workstation` (`default_workstation`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `operation`
--

LOCK TABLES `operation` WRITE;
/*!40000 ALTER TABLE `operation` DISABLE KEYS */;
INSERT INTO `operation` VALUES ('Assembly','Assembly','Welding Station - 01',0,0,1,NULL,NULL,'active','2025-11-26 10:23:38','2025-11-26 10:23:38',NULL,NULL),('BUFFING','BUFFING',NULL,0,0,1,NULL,NULL,'active','2025-11-26 10:23:38','2025-11-26 10:23:38',NULL,NULL),('Core_Preparation','Core Preparation',NULL,0,0,1,NULL,NULL,'active','2025-11-26 10:23:38','2025-11-26 10:23:38',NULL,NULL),('ENGRAVING','ENGRAVING',NULL,0,0,1,NULL,NULL,'active','2025-11-26 10:23:38','2025-11-26 10:23:38',NULL,NULL),('Fettling','Fettling','Line - 01',0,0,1,NULL,NULL,'active','2025-11-26 10:23:38','2025-11-26 10:23:38',NULL,NULL),('Final_Inspection','Final Inspection','Inspection Table - 01',0,0,1,NULL,NULL,'active','2025-11-26 10:23:38','2025-11-26 10:23:38',NULL,NULL),('GDC','GDC',NULL,0,0,1,NULL,NULL,'active','2025-11-26 10:23:38','2025-11-26 10:23:38',NULL,NULL),('HEAT_TREATMENT','HEAT TREATMENT','HEAT TREATMENT FURNACE',0,0,1,NULL,NULL,'active','2025-11-26 10:23:38','2025-11-26 10:23:38',NULL,NULL),('Machining','Machining',NULL,0,0,1,NULL,NULL,'active','2025-11-26 10:23:38','2025-11-26 10:23:38',NULL,NULL),('MACHINING_OP_10','MACHINING OP-10',NULL,0,0,1,NULL,NULL,'active','2025-11-26 10:23:38','2025-11-26 10:23:38',NULL,NULL),('MACHINING_OP_20','MACHINING OP-20',NULL,0,0,1,NULL,NULL,'active','2025-11-26 10:23:38','2025-11-26 10:23:38',NULL,NULL),('MACHINING_OP_30','MACHINING OP-30',NULL,0,0,1,NULL,NULL,'active','2025-11-26 10:23:38','2025-11-26 10:23:38',NULL,NULL),('MACHINING_OP_40','MACHINING OP-40',NULL,0,0,1,NULL,NULL,'active','2025-11-26 10:23:38','2025-11-26 10:23:38',NULL,NULL),('POWDER_COATING','POWDER COATING',NULL,0,0,1,NULL,NULL,'active','2025-11-26 10:23:38','2025-11-26 10:23:38',NULL,NULL),('sand_blasting','sand blasting',NULL,0,0,1,NULL,NULL,'active','2025-11-26 10:23:38','2025-11-26 10:23:38',NULL,NULL),('Shot_Blasting','Shot Blasting',NULL,0,0,1,NULL,NULL,'active','2025-11-26 10:23:38','2025-11-26 10:23:38',NULL,NULL),('Water_Leakage_Testing','Water Leakage Testing','WLT - Machine - 01',0,0,1,NULL,NULL,'active','2025-11-26 10:23:38','2025-11-26 10:23:38',NULL,NULL);
/*!40000 ALTER TABLE `operation` ENABLE KEYS */;
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
