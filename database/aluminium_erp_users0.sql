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
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `user_id` int NOT NULL AUTO_INCREMENT,
  `full_name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `department` varchar(50) DEFAULT 'buying',
  `role` varchar(50) DEFAULT 'staff',
  `phone` varchar(20) DEFAULT NULL,
  `password` varchar(255) NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'buyer','buyer@gmail.com','buying','staff',NULL,'$2a$10$YtxsS0WNaDTBaYu/ihx/K.F0rcjFDnymbx8gVdlh/ySi8gqg2ZRDi',1,'2025-10-31 09:07:27','2025-10-31 09:07:27'),(2,'sales dashboard','sales@example.com','selling','staff',NULL,'$2a$10$1GKqL7D/o4q2NxeZaEuIXOAfz2ujNh2eAGhP53GhFEVYw/GfYtj8.',1,'2025-11-03 05:26:28','2025-11-03 05:26:28'),(3,'inventory','inventory@example.com','inventory','staff',NULL,'$2a$10$lp.WYOnuxQ.Yp2AHknMysOlScmTV0s7IjeSn2Mo6jSfKYa2601kRm',1,'2025-11-04 05:09:11','2025-11-04 05:09:11'),(4,'production','production@example.com','production','staff',NULL,'$2a$10$KDtWXb5SBYEp9wfJP5hoeO9fPi/ZsezoN9bYa7HDnkkA/RoYGCPYS',1,'2025-11-05 07:32:12','2025-11-05 07:32:12'),(5,'tool room','tool@example.com','toolroom','staff',NULL,'$2a$10$nXWSat.uRcJq9hMdgcNl9OPqDu0bRBbkwLhD3w7.hDWw3/l8FFBBK',1,'2025-11-05 07:33:47','2025-11-05 07:33:47'),(6,'quality ','quality@example.com','quality','staff',NULL,'$2a$10$HkmmOlcZaBQrCfDbOWvK8.QVx.DN4z558CoxgHlcIjpZ4vVSbSTRC',1,'2025-11-05 07:36:37','2025-11-05 07:36:37'),(7,'admin','admin@example.com','admin','staff',NULL,'$2a$10$RZqCdtTnWsjQRlDtnwegie1T3gD7iK1NmaIl1tYSPqvQtNJXdbWzi',1,'2025-11-05 09:28:37','2025-11-05 09:28:37'),(8,'payroll','payroll@example.com','hr','staff',NULL,'$2a$10$7evHDlG9RiE2fBEwu.8UyOv/BIoGF5Vb0UClGCXH9ra90lKbpr6sy',1,'2025-11-05 09:37:15','2025-11-05 09:37:15'),(9,'buying','buying@gmail.com','buying','staff',NULL,'$2a$10$mDCCu95FNeuL/giLgcGs4.4qzQiQzzbuv0IAP7J3IaxfhH/bMdrmi',1,'2025-11-20 07:35:36','2025-11-20 07:35:36'),(10,'manu','manufacturing@example.com','production','staff',NULL,'$2a$10$qNP5Yy//Kzzv7eUlW49mIuZB6tkvOMQb7FS1NbPt7WNWc8ldQLYTa',1,'2025-11-20 10:17:31','2025-11-20 10:17:31');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
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
