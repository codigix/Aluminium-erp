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
-- Table structure for table `stock_balance`
--

DROP TABLE IF EXISTS `stock_balance`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stock_balance` (
  `id` int NOT NULL AUTO_INCREMENT,
  `item_code` varchar(100) NOT NULL,
  `warehouse_id` int NOT NULL,
  `current_qty` decimal(12,2) DEFAULT '0.00',
  `reserved_qty` decimal(12,2) DEFAULT '0.00',
  `available_qty` decimal(12,2) DEFAULT '0.00',
  `valuation_rate` decimal(12,4) DEFAULT '0.0000',
  `total_value` decimal(16,2) DEFAULT '0.00',
  `last_receipt_date` datetime DEFAULT NULL,
  `last_issue_date` datetime DEFAULT NULL,
  `is_locked` tinyint(1) DEFAULT '0',
  `locked_reason` varchar(255) DEFAULT NULL,
  `locked_by` int DEFAULT NULL,
  `locked_at` datetime DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_item_warehouse` (`item_code`,`warehouse_id`),
  KEY `idx_available_qty` (`available_qty`),
  KEY `idx_item_code` (`item_code`),
  KEY `idx_warehouse_id` (`warehouse_id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stock_balance`
--

LOCK TABLES `stock_balance` WRITE;
/*!40000 ALTER TABLE `stock_balance` DISABLE KEYS */;
INSERT INTO `stock_balance` VALUES (1,'ITEM-ALUMINIUMS',3,10.00,0.00,10.00,100.0000,1000.10,NULL,NULL,0,NULL,NULL,NULL,'2025-11-24 07:52:56');
/*!40000 ALTER TABLE `stock_balance` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-12-05 14:04:49
