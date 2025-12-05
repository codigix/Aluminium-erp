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
-- Table structure for table `purchase_order_item`
--

DROP TABLE IF EXISTS `purchase_order_item`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `purchase_order_item` (
  `id` int NOT NULL AUTO_INCREMENT,
  `po_no` varchar(50) NOT NULL,
  `item_code` varchar(100) NOT NULL,
  `qty` decimal(10,2) DEFAULT NULL,
  `uom` varchar(50) DEFAULT NULL,
  `rate` decimal(10,2) DEFAULT NULL,
  `schedule_date` date DEFAULT NULL,
  `received_qty` decimal(10,2) DEFAULT '0.00',
  PRIMARY KEY (`id`),
  KEY `po_no` (`po_no`),
  KEY `item_code` (`item_code`),
  CONSTRAINT `purchase_order_item_ibfk_1` FOREIGN KEY (`po_no`) REFERENCES `purchase_order` (`po_no`),
  CONSTRAINT `purchase_order_item_ibfk_2` FOREIGN KEY (`item_code`) REFERENCES `item` (`item_code`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `purchase_order_item`
--

LOCK TABLES `purchase_order_item` WRITE;
/*!40000 ALTER TABLE `purchase_order_item` DISABLE KEYS */;
INSERT INTO `purchase_order_item` VALUES (1,'PO-1763721269127','ITEM-ALUMINIUMS',10.00,'Nos',100.00,'2025-11-29',0.00),(2,'PO-1763721269127','ITEM-ALUMINIUMS',10.00,'Nos',100.00,'2025-11-29',0.00),(3,'PO-1763722318177','ITEM-ALUMINIUMS',10.00,'Nos',1000.00,'2025-11-29',0.00),(4,'PO-1763724578416','ITEM-ALUMINIUMS',10.00,'Nos',100.00,'2025-11-29',0.00);
/*!40000 ALTER TABLE `purchase_order_item` ENABLE KEYS */;
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
