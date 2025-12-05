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
-- Table structure for table `selling_delivery_note`
--

DROP TABLE IF EXISTS `selling_delivery_note`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `selling_delivery_note` (
  `delivery_note_id` varchar(50) NOT NULL,
  `sales_order_id` varchar(50) NOT NULL,
  `delivery_date` date NOT NULL,
  `quantity` decimal(10,2) DEFAULT NULL,
  `driver_name` varchar(100) DEFAULT NULL,
  `vehicle_info` varchar(100) DEFAULT NULL,
  `remarks` text,
  `status` enum('draft','delivered','returned','cancelled') DEFAULT 'draft',
  `created_by` varchar(100) DEFAULT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`delivery_note_id`),
  KEY `idx_sales_order` (`sales_order_id`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `selling_delivery_note_ibfk_1` FOREIGN KEY (`sales_order_id`) REFERENCES `selling_sales_order` (`sales_order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `selling_delivery_note`
--

LOCK TABLES `selling_delivery_note` WRITE;
/*!40000 ALTER TABLE `selling_delivery_note` DISABLE KEYS */;
INSERT INTO `selling_delivery_note` VALUES ('DN-1762343317015','SO-1762338678957','2025-11-15',10.00,'dfdfd','fdgdf','dfgfg','delivered',NULL,NULL,'2025-11-05 11:48:37','2025-11-05 11:51:14',NULL),('DN-1763637316378','SO-1762338678957','2025-11-21',100.00,'grt','hbj',NULL,'delivered',NULL,NULL,'2025-11-20 11:15:16','2025-11-20 11:15:22',NULL),('DN-1763638109693','SO-1762338678957','2025-11-28',1000.00,'grtgr','errere','fdf','delivered',NULL,NULL,'2025-11-20 11:28:29','2025-11-20 11:28:34',NULL);
/*!40000 ALTER TABLE `selling_delivery_note` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-12-05 14:04:47
