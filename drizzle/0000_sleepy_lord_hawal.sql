CREATE TABLE `ledger_records` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`kind` text NOT NULL,
	`parent` text,
	`created_at` text NOT NULL,
	`metadata` text NOT NULL,
	`payload_key` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_records_owner_kind_created` ON `ledger_records` (`owner`,`kind`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_records_owner_parent` ON `ledger_records` (`owner`,`parent`);