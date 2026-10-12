CREATE TABLE `removed_members` (
	`cart` text NOT NULL,
	`user` text NOT NULL,
	PRIMARY KEY(`cart`, `user`),
	FOREIGN KEY (`cart`) REFERENCES `carts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
