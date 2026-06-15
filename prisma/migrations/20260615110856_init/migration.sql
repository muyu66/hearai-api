-- CreateTable
CREATE TABLE `users` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(50) NOT NULL,
    `nickname` VARCHAR(100) NOT NULL DEFAULT '',
    `word_level` TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `daily_word_count` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    `pron_type` ENUM('UK', 'US') NOT NULL,
    `wechat_openid` VARCHAR(255) NULL,
    `google_openid` VARCHAR(255) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `deleted_at` DATETIME(0) NULL,

    UNIQUE INDEX `users_username_key`(`username`),
    UNIQUE INDEX `users_wechat_openid_key`(`wechat_openid`),
    UNIQUE INDEX `users_google_openid_key`(`google_openid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `words` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `word` VARCHAR(200) NOT NULL,
    `translation` VARCHAR(1000) NOT NULL,
    `uk_pron` VARCHAR(255) NOT NULL,
    `us_pron` VARCHAR(255) NOT NULL,
    `uk_pron_voice` VARCHAR(255) NULL,
    `us_pron_voice` VARCHAR(255) NULL,
    `level` TINYINT UNSIGNED NOT NULL DEFAULT 1,
    `word_embedding` JSON NULL,
    `translation_embedding` JSON NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `deleted_at` DATETIME(0) NULL,

    UNIQUE INDEX `words_word_key`(`word`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_words` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `word_id` BIGINT UNSIGNED NOT NULL,
    `daily_word_id` BIGINT UNSIGNED NOT NULL,
    `failed_count` TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `thinking_time` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `failed_mode` TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `question_mode` ENUM('TRAN_TO_WORD', 'WORD_TO_TRAN', 'SOUND_TO_TRAN') NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `deleted_at` DATETIME(0) NULL,

    UNIQUE INDEX `user_words_user_id_word_id_daily_word_id_key`(`user_id`, `word_id`, `daily_word_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_master_words` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `word_id` BIGINT UNSIGNED NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `deleted_at` DATETIME(0) NULL,

    UNIQUE INDEX `user_master_words_user_id_word_id_key`(`user_id`, `word_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `daily_words` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `word_id` BIGINT UNSIGNED NOT NULL,
    `question_mode` ENUM('TRAN_TO_WORD', 'WORD_TO_TRAN', 'SOUND_TO_TRAN') NOT NULL,
    `is_finished` BOOLEAN NOT NULL DEFAULT false,
    `finished_at` DATETIME(0) NULL,
    `created_date` VARCHAR(10) NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `deleted_at` DATETIME(0) NULL,

    UNIQUE INDEX `daily_words_user_id_word_id_created_date_question_mode_key`(`user_id`, `word_id`, `created_date`, `question_mode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `daily_words` ADD CONSTRAINT `daily_words_word_id_fkey` FOREIGN KEY (`word_id`) REFERENCES `words`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
