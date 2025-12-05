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
-- Table structure for table `supplier_quotation_item`
--

DROP TABLE IF EXISTS `supplier_quotation_item`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `supplier_quotation_item` (
  `sq_item_id` varchar(50) NOT NULL,
  `supplier_quotation_id` varchar(50) NOT NULL,
  `item_code` varchar(50) NOT NULL,
  `rate` decimal(15,2) DEFAULT NULL,
  `lead_time_days` int DEFAULT NULL,
  `min_qty` decimal(15,3) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`sq_item_id`),
  KEY `item_code` (`item_code`),
  KEY `idx_sq` (`supplier_quotation_id`),
  CONSTRAINT `supplier_quotation_item_ibfk_1` FOREIGN KEY (`supplier_quotation_id`) REFERENCES `supplier_quotation` (`supplier_quotation_id`),
  CONSTRAINT `supplier_quotation_item_ibfk_2` FOREIGN KEY (`item_code`) REFERENCES `item` (`item_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `supplier_quotation_item`
--

LOCK TABLES `supplier_quotation_item` WRITE;
/*!40000 ALTER TABLE `supplier_quotation_item` DISABLE KEYS */;
INSERT INTO `supplier_quotation_item` VALUES ('SQI-1761989486754-0.38838986629577565','SQ-1761909508202','ITEM-001',1.00,1,1.000,'2025-11-01 09:31:26'),('SQI-1763719958494-0.08474747861995291','SQ-1763719958481','ITEM-ALUMINIUMS',10.00,100,10.000,'2025-11-21 10:12:38'),('SQI-1763720219198-0.9069119265994052','SQ-1763720219186','ITEM-ALUMINIUMS',100.00,10,10.000,'2025-11-21 10:16:59');
/*!40000 ALTER TABLE `supplier_quotation_item` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-12-05 14:04:41
