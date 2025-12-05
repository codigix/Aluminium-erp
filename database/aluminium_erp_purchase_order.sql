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
-- Table structure for table `purchase_order`
--

DROP TABLE IF EXISTS `purchase_order`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `purchase_order` (
  `po_no` varchar(50) NOT NULL,
  `supplier_id` varchar(50) NOT NULL,
  `order_date` date DEFAULT NULL,
  `expected_date` date DEFAULT NULL,
  `currency` varchar(10) DEFAULT 'INR',
  `taxes_and_charges_template_id` varchar(50) DEFAULT NULL,
  `total_value` decimal(15,2) DEFAULT NULL,
  `status` enum('draft','submitted','to_receive','partially_received','completed','cancelled') DEFAULT 'draft',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` varchar(100) DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`po_no`),
  KEY `supplier_id` (`supplier_id`),
  KEY `taxes_and_charges_template_id` (`taxes_and_charges_template_id`),
  KEY `idx_po_status` (`status`),
  KEY `idx_po_date` (`order_date`),
  CONSTRAINT `purchase_order_ibfk_1` FOREIGN KEY (`supplier_id`) REFERENCES `supplier` (`supplier_id`),
  CONSTRAINT `purchase_order_ibfk_2` FOREIGN KEY (`taxes_and_charges_template_id`) REFERENCES `taxes_and_charges_template` (`template_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `purchase_order`
--

LOCK TABLES `purchase_order` WRITE;
/*!40000 ALTER TABLE `purchase_order` DISABLE KEYS */;
INSERT INTO `purchase_order` VALUES ('PO-1763721099737','SUP-1763710276028','2025-11-22','2025-11-29','INR',NULL,2000.00,'draft','2025-11-21 10:31:39',NULL,'2025-11-21 10:31:39',NULL),('PO-1763721106382','SUP-1763710276028','2025-11-22','2025-11-29','INR',NULL,2000.00,'draft','2025-11-21 10:31:46',NULL,'2025-11-21 10:31:46',NULL),('PO-1763721269127','SUP-1763710276028','2025-11-22','2025-11-29','INR',NULL,2000.00,'draft','2025-11-21 10:34:29',NULL,'2025-11-21 10:34:29',NULL),('PO-1763722318177','SUP-1763710276028','2025-11-20','2025-11-30','INR',NULL,10000.00,'to_receive','2025-11-21 10:51:58',NULL,'2025-11-21 12:21:05',NULL),('PO-1763724578416','SUP-1763710276028','2025-11-21','2025-11-29','INR',NULL,1000.00,'to_receive','2025-11-21 11:29:38',NULL,'2025-11-21 11:47:41',NULL);
/*!40000 ALTER TABLE `purchase_order` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-12-03 17:37:51
