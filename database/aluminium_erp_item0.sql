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
-- Table structure for table `item`
--

DROP TABLE IF EXISTS `item`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `item` (
  `item_code` varchar(100) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text,
  `uom` varchar(50) DEFAULT NULL,
  `hsn_code` varchar(20) DEFAULT NULL,
  `gst_rate` decimal(5,2) DEFAULT '0.00',
  `item_group` varchar(100) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `disabled` tinyint(1) DEFAULT '0',
  `allow_alternative_item` tinyint(1) DEFAULT '0',
  `maintain_stock` tinyint(1) DEFAULT '1',
  `has_variants` tinyint(1) DEFAULT '0',
  `opening_stock` decimal(15,3) DEFAULT '0.000',
  `valuation_rate` decimal(15,2) DEFAULT '0.00',
  `valuation_method` varchar(50) DEFAULT 'FIFO',
  `standard_selling_rate` decimal(15,2) DEFAULT '0.00',
  `is_fixed_asset` tinyint(1) DEFAULT '0',
  `shelf_life_in_days` int DEFAULT NULL,
  `warranty_period_in_days` int DEFAULT NULL,
  `end_of_life` date DEFAULT NULL,
  `weight_per_unit` decimal(15,3) DEFAULT NULL,
  `weight_uom` varchar(20) DEFAULT NULL,
  `allow_negative_stock` tinyint(1) DEFAULT '0',
  `has_batch_no` tinyint(1) DEFAULT '0',
  `has_serial_no` tinyint(1) DEFAULT '0',
  `automatically_create_batch` tinyint(1) DEFAULT '0',
  `batch_number_series` varchar(100) DEFAULT NULL,
  `has_expiry_date` tinyint(1) DEFAULT '0',
  `retain_sample` tinyint(1) DEFAULT '0',
  `max_sample_quantity` decimal(15,3) DEFAULT NULL,
  `default_purchase_uom` varchar(10) DEFAULT NULL,
  `lead_time_days` int DEFAULT '0',
  `minimum_order_qty` decimal(15,3) DEFAULT '1.000',
  `safety_stock` decimal(15,3) DEFAULT '0.000',
  `is_customer_provided_item` tinyint(1) DEFAULT '0',
  `default_sales_uom` varchar(10) DEFAULT NULL,
  `max_discount_percentage` decimal(5,2) DEFAULT '0.00',
  `grant_commission` tinyint(1) DEFAULT '0',
  `allow_sales` tinyint(1) DEFAULT '1',
  `cess_rate` decimal(5,2) DEFAULT '0.00',
  `inclusive_tax` tinyint(1) DEFAULT '0',
  `supply_raw_materials_for_purchase` tinyint(1) DEFAULT '0',
  `include_item_in_manufacturing` tinyint(1) DEFAULT '0',
  `no_of_cavities` int DEFAULT '1',
  `family_mould` tinyint(1) DEFAULT '0',
  `mould_number` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`item_code`),
  KEY `idx_item_code` (`item_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `item`
--

LOCK TABLES `item` WRITE;
/*!40000 ALTER TABLE `item` DISABLE KEYS */;
INSERT INTO `item` VALUES ('ITEM-ALUMINIUMS','aluminium sheet','dfs','Nos','9',0.00,'sdfsd',0,'2025-11-21 09:21:51','2025-12-01 10:33:22',0,0,1,0,0.000,0.00,'FIFO',0.00,0,NULL,NULL,NULL,NULL,NULL,0,0,0,0,NULL,0,0,NULL,'Nos',0,1.000,0.000,0,'Nos',0.00,0,1,0.00,0,0,0,1,0,'5');
/*!40000 ALTER TABLE `item` ENABLE KEYS */;
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
