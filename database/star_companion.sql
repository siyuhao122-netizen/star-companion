-- =====================================================
-- 星伴 · 暖愈成长空间 - 数据库设计
-- =====================================================
CREATE DATABASE IF NOT EXISTS `star_companion`
    DEFAULT CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE `star_companion`;

-- =====================================================
-- 1. 用户表 (user)
-- =====================================================
DROP TABLE IF EXISTS `user`;
CREATE TABLE `user` (
                        `id` INT NOT NULL AUTO_INCREMENT COMMENT '用户ID',
                        `email` VARCHAR(100) NOT NULL COMMENT 'QQ邮箱，唯一登录账号',
                        `password_hash` VARCHAR(255) NOT NULL COMMENT '密码哈希',
                        `nickname` VARCHAR(50) DEFAULT NULL COMMENT '家长昵称',
                        `phone` VARCHAR(20) DEFAULT NULL COMMENT '手机号',
                        `avatar` VARCHAR(500) DEFAULT NULL COMMENT '头像（Base64或URL）',
                        `relation` VARCHAR(20) DEFAULT NULL COMMENT '与孩子关系：妈妈/爸爸/奶奶/爷爷/其他',
                        `is_verified` TINYINT(1) DEFAULT 0 COMMENT '邮箱是否已验证',
                        `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                        `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
                        PRIMARY KEY (`id`),
                        UNIQUE KEY `uk_email` (`email`),
                        INDEX `idx_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';


-- =====================================================
-- 2. 邮箱验证码表 (email_verification)
-- =====================================================
DROP TABLE IF EXISTS `email_verification`;
CREATE TABLE `email_verification` (
                                      `id` INT NOT NULL AUTO_INCREMENT COMMENT '记录ID',
                                      `email` VARCHAR(100) NOT NULL COMMENT '邮箱地址',
                                      `code` VARCHAR(6) NOT NULL COMMENT '6位验证码',
                                      `type` ENUM('register', 'login', 'reset_password') DEFAULT 'register' COMMENT '验证码类型',
                                      `expires_at` DATETIME NOT NULL COMMENT '过期时间',
                                      `is_used` TINYINT(1) DEFAULT 0 COMMENT '是否已使用',
                                      `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                      PRIMARY KEY (`id`),
                                      INDEX `idx_email_type` (`email`, `type`),
                                      INDEX `idx_expires_at` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='邮箱验证码表';


-- =====================================================
-- 3. 孩子表 (child)
-- =====================================================
DROP TABLE IF EXISTS `child`;
CREATE TABLE `child` (
                         `id` INT NOT NULL AUTO_INCREMENT COMMENT '孩子ID',
                         `user_id` INT NOT NULL COMMENT '所属家长ID',
                         `name` VARCHAR(50) NOT NULL COMMENT '孩子昵称',
                         `gender` ENUM('男', '女') DEFAULT '男' COMMENT '性别',
                         `birth_date` DATE DEFAULT NULL COMMENT '出生日期',
                         `avatar_type` ENUM('icon', 'custom') DEFAULT 'icon' COMMENT '头像类型',
                         `avatar` VARCHAR(500) DEFAULT NULL COMMENT '头像（图标名或Base64）',
                         `focus_tags` JSON DEFAULT NULL COMMENT '关注重点标签',
                         `note` VARCHAR(200) DEFAULT NULL COMMENT '备注',
                         `is_active` TINYINT(1) DEFAULT 0 COMMENT '是否当前选中',
                         `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                         `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
                         PRIMARY KEY (`id`),
                         KEY `fk_child_user` (`user_id`),
                         INDEX `idx_user_id` (`user_id`),
                         CONSTRAINT `fk_child_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='孩子表';




-- =====================================================
-- 4. 叫名反应训练记录表 (name_reaction_record)
-- =====================================================
DROP TABLE IF EXISTS `name_reaction_record`;
CREATE TABLE `name_reaction_record` (
                                        `id` INT NOT NULL AUTO_INCREMENT COMMENT '记录ID',
                                        `child_id` INT NOT NULL COMMENT '孩子ID',
                                        `session_date` DATE NOT NULL COMMENT '训练日期',
                                        `round_total` INT DEFAULT 8 COMMENT '总轮数',
                                        `success_count` INT DEFAULT 0 COMMENT '成功次数',
                                        `avg_reaction_time` DECIMAL(5,2) DEFAULT NULL COMMENT '平均反应时间(秒)',
                                        `round_details` JSON DEFAULT NULL COMMENT '每轮详情',
                                        `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                        PRIMARY KEY (`id`),
                                        KEY `fk_name_reaction_child` (`child_id`),
                                        INDEX `idx_child_date` (`child_id`, `session_date`),
                                        CONSTRAINT `fk_name_reaction_child` FOREIGN KEY (`child_id`) REFERENCES `child` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='叫名反应训练记录';


-- =====================================================
-- 5. 指物练习训练记录表 (point_game_record)
-- =====================================================
DROP TABLE IF EXISTS `point_game_record`;
CREATE TABLE `point_game_record` (
                                     `id` INT NOT NULL AUTO_INCREMENT COMMENT '记录ID',
                                     `child_id` INT NOT NULL COMMENT '孩子ID',
                                     `session_date` DATE NOT NULL COMMENT '训练日期',
                                     `round_total` INT DEFAULT 8 COMMENT '总轮数',
                                     `correct_rounds` INT DEFAULT 0 COMMENT '正确轮数',
                                     `wrong_rounds` INT DEFAULT 0 COMMENT '错误轮数',
                                     `total_clicks` INT DEFAULT 0 COMMENT '总点击次数',
                                     `correct_clicks` INT DEFAULT 0 COMMENT '正确点击次数',
                                     `wrong_clicks` INT DEFAULT 0 COMMENT '错误点击次数',
                                     `timeout_count` INT DEFAULT 0 COMMENT '超时次数',
                                     `skip_count` INT DEFAULT 0 COMMENT '跳过次数',
                                     `total_time_sec` DECIMAL(8,2) DEFAULT NULL COMMENT '总用时(秒)',
                                     `avg_time_sec` DECIMAL(5,2) DEFAULT NULL COMMENT '平均用时(秒)',
                                     `accuracy` DECIMAL(5,2) DEFAULT NULL COMMENT '正确率',
                                     `click_accuracy` DECIMAL(5,2) DEFAULT NULL COMMENT '点击准确率',
                                     `round_details` JSON DEFAULT NULL COMMENT '每轮详情',
                                     `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                     PRIMARY KEY (`id`),
                                     KEY `fk_point_game_child` (`child_id`),
                                     INDEX `idx_child_date` (`child_id`, `session_date`),
                                     CONSTRAINT `fk_point_game_child` FOREIGN KEY (`child_id`) REFERENCES `child` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='指物练习训练记录';


-- =====================================================
-- 6. 声音小话筒训练记录表 (voice_game_record)
-- =====================================================
DROP TABLE IF EXISTS `voice_game_record`;
CREATE TABLE `voice_game_record` (
                                     `id` INT NOT NULL AUTO_INCREMENT COMMENT '记录ID',
                                     `child_id` INT NOT NULL COMMENT '孩子ID',
                                     `session_date` DATE NOT NULL COMMENT '训练日期',
                                     `round_total` INT DEFAULT 8 COMMENT '总轮数',
                                     `completed_rounds` INT DEFAULT 0 COMMENT '完成轮数',
                                     `success_count` INT DEFAULT 0 COMMENT '成功次数',
                                     `round_details` JSON DEFAULT NULL COMMENT '每轮详情',
                                     `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                     PRIMARY KEY (`id`),
                                     KEY `fk_voice_game_child` (`child_id`),
                                     INDEX `idx_child_date` (`child_id`, `session_date`),
                                     CONSTRAINT `fk_voice_game_child` FOREIGN KEY (`child_id`) REFERENCES `child` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='声音小话筒训练记录';


-- =====================================================
-- 7. 问卷筛查结果表 (survey_result)
-- =====================================================
DROP TABLE IF EXISTS `survey_result`;
CREATE TABLE `survey_result` (
                                 `id` INT NOT NULL AUTO_INCREMENT COMMENT '记录ID',
                                 `child_id` INT NOT NULL COMMENT '孩子ID',
                                 `answers` JSON DEFAULT NULL COMMENT '23题答案数组',
                                 `total_score` INT DEFAULT NULL COMMENT '总分',
                                 `level` VARCHAR(20) DEFAULT NULL COMMENT '评估等级：发展良好/轻微倾向/需要关注',
                                 `summary` TEXT DEFAULT NULL COMMENT '评估摘要',
                                 `suggestions` JSON DEFAULT NULL COMMENT '建议列表',
                                 `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                 PRIMARY KEY (`id`),
                                 KEY `fk_survey_child` (`child_id`),
                                 INDEX `idx_child_created` (`child_id`, `created_at`),
                                 CONSTRAINT `fk_survey_child` FOREIGN KEY (`child_id`) REFERENCES `child` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='问卷筛查结果表';


-- =====================================================
-- 8. 家长树洞留言表 (treehole_message)
-- =====================================================
DROP TABLE IF EXISTS `treehole_message`;
CREATE TABLE `treehole_message` (
                                    `id` INT NOT NULL AUTO_INCREMENT COMMENT '留言ID',
                                    `user_id` INT DEFAULT NULL COMMENT '发布者ID（可为空，支持匿名）',
                                    `anonymous_name` VARCHAR(50) DEFAULT NULL COMMENT '匿名显示名称',
                                    `anonymous_avatar` VARCHAR(50) DEFAULT NULL COMMENT '匿名头像',
                                    `content` TEXT NOT NULL COMMENT '留言内容',
                                    `tag` VARCHAR(20) DEFAULT '日常倾诉' COMMENT '标签',
                                    `ai_reply` TEXT DEFAULT NULL COMMENT 'AI回复内容',
                                    `likes` INT DEFAULT 0 COMMENT '点赞数',
                                    `is_public` TINYINT(1) DEFAULT 1 COMMENT '是否公开显示',
                                    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                    PRIMARY KEY (`id`),
                                    KEY `fk_treehole_user` (`user_id`),
                                    INDEX `idx_tag` (`tag`),
                                    INDEX `idx_created_at` (`created_at` DESC),
                                    CONSTRAINT `fk_treehole_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='家长树洞留言表';


-- =====================================================
-- 9. 每日推荐记录表 (daily_recommendation) - 可选
-- =====================================================
DROP TABLE IF EXISTS `daily_recommendation`;
CREATE TABLE `daily_recommendation` (
                                        `id` INT NOT NULL AUTO_INCREMENT COMMENT '记录ID',
                                        `child_id` INT NOT NULL COMMENT '孩子ID',
                                        `recommend_date` DATE NOT NULL COMMENT '推荐日期',
                                        `priority_game` ENUM('name', 'point', 'mic') DEFAULT NULL COMMENT '优先推荐游戏',
                                        `tip_text` VARCHAR(200) DEFAULT NULL COMMENT '提示语',
                                        `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                                        PRIMARY KEY (`id`),
                                        KEY `fk_recommend_child` (`child_id`),
                                        UNIQUE KEY `uk_child_date` (`child_id`, `recommend_date`),
                                        CONSTRAINT `fk_recommend_child` FOREIGN KEY (`child_id`) REFERENCES `child` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='每日推荐记录表';

ALTER TABLE `user` MODIFY COLUMN `avatar` LONGTEXT;
ALTER TABLE `child` MODIFY COLUMN `avatar` LONGTEXT;
ALTER TABLE `child` ADD COLUMN `relation` VARCHAR(20) DEFAULT '妈妈' COMMENT '与家长关系' AFTER `gender`;

-- 1. 删除原有的外键约束
ALTER TABLE `child` DROP FOREIGN KEY `fk_child_user`;

-- 2. 重新添加外键，设置级联删除
ALTER TABLE `child`
    ADD CONSTRAINT `fk_child_user`
        FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE;

-- 3. 同样处理其他关联表
ALTER TABLE `name_reaction_record` DROP FOREIGN KEY `fk_name_reaction_child`;
ALTER TABLE `name_reaction_record`
    ADD CONSTRAINT `fk_name_reaction_child`
        FOREIGN KEY (`child_id`) REFERENCES `child` (`id`) ON DELETE CASCADE;

ALTER TABLE `point_game_record` DROP FOREIGN KEY `fk_point_game_child`;
ALTER TABLE `point_game_record`
    ADD CONSTRAINT `fk_point_game_child`
        FOREIGN KEY (`child_id`) REFERENCES `child` (`id`) ON DELETE CASCADE;

ALTER TABLE `voice_game_record` DROP FOREIGN KEY `fk_voice_game_child`;
ALTER TABLE `voice_game_record`
    ADD CONSTRAINT `fk_voice_game_child`
        FOREIGN KEY (`child_id`) REFERENCES `child` (`id`) ON DELETE CASCADE;

ALTER TABLE `survey_result` DROP FOREIGN KEY `fk_survey_child`;
ALTER TABLE `survey_result`
    ADD CONSTRAINT `fk_survey_child`
        FOREIGN KEY (`child_id`) REFERENCES `child` (`id`) ON DELETE CASCADE;

ALTER TABLE `daily_recommendation` DROP FOREIGN KEY `fk_recommend_child`;
ALTER TABLE `daily_recommendation`
    ADD CONSTRAINT `fk_recommend_child`
        FOREIGN KEY (`child_id`) REFERENCES `child` (`id`) ON DELETE CASCADE;

ALTER TABLE `treehole_message` DROP FOREIGN KEY `fk_treehole_user`;
ALTER TABLE `treehole_message`
    ADD CONSTRAINT `fk_treehole_user`
        FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL;

USE star_companion;

-- 1. 删除 child 表的原有外键
ALTER TABLE `child` DROP FOREIGN KEY `fk_child_user`;

-- 2. 重新添加外键，设置 ON DELETE CASCADE
ALTER TABLE `child`
    ADD CONSTRAINT `fk_child_user`
        FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE;


-- 执行以下SQL更新 SurveyResult 表结构

USE star_companion;

-- 添加 scale_type 字段
ALTER TABLE survey_result
    ADD COLUMN scale_type ENUM('mchat', 'cast') DEFAULT 'mchat' AFTER child_id;

-- 添加 max_score 字段
ALTER TABLE survey_result
    ADD COLUMN max_score INT DEFAULT 20 AFTER total_score;

-- 添加 ai_analysis 字段
ALTER TABLE survey_result
    ADD COLUMN ai_analysis TEXT AFTER suggestions;

-- 添加 dimension_scores 字段
ALTER TABLE survey_result
    ADD COLUMN dimension_scores JSON AFTER ai_analysis;

# 在 console.sql 中执行：
ALTER TABLE point_game_record ADD COLUMN ai_analysis TEXT AFTER round_details;

USE star_companion;

-- 1. 添加 avg_reaction_time 字段（如果不存在）
ALTER TABLE point_game_record
    ADD COLUMN avg_reaction_time DECIMAL(5,2) DEFAULT NULL COMMENT '平均反应时间(秒)'
        AFTER skip_count;

USE star_companion;

CREATE TABLE IF NOT EXISTS ai_token_usage (
                                              id INT NOT NULL AUTO_INCREMENT,
                                              record_type VARCHAR(50) NOT NULL COMMENT 'point_single/point_trend/survey_analysis',
                                              record_id INT DEFAULT NULL,
                                              child_id INT DEFAULT NULL,
                                              model_name VARCHAR(100) DEFAULT NULL,
                                              prompt_tokens INT DEFAULT 0,
                                              completion_tokens INT DEFAULT 0,
                                              total_tokens INT DEFAULT 0,
                                              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                              PRIMARY KEY (id),
                                              INDEX idx_record_type (record_type),
                                              INDEX idx_child_id (child_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



-- 新
USE star_companion;

-- 1. 给叫名反应表添加 ai_analysis 字段
ALTER TABLE name_reaction_record
    ADD COLUMN ai_analysis TEXT AFTER round_details;

-- 2. 给声音小话筒表添加 ai_analysis 字段
ALTER TABLE voice_game_record
    ADD COLUMN ai_analysis TEXT AFTER round_details;

-- 验证字段是否添加成功
SHOW COLUMNS FROM name_reaction_record LIKE 'ai_analysis';
SHOW COLUMNS FROM voice_game_record LIKE 'ai_analysis';

USE star_companion;
ALTER TABLE treehole_message ADD COLUMN liked_by JSON DEFAULT NULL AFTER likes;

USE star_companion;

DROP TABLE IF EXISTS `treehole_reply`;
CREATE TABLE `treehole_reply` (
                                  `id` INT NOT NULL AUTO_INCREMENT,
                                  `message_id` INT NOT NULL,
                                  `user_id` INT DEFAULT NULL,
                                  `anonymous_name` VARCHAR(50) DEFAULT NULL,
                                  `anonymous_avatar` VARCHAR(50) DEFAULT NULL,
                                  `content` TEXT NOT NULL,
                                  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
                                  PRIMARY KEY (`id`),
                                  KEY `fk_reply_message` (`message_id`),
                                  KEY `fk_reply_user` (`user_id`),
                                  CONSTRAINT `fk_reply_message` FOREIGN KEY (`message_id`) REFERENCES `treehole_message` (`id`) ON DELETE CASCADE,
                                  CONSTRAINT `fk_reply_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


USE star_companion;
ALTER TABLE treehole_reply
    ADD COLUMN user_nickname VARCHAR(50) AFTER user_id,
    ADD COLUMN user_avatar VARCHAR(500) AFTER user_nickname,
    ADD COLUMN is_anonymous TINYINT(1) DEFAULT 1 AFTER anonymous_avatar,
    ADD COLUMN ai_reply TEXT AFTER content;

-- 删除 user_avatar 字段，不需要存储大段的base64
ALTER TABLE treehole_reply DROP COLUMN user_avatar;
