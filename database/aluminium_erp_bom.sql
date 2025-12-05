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
-- Table structure for table `bom`
--

DROP TABLE IF EXISTS `bom`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bom` (
  `bom_id` varchar(50) NOT NULL,
  `item_code` varchar(100) NOT NULL,
  `description` text,
  `quantity` decimal(18,6) DEFAULT '1.000000',
  `uom` varchar(50) DEFAULT NULL,
  `status` varchar(50) DEFAULT 'Draft',
  `revision` int DEFAULT '1',
  `effective_date` date DEFAULT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`bom_id`),
  KEY `idx_status` (`status`),
  KEY `idx_item_code` (`item_code`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bom`
--

LOCK TABLES `bom` WRITE;
/*!40000 ALTER TABLE `bom` DISABLE KEYS */;
INSERT INTO `bom` VALUES ('BOM-1764053031049','ITEM-ALUMINIUMS','sdassasd',10.000000,'Kg','draft',1,NULL,'system','2025-11-25 06:43:51','2025-11-25 06:43:51'),('BOM-1764056588733','ITEM-ALUMINIUMS','',1.000000,'Kg','draft',1,NULL,'system','2025-11-25 07:43:08','2025-11-25 07:43:08'),('BOM-1764160661251','ITEM-ALUMINIUMS','',1.000000,'Kg','draft',1,NULL,'system','2025-11-26 12:37:41','2025-11-26 12:37:41'),('BOM-1764160676780','ITEM-ALUMINIUMS','',1.000000,'Kg','draft',1,NULL,'system','2025-11-26 12:37:56','2025-11-26 12:37:56'),('BOM-1764160726855','ITEM-ALUMINIUMS','',1.000000,'Kg','draft',1,NULL,'system','2025-11-26 12:38:46','2025-11-26 12:38:46'),('BOM-1764160825275','ITEM-ALUMINIUMS','asdf',1.000000,'Kg','active',1,NULL,'system','2025-11-26 12:40:25','2025-11-26 12:40:25'),('BOM-1764161170640','ITEM-ALUMINIUMS','sdfg',1.000000,'Kg','active',1,NULL,'system','2025-11-26 12:46:10','2025-11-28 08:53:23'),('BOM-1764161433896','ITEM-ALUMINIUMS','rty',1.000000,'Kg','draft',1,NULL,'system','2025-11-26 12:50:33','2025-11-26 12:50:33'),('BOM-1764220190484','ITEM-ALUMINIUMS','asdafaskjdhkajsd',1.000000,'Kg','draft',1,NULL,'system','2025-11-27 05:09:50','2025-11-27 05:09:50');
/*!40000 ALTER TABLE `bom` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-12-03 17:37:48
