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
-- Table structure for table `work_order_operation`
--

DROP TABLE IF EXISTS `work_order_operation`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `work_order_operation` (
  `operation_id` int NOT NULL AUTO_INCREMENT,
  `wo_id` varchar(50) NOT NULL,
  `operation` varchar(100) DEFAULT NULL,
  `workstation` varchar(100) DEFAULT NULL,
  `time` decimal(10,2) DEFAULT NULL,
  `completed_qty` decimal(18,6) DEFAULT '0.000000',
  `process_loss_qty` decimal(18,6) DEFAULT '0.000000',
  `sequence` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`operation_id`),
  KEY `idx_wo_id` (`wo_id`),
  KEY `idx_sequence` (`sequence`),
  CONSTRAINT `work_order_operation_ibfk_1` FOREIGN KEY (`wo_id`) REFERENCES `work_order` (`wo_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `work_order_operation`
--

LOCK TABLES `work_order_operation` WRITE;
/*!40000 ALTER TABLE `work_order_operation` DISABLE KEYS */;
INSERT INTO `work_order_operation` VALUES (1,'WO-1764321734050','Assembly','',100.00,10.000000,10.000000,1,'2025-11-28 09:22:14'),(2,'WO-1764323942023','Assembly','WS-01',2.00,0.000000,0.000000,1,'2025-11-28 09:59:02'),(3,'WO-1764323942023','Testing','WS-02',1.00,0.000000,0.000000,2,'2025-11-28 09:59:02'),(4,'WO-1764323942023','Packaging','WS-03',0.50,0.000000,0.000000,3,'2025-11-28 09:59:02'),(5,'WO-1764323966740','Assembly','WS-01',2.00,0.000000,0.000000,1,'2025-11-28 09:59:26'),(6,'WO-1764323966740','Testing','WS-02',1.00,0.000000,0.000000,2,'2025-11-28 09:59:26'),(7,'WO-1764323966740','Packaging','WS-03',0.50,0.000000,0.000000,3,'2025-11-28 09:59:26'),(8,'WO-1764324002643','Assembly','WS-01',2.00,0.000000,0.000000,1,'2025-11-28 10:00:02'),(9,'WO-1764324002643','Testing','WS-02',1.00,0.000000,0.000000,2,'2025-11-28 10:00:02'),(10,'WO-1764324002643','Packaging','WS-03',0.50,0.000000,0.000000,3,'2025-11-28 10:00:02'),(11,'WO-1764324210716','Assembly','WS-01',2.00,0.000000,0.000000,1,'2025-11-28 10:03:30'),(12,'WO-1764324210716','Testing','WS-02',1.00,0.000000,0.000000,2,'2025-11-28 10:03:30'),(13,'WO-1764324210716','Packaging','WS-03',0.50,0.000000,0.000000,3,'2025-11-28 10:03:30');
/*!40000 ALTER TABLE `work_order_operation` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-12-05 14:04:51
