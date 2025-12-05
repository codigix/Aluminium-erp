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
-- Table structure for table `selling_sales_order`
--

DROP TABLE IF EXISTS `selling_sales_order`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `selling_sales_order` (
  `sales_order_id` varchar(50) NOT NULL,
  `customer_id` varchar(50) NOT NULL,
  `quotation_id` varchar(50) DEFAULT NULL,
  `order_amount` decimal(15,2) NOT NULL,
  `delivery_date` date DEFAULT NULL,
  `order_terms` text,
  `status` enum('draft','confirmed','shipped','delivered','cancelled') DEFAULT 'draft',
  `created_by` varchar(100) DEFAULT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `confirmed_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`sales_order_id`),
  KEY `quotation_id` (`quotation_id`),
  KEY `idx_customer` (`customer_id`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `selling_sales_order_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `selling_customer` (`customer_id`),
  CONSTRAINT `selling_sales_order_ibfk_2` FOREIGN KEY (`quotation_id`) REFERENCES `selling_quotation` (`quotation_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `selling_sales_order`
--

LOCK TABLES `selling_sales_order` WRITE;
/*!40000 ALTER TABLE `selling_sales_order` DISABLE KEYS */;
INSERT INTO `selling_sales_order` VALUES ('SO-1762338678957','CUST-1762337136750',NULL,100.00,'2025-11-09',NULL,'confirmed',NULL,NULL,'2025-11-05 10:31:18','2025-11-05 11:48:01','2025-11-05 11:48:01',NULL),('SO-1763637288010','CUST-1762337136750',NULL,20000.00,'2025-11-21','ergger','draft',NULL,NULL,'2025-11-20 11:14:48','2025-11-20 11:14:48',NULL,NULL),('SO-1763637651081','CUST-1762337136750',NULL,30000.00,'2025-11-21','dfdgfd','draft',NULL,NULL,'2025-11-20 11:20:51','2025-11-20 11:20:51',NULL,NULL),('SO-1763637991630','CUST-1762337136750',NULL,304500.00,'2025-11-21','sdfsd','draft',NULL,NULL,'2025-11-20 11:26:31','2025-11-20 11:26:31',NULL,NULL),('SO-1763637992588','CUST-1762337136750',NULL,304500.00,'2025-11-21','sdfsd','draft',NULL,NULL,'2025-11-20 11:26:32','2025-11-20 11:26:32',NULL,NULL);
/*!40000 ALTER TABLE `selling_sales_order` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-12-05 14:04:42
