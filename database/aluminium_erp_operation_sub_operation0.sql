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
-- Table structure for table `operation_sub_operation`
--

DROP TABLE IF EXISTS `operation_sub_operation`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `operation_sub_operation` (
  `id` int NOT NULL AUTO_INCREMENT,
  `operation_name` varchar(100) NOT NULL,
  `no` int DEFAULT NULL,
  `operation` varchar(255) DEFAULT NULL,
  `operation_time` decimal(10,2) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_operation` (`operation_name`),
  CONSTRAINT `operation_sub_operation_ibfk_1` FOREIGN KEY (`operation_name`) REFERENCES `operation` (`name`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `operation_sub_operation`
--

LOCK TABLES `operation_sub_operation` WRITE;
/*!40000 ALTER TABLE `operation_sub_operation` DISABLE KEYS */;
INSERT INTO `operation_sub_operation` VALUES (1,'Assembly',1,'Component Preparation',0.50,'2025-11-26 10:23:38'),(2,'Assembly',2,'Welding',2.00,'2025-11-26 10:23:38'),(3,'Assembly',3,'Quality Check',1.00,'2025-11-26 10:23:38'),(4,'HEAT_TREATMENT',1,'Preheating',1.00,'2025-11-26 10:23:38'),(5,'HEAT_TREATMENT',2,'Heating',3.00,'2025-11-26 10:23:38'),(6,'HEAT_TREATMENT',3,'Cooling',2.00,'2025-11-26 10:23:38'),(7,'MACHINING_OP_40',1,'Rough Machining',1.50,'2025-11-26 10:23:38'),(8,'MACHINING_OP_40',2,'Fine Machining',1.00,'2025-11-26 10:23:38'),(9,'Fettling',1,'Grinding',1.50,'2025-11-26 10:23:38'),(10,'Fettling',2,'Polishing',1.00,'2025-11-26 10:23:38'),(11,'Final_Inspection',1,'Visual Inspection',0.50,'2025-11-26 10:23:38'),(12,'Final_Inspection',2,'Dimensional Check',1.00,'2025-11-26 10:23:38'),(13,'Final_Inspection',3,'Documentation',0.50,'2025-11-26 10:23:38');
/*!40000 ALTER TABLE `operation_sub_operation` ENABLE KEYS */;
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
