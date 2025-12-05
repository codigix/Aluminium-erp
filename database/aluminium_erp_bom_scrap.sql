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
-- Table structure for table `bom_scrap`
--

DROP TABLE IF EXISTS `bom_scrap`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bom_scrap` (
  `scrap_id` int NOT NULL AUTO_INCREMENT,
  `bom_id` varchar(50) NOT NULL,
  `item_code` varchar(100) NOT NULL,
  `item_name` varchar(255) DEFAULT NULL,
  `quantity` decimal(18,6) DEFAULT NULL,
  `rate` decimal(18,2) DEFAULT NULL,
  `sequence` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`scrap_id`),
  KEY `item_code` (`item_code`),
  KEY `idx_bom_id` (`bom_id`),
  KEY `idx_sequence` (`sequence`),
  CONSTRAINT `bom_scrap_ibfk_1` FOREIGN KEY (`bom_id`) REFERENCES `bom` (`bom_id`) ON DELETE CASCADE,
  CONSTRAINT `bom_scrap_ibfk_2` FOREIGN KEY (`item_code`) REFERENCES `item` (`item_code`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bom_scrap`
--

LOCK TABLES `bom_scrap` WRITE;
/*!40000 ALTER TABLE `bom_scrap` DISABLE KEYS */;
INSERT INTO `bom_scrap` VALUES (1,'BOM-1764161433896','ITEM-ALUMINIUMS','aluminium sheet',0.010000,0.01,1,'2025-11-26 12:50:33'),(2,'BOM-1764220190484','ITEM-ALUMINIUMS','aluminium sheet',10.000000,100.00,1,'2025-11-27 05:09:50');
/*!40000 ALTER TABLE `bom_scrap` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-12-03 17:37:46
